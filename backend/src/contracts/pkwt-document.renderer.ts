/**
 * Renderer dokumen PKWT (Kesepakatan Kerja Waktu Tertentu) — pintu TUNGGAL.
 *
 * Modul ini adalah SATU-SATUNYA tempat yang tahu cara merakit PDF PKWT dari
 * blok konten bilingual (`languages.id` + `languages.en`) + nilai placeholder.
 * Dipakai oleh:
 *  1. Generate kontrak  → `ContractDocumentService` (jalur snapshot)
 *  2. Pratinjau editor  → endpoint `.../preview-pdf` (draft belum tersimpan)
 *
 * Sama seperti `mitra-document.renderer.ts`, modul ini MURNI (tanpa
 * NestJS/Prisma): masuk blok + nilai, keluar buffer PDF. Itulah kenapa modul
 * `contract-templates` dapat memakainya tanpa ketergantungan sirkular.
 */
import PDFDocument from 'pdfkit'
import { interpolate } from './contract-block-renderer'
import { hasInlineMarks, parseInlineRuns, type InlineRun } from './inline-marks'
import { blockSpaceAfterPts } from './block-spacing'
import {
  PKWT_FONT_NAMES,
  PKWT_GEOMETRY,
  buildPkwtRowsFromStructuredParagraphs,
  pkwtColumnInnerWidth,
  registerPkwtFonts,
  renderPkwtLayout,
  type PkwtAlign,
  type PkwtParagraph,
  type PkwtSignatureOptions
} from './pkwt-layout.engine'

/** Direktori font (Times New Roman + Lucida Sans Typewriter). */
export function resolvePkwtFontDir(): string {
  return process.env.FONT_DIR
    ?? (process.platform === 'win32'
      ? 'C:/Windows/Fonts'
      : '/usr/share/fonts/truetype/msttcorefonts')
}

/** Path TTF per peran. Badan/judul = Lucida; kop = Times New Roman. */
export interface PkwtFontPaths {
  regular: string
  bold: string
  italic: string
  boldItalic: string
  /** Times New Roman regular — HANYA kop surat. */
  headerRegular: string
}

/**
 * Resolusi font PKWT.
 *
 * Badan, judul, dan tanda tangan memakai **Lucida Sans Typewriter** (`LTYPE*.TTF`)
 * — terukur `LucidaSans-Typewriter` 9.0 dari master. Ini penting dan mudah
 * salah: judul TIDAK memakai Times New Roman. Seluruh blok judul master adalah
 * Lucida Sans Typewriter BOLD pada 12.0 (judul) dan 9.75 (nomor).
 *
 * Satu-satunya bagian ber-Times adalah **kop surat** (`TimesNewRomanPSMT`,
 * regular — master tidak menebalkannya), sehingga kita tetap butuh dua keluarga.
 *
 * Bila Lucida tidak ada di host, kita jatuh ke Times supaya kontrak tetap
 * terbentuk — bukan gagal — walau tipografinya menyimpang dari master.
 */
export function resolvePkwtFonts(): PkwtFontPaths {
  const dir = resolvePkwtFontDir()

  const fs = require('node:fs') as typeof import('node:fs')
  const exists = (p: string) => {
    try { return fs.existsSync(p) } catch { return false }
  }
  const pick = (preferred: string[], fallback: string) => preferred.find(exists) ?? fallback

  return {
    regular: pick([`${dir}/LTYPE.TTF`, `${dir}/ltype.ttf`], `${dir}/times.ttf`),
    bold: pick([`${dir}/LTYPEB.TTF`, `${dir}/ltypeb.ttf`], `${dir}/timesbd.ttf`),
    italic: pick([`${dir}/LTYPEO.TTF`, `${dir}/ltypeo.ttf`], `${dir}/timesi.ttf`),
    boldItalic: pick([`${dir}/LTYPEBO.TTF`], `${dir}/timesbi.ttf`),
    headerRegular: pick([`${dir}/times.ttf`], `${dir}/times.ttf`)
  }
}

/** Path absolut logo kop PKWT. */
export function resolvePkwtLogoPath(assetRoot: string): string {
  return `${assetRoot}/contract-logo-pkwt.jpg`
}

export interface PkwtDocumentRenderOptions {
  /** Blok konten bahasa Indonesia (`contentDefinition.languages.id`). */
  blocks: any[]
  /** Blok konten bahasa Inggris (`contentDefinition.languages.en`). */
  blocksEn?: any[]
  /** Nilai placeholder (key → displayValue) untuk kolom INDONESIA. */
  values: Record<string, string>
  /**
   * Nilai placeholder untuk kolom INGGRIS. Bila kosong, kolom kanan memakai
   * `values` yang sama — perilaku lama untuk semua field yang teksnya tidak
   * bergantung bahasa. Hanya field dengan label per-bahasa (mis.
   * `employee.gender` → "Laki-laki"/"Male") yang mengisi peta ini berbeda.
   */
  valuesEn?: Record<string, string>
  /** Baris kop organisasi (dari template, bukan redaksi hardcode). */
  orgLines?: string[]
  addressLines?: string[]
  contactLine?: string
  /** Judul dua baris; fallback ke blok `title`/`subtitle`. */
  titleId?: string
  titleEn?: string
  /** Label nomor kontrak — master memakai prefix `No. :`. */
  numberLabel?: string
  logoPath?: string | null
  fonts?: PkwtFontPaths
  /** Opsi tanda tangan; label pilar punya default. */
  signature?: Partial<PkwtSignatureOptions>
  /** Judul fallback bila blok `title`/`subtitle` tidak ada. */
  fallbackTitle?: string
  fallbackTitleEn?: string
}

/**
 * Run ber-mark untuk teks yang SUDAH diinterpolasi.
 *
 * Urutan penting: interpolasi dulu, baru parse. Placeholder `{{...}}` diganti
 * nilainya sebelum mark dibaca, sehingga `**{{employee.fullName}}**` menjadi
 * `**Budi**` dan `Budi` benar-benar bold. Kalau dibalik, mark akan menempel pada
 * teks placeholder, bukan pada nilainya.
 *
 * `undefined` (bukan array kosong) bila teksnya tidak bermark — itu sinyal bagi
 * engine untuk memakai jalur lama, sehingga template yang sudah ada tidak
 * berubah sama sekali.
 */
function markedRuns(text: string): InlineRun[] | undefined {
  return hasInlineMarks(text) ? parseInlineRuns(text) : undefined
}

/** `block.align` yang sah. Nilai lain (termasuk `undefined`) → perilaku lama. */
function pkwtBlockAlign(value: unknown): PkwtAlign | undefined {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
    ? value
    : undefined
}

/**
 * Ubah blok konten menjadi larik paragraf siap-render, lengkap dengan id blok.
 *
 * ATURAN PASSTHROUGH: tidak ada redaksi yang dibangkitkan atau diringkas.
 * Blok `article` mengeluarkan heading-nya sebagai paragraf tersendiri lalu
 * paragraf isinya — persis urutan master. Blok `title`, `subtitle`,
 * `signature`, dan `pageBreak` di-skip karena ditangani sebagai CHROME oleh
 * engine, bukan sebagai isi kolom.
 *
 * Setiap paragraf membawa `blockId` asalnya. Engine memakai id itu untuk
 * memasangkan kolom ID dan EN per blok (lihat
 * `buildPkwtRowsFromStructuredParagraphs`), sehingga jumlah paragraf yang
 * berbeda antar bahasa tidak menggeser seluruh dokumen.
 */
export function blocksToPkwtParagraphs(
  blocks: any[],
  values: Record<string, string>
): PkwtParagraph[] {
  const out: PkwtParagraph[] = []
  let ordinal = 0
  let anon = 0

  for (const block of blocks ?? []) {
    // Identitas blok untuk penelusuran; blok tanpa id tetap diberi label unik.
    const blockId = String(block?.id ?? `__anon-${anon++}`)
    const local: { text: string, bold: boolean, runs?: InlineRun[], align?: PkwtAlign }[] = []
    // Perataan hanya diambil untuk blok yang MEMANG mendukungnya (`paragraph`
    // dan `article`). `list`/`table` punya perataan sendiri; validator menolak
    // `align` di sana, dan di sini dijaga agar tidak ikut terbawa.
    let localAlign: PkwtAlign | undefined

    switch (block?.type) {
      case 'paragraph': {
        const text = interpolate(String(block.text ?? ''), values)
        localAlign = pkwtBlockAlign(block?.align)
        local.push({ text, bold: false, runs: markedRuns(text) })
        break
      }

      case 'article': {
        localAlign = pkwtBlockAlign(block?.align)
        // `headingAlign`: perataan KHUSUS judul pasal, lepas dari `align` blok
        // (yang tetap berlaku untuk uraian). Tanpa keduanya → `undefined` =
        // rumus lama di `resolveCellAlign` (baris bold → 'left').
        const headingAlign = pkwtBlockAlign(block?.headingAlign)
        const heading = interpolate(String(block.heading ?? ''), values)
        // Judul pasal TIDAK pernah diberi runs: ia sudah bold penuh dan tingginya
        // dijaga maksimal 2 baris. Perataannya miliknya sendiri (headingAlign),
        // bukan `localAlign` blok.
        if (heading) local.push({ text: heading, bold: true, align: headingAlign })
        for (const p of block.paragraphs ?? []) {
          const text = interpolate(String(p ?? ''), values)
          local.push({ text, bold: false, runs: markedRuns(text) })
        }
        break
      }

      case 'list':
        for (const item of block.items ?? []) {
          const raw = typeof item === 'object' && item !== null ? (item.text ?? '') : item
          local.push({ text: interpolate(String(raw), values), bold: false })
        }
        break

      default:
        // title/subtitle/signature/pageBreak/table → bukan isi kolom.
        break
    }

    // Blok yang TIDAK menghasilkan paragraf (title/subtitle/signature) tidak
    // memakai nomor urut. Ini penting: daftar blok ID dan EN bisa berbeda (mis.
    // `subtitle` hanya ada di kolom ID), dan kalau blok kosong ikut dihitung
    // maka penomoran kedua kolom langsung bergeser satu.
    if (local.length === 0) continue
    // Jarak blok (`block.spaceAfter`) dibawa tiap paragraf; engine memakainya
    // untuk menambah `gapBefore` baris pembuka blok berikutnya.
    const blockSpaceAfter = blockSpaceAfterPts(block?.spaceAfter)
    for (const p of local) {
      out.push({
        text: p.text,
        bold: p.bold,
        runs: p.runs,
        // `align` per-paragraf (untuk judul pasal = headingAlign); jatuh ke
        // `localAlign` blok bila paragrafnya tidak membawa align sendiri.
        align: p.align ?? localAlign,
        blockId,
        blockIndex: ordinal,
        spaceAfter: blockSpaceAfter,
      })
    }
    ordinal += 1
  }
  return out
}

/** Ekstrak judul dari blok konten (`title` lalu `subtitle`). */
function extractTitle(blocks: any[]): { title?: string, subtitle?: string } {
  const title = (blocks ?? []).find((b: any) => b?.type === 'title')?.text
  const subtitle = (blocks ?? []).find((b: any) => b?.type === 'subtitle')?.text
  return {
    title: typeof title === 'string' ? title : undefined,
    subtitle: typeof subtitle === 'string' ? subtitle : undefined
  }
}

/**
 * Alirkan dokumen PKWT ke `doc` yang sudah dibuat.
 *
 * Kolom kiri = stream ID, kolom kanan = stream EN, dikunci per baris oleh
 * engine. Ini yang membuat baris ID/EN selalu berada pada y yang sama — sifat
 * yang paling menonjol dari master dan paling mudah rusak bila kedua bahasa
 * dirender sebagai dua aliran independen.
 */
export function renderPkwtDocumentInto(doc: any, opts: PkwtDocumentRenderOptions): void {
  const fonts = opts.fonts ?? resolvePkwtFonts()
  const values = opts.values ?? {}

  // PENTING: daftarkan font SEBELUM pengukuran. `buildPkwtRows` memanggil
  // `doc.font('PKWT-Regular')`; bila nama itu belum terdaftar, pdfkit
  // menganggapnya path file dan gagal dengan ENOENT.
  registerPkwtFonts(doc, fonts)

  const { title: idTitle, subtitle: idSub } = extractTitle(opts.blocks)
  const { title: enTitle } = extractTitle(opts.blocksEn ?? [])

  const idParas = blocksToPkwtParagraphs(opts.blocks, values)
  const enParas = blocksToPkwtParagraphs(opts.blocksEn ?? [], opts.valuesEn ?? values)

  // Body master = 9pt; engine memakai font yang sudah terdaftar di atas.
  doc.font(PKWT_FONT_NAMES.regular).fontSize(PKWT_GEOMETRY.font.body)
  const innerW = Math.min(pkwtColumnInnerWidth(0), pkwtColumnInnerWidth(1))

  // Paragraf dipasangkan per-BLOK (bukan per index rata). Selisih jumlah
  // paragraf antar bahasa (mis. `recitals` ID 1 vs EN 2) diserap LOKAL di dalam
  // blok itu, sehingga tidak lagi menggeser seluruh dokumen dan membuat bold
  // jatuh di baris yang salah. Bold dibawa PER-KOLOM dari tipe blok asalnya.
  const rows = buildPkwtRowsFromStructuredParagraphs(
    doc,
    idParas,
    enParas,
    { width: innerW, size: PKWT_GEOMETRY.font.body }
  )

  const sig = opts.signature ?? {}
  renderPkwtLayout(doc, {
    rows,
    header: {
      orgLines: opts.orgLines ?? [],
      addressLines: opts.addressLines ?? [],
      contactLine: opts.contactLine,
      titleId: opts.titleId ?? idTitle ?? opts.fallbackTitle ?? '',
      titleEn: opts.titleEn ?? idSub ?? enTitle ?? opts.fallbackTitleEn ?? '',
      contractNumber: opts.numberLabel,
      logoPath: opts.logoPath
    },
    fonts,
    signature: {
      leftTitle: sig.leftTitle ?? 'PIHAK PERTAMA',
      rightTitle: sig.rightTitle ?? 'PIHAK KEDUA',
      leftName: sig.leftName,
      rightName: sig.rightName,
      leftRole: sig.leftRole,
      rightRole: sig.rightRole
    }
  })
}

/** Bangun buffer PDF PKWT lengkap (A4, siap dikirim/ditulis). */
export function createPkwtPdfBuffer(opts: PkwtDocumentRenderOptions): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [595.5, 842.25],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true
    })

    const buffers: Buffer[] = []
    doc.on('data', (chunk: Buffer) => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    try {
      renderPkwtDocumentInto(doc, opts)
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
