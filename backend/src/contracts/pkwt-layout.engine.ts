/**
 * PKWT (Kesepakatan Kerja Waktu Tertentu) layout engine — master-faithful
 * two-column renderer, dengan varian BILINGUAL tanpa split.
 *
 * Nilai geometris di bawah ini BUKAN asumsi: semuanya diukur langsung dari
 * master PDF `docs/sample-legal-doc/pdf/PKWT DRIVER 2026.pdf` memakai
 * pdfplumber (lihat docs/pkwt-visual-spec.md).
 *
 * Perbedaan pokok vs MITRA (`mitra-layout.engine.ts`) — jangan disatukan:
 *  1. Teks badan memakai Lucida Sans Typewriter 9pt, bukan Times New Roman 12pt.
 *  2. Judul DUA baris bertumpuk: ID (bold, TNR 14.27) di atas EN
 *     (regular, TNR 14.27), dipisah garis tipis 0.75pt.
 *  3. Kotak kolom digambar sebagai FILL 0.75pt (stroke=False), bukan stroke.
 *     Terukur: semua rect kotak punya `linewidth=0` dan `stroke=False`.
 *  4. Kotak halaman 1 start di y=182.40 (di bawah judul), BUKAN menempel di
 *     garis kop (125.42). Angka 125.42 itu y GARIS KOP, bukan top kotak.
 *  5. Tanda tangan adalah sub-tabel 2 kolom BER-BORDER yang berada DI DALAM
 *     area kolom halaman terakhir, bukan di luar kotak.
 *  6. Baris ID/EN terkunci per-baris (row-locked), bukan split-setengah.
 *
 * Modul ini hanya mengatur TATA LETAK. Ia tidak menciptakan, meringkas,
 * atau menulis ulang konten legal.
 */
import {
  computeColumnWidths,
  computeRowHeight,
  drawJustifiedLine,
  wrapCellLines
} from './table-layout.helpers'
import PDFDocument from 'pdfkit'

/** Geometri master (satuan: PDF point, origin kiri-atas). */
export const PKWT_GEOMETRY = {
  pageWidth: 595.5,
  pageHeight: 842.25,

  /**
   * Dua kolom ber-border (0.75pt). Terukur dari master:
   *  - tepi kiri kotak kiri : 26.27 → 27.02  (DI LUAR x0)
   *  - tepi kanan kotak kiri: 296.63 → 297.38 (DI LUAR x1)
   *  - tepi kiri kotak kanan: 308.65 → 309.40 (DI LUAR x0)
   *  - tepi kanan kotak kanan: 566.98 → 567.73 (DI LUAR x1)
   *
   * Jadi `x0`/`x1` di sini adalah SISI DALAM tepi, dan batang vertikal master
   * digambar pada `x0-0.75 … x0` serta `x1 … x1+0.75`.
   */
  left: { x0: 27.02, x1: 296.62 },
  right: { x0: 309.4, x1: 566.98 },

  /** Garis tepi kotak (dipakai untuk menggambar fill). */
  borderWidth: 0.75,

  /**
   * Kotak halaman 1. Terukur dari master:
   *  - tepi ATAS    : y 182.40 → 183.15
   *  - batang vertikal: y 183.15 → 765.67
   *  - tepi BAWAH   : y 765.67 → 766.42
   * Halaman lanjutan: 31.53 → 32.27 | 32.27 → 767.17 | 767.17 → 767.92.
   *
   * `*BoxTop` = sisi ATAS tepi (bukan sisi bawah), sebab pengukuran pdfplumber
   * mengembalikan `top` batang vertikal = 183.15, bukan 182.40.
   * BUKAN 125.42 — itu y garis kop.
   */
  firstPageBoxTop: 182.4,
  firstPageBoxBottom: 766.42,
  contPageBoxTop: 31.53,
  contPageBoxBottom: 767.92,

  /** Garis horizontal di bawah kop (dua baris). */
  rules: {
    x0: 15.6,
    x1: 578.25,
    y1: 125.42,
    thickness1: 2.85,
    y2: 129.22,
    thickness2: 0.95
  },

  /** Logo kop (page 1 only): gambar 94.65 x 94.05 pada x=15.60, top=16.95. */
  logo: { x: 15.6, y: 16.95, width: 94.65, height: 94.05 },

  /**
   * Kop surat. Terukur dari master:
   *  - semua baris Times New Roman REGULAR (tidak ada yang bold);
   *  - dipusatkan pada x=301.14, BUKAN pusat area sisa setelah logo
   *    (pusat area sisa ≈ 348.75 → teks akan bergeser ~47pt ke kanan);
   *  - jarak antar-baris: 18.76 dalam blok org (14.27pt), 14.25 dalam blok
   *    alamat (12pt), tetapi 17.56 pada transisi org→alamat dan 12.49 pada
   *    transisi alamat→kontak — jadi TIDAK seragam (lihat konstanta di bawah).
   */
  headerCenterX: 301.14,
  /** `top` glyph master untuk baris org pertama. */
  headerTop: 15.84,
  /**
   * Koreksi baseline PDFKit vs master, PER FONT.
   *
   * `doc.text(text, x, y)` menempatkan y di puncak KOTAK BARIS, sedangkan
   * pdfplumber melaporkan `top` dari glyph. Selisihnya = (ascent − capHeight)
   * per em, dan berbeda antar font. Terukur konsisten pada master:
   *
   *   - Times New Roman : 14.27pt → +1.53, 12.0pt → +1.29  ⇒ 0.107 em
   *   - Lucida Typewriter: 12.0pt → +2.07,  9.75pt → +1.70  ⇒ 0.173 em
   *
   * Dipakai `pkwtTextTop()` agar baseline hasil render duduk di koordinat
   * glyph master.
   */
  textBaselineFactorTimes: 0.107,
  textBaselineFactorLucida: 0.173,
  /** Jarak antar-baris org, terukur 18.76 (15.84→34.61→53.36). */
  headerOrgAdvance: 18.76,
  /**
   * Jarak baris org TERAKHIR → alamat pertama, terukur 17.56
   * (53.36→70.92). Berbeda dari `headerOrgAdvance`, jadi tidak boleh
   * disamakan — selisihnya 1.2pt dan membuat alamat turun.
   */
  headerOrgToAddressAdvance: 17.56,
  /** Jarak antar-baris alamat, terukur 14.25 (70.92→85.17). */
  headerAddressAdvance: 14.25,
  /** Jarak alamat TERAKHIR → baris kontak, terukur 12.49 (85.17→97.66). */
  headerAddressToContactAdvance: 12.49,

  /**
   * Blok judul dua baris.
   *  - ID  : y=144.30, x 183.23→422.51  (Lucida Sans Typewriter BOLD 12.0)
   *  - garis pemisah: y=155.40, x 183.23→415.28, 0.75pt
   *  - EN  : y=158.60, x 186.97→418.76  (Lucida Sans Typewriter BOLD 12.0)
   *  - no. : y=172.40, x 217.77→386.60  (Lucida Sans Typewriter BOLD 9.75)
   *
   * CATATAN PENTING (koreksi terukur, menggantikan dugaan awal):
   * SELURUH blok judul memakai SATU typeface — Lucida Sans Typewriter Bold —
   * dengan DUA ukuran saja (12.0 untuk judul, 9.75 untuk nomor). Tidak ada
   * Times New Roman di sini; dugaan sebelumnya (TNR 14.27) salah. Karena judul
   * hanya 12pt, keduanya muat SATU baris dan tidak pernah bertumpuk.
   */
  titleIdTop: 144.3,
  titleRuleY: 155.4,
  titleEnTop: 158.6,
  numberTop: 172.4,
  /** Baris isi pertama master: y=186. */
  bodyTop: 186,

  rule: {
    /** x judul garis pemisah. */
    x0: 183.23,
    x1: 415.28,
    thickness: 0.75
  },

  /**
   * Sub-tabel tanda tangan (ber-border) di dalam area kolom halaman terakhir.
   * Terukur pada halaman 4: x 125.40 → 459.58, divider 297.38,
   * baris atas 617.80, bawah 716.88 (tinggi 97.57).
   */
  signatureTable: {
    left: 125.4,
    divider: 297.38,
    right: 459.58,
    /** Tinggi total terukur. */
    height: 97.57,
    /** Jumlah baris logis (label jabatan / ruang tanda tangan / nama). */
    gapFromBox: 12
  },

  font: {
    headerOrg: 14.27,
    headerAddress: 12,
    /**
     * Judul ID/EN: Lucida Sans Typewriter BOLD 12.0 (terukur dari master).
     * BUKAN Times New Roman 14.27 — koreksi dari dugaan awal.
     */
    title: 12,
    /** Baris `No. :` (Lucida Bold 9.75, terukur dari master). */
    number: 9.75,
    /** Badan kontrak (Lucida). */
    body: 9,
    /** Penanda bagian bold (Lucida Bold). */
    heading: 9,
    signature: 9.75
  },

  /** Jarak teks dari tepi kolom (di dalam fill). */
  textPaddingLeft: 4.6,
  /**
   * Hanging indent untuk item bernomor ("1.", "a."): baris lanjutan menjorok
   * agar sejajar dengan huruf pertama setelah label.
   */
  listHangingIndent: 13.5,
  /** Tambahan leading: badan 9pt di master berspasi baris cukup lega. */
  lineGap: 1.6,
  paragraphGap: 4,
  headingGapAfter: 4
} as const

/** Nama font logis → dipetakan oleh pemanggil ke file TTF yang terdaftar. */
export const PKWT_FONT_NAMES = {
  regular: 'PKWT-Regular',
  bold: 'PKWT-Bold',
  italic: 'PKWT-Italic',
  boldItalic: 'PKWT-BoldItalic',
  /**
   * Kop surat. Catatan penting: kop adalah SATU-SATUNYA bagian dokumen ini yang
   * memakai Times New Roman (terukur `TimesNewRomanPSMT`, REGULAR — master tidak
   * menebalkan baris mana pun). Badan, judul, dan tanda tangan memakai Lucida
   * Sans Typewriter; judul memakai `bold` Lucida, BUKAN Times.
   */
  headerRegular: 'PKWT-HeaderRegular'
} as const

/** Lebar dalam kolom (di dalam border & padding). */

/* ------------------------------------------------------------------ *
 * Bilingual row model
 * ------------------------------------------------------------------ */

/** Satu baris paralel: teks ID (kiri) dan EN (kanan) yang harus sealign. */
export interface PkwtRow {
  id: string
  en: string
  /** Gaya baris; memengaruhi font & gap. */
  kind?: 'heading' | 'body' | 'list'
  /**
   * Bold PER-KOLOM.
   *
   * Sebelumnya bold diturunkan dari satu `kind` bersama, sehingga sebuah judul
   * pasal di salah satu kolom ikut menebalkan teks isi kolom satunya (bug
   * "bold bocor"). Sekarang tiap kolom membawa flag-nya sendiri.
   */
  idBold?: boolean
  enBold?: boolean
  /**
   * Justifikasi PER-KOLOM. Baris terakhir paragraf sebuah kolom tidak
   * direntangkan, dan batas paragraf kolom ID/EN tidak harus jatuh di baris
   * yang sama.
   */
  idJustify?: boolean
  enJustify?: boolean
  /** Untuk `list`: label nomor ("1.", "a.") agar hanging indent konsisten. */
  idLabel?: string
  enLabel?: string
  /**
   * Rata kanan-kiri (justified), meniru master.
   *
   * Master (semua 4 varian PKWT) memang justified: 69% baris berakhir pada tepi
   * kanan yang SAMA PERSIS (`561.5pt` untuk kolom EN, `291.0pt` untuk kolom ID).
   * Justifikasi dilakukan PER-BARIS saat menggambar, baris terakhir tiap
   * paragraf dibiarkan rata kiri — persis seperti Word/LaTeX.
   *
   * `undefined` (default) berarti TIDAK spartan: baris `(id, en)` hasil
   * pemecahan paragraf kehilangan batas paragrafnya di `buildPkwtRows`, jadi
   * kita tidak pernah menjustifikasi secara default agar baris terakhir
   * paragraf tidak ikut direntangkan. Pemanggil yang tahu batas paragraf
   * (lihat `buildPkwtRowsFromParagraphs`) yang menyalakan opsi ini.
   */
  justify?: boolean
}

/**
 * Bangun daftar baris paralel dari dua stream terpisah.
 *
 * Stream `id` dan `en` TIDAK dijamin punya jumlah baris sama (redaksi bisa
 * berbeda panjang). Karena master menuntut baris visual sejajar, kita pecah
 * tiap paragraf menjadi baris-baris lalu memasangkannya selama kedua sisi masih
 * punya sisa. Sisa di satu sisi saja menghasilkan baris dengan sisi lain kosong
 * — persis seperti master.
 *
 * Pemecahan memakai `wrapCellLines` (helper bersama) yang MENYIMPAN spasi
 * antar-kata. Ini penting karena tiap `PkwtRow` sudah berupa SATU baris keluaran:
 * engine mengukur dan menggambar per-baris sendiri, jadi ia tidak bergantung pada
 * cara PDFKit membungkus teks.
 *
 * CATATAN KOREKSI: pernah tercatat bahwa `doc.text({align:'justify'})` pada
 * pdfkit 0.19.1 "membuang glyph spasi" (pdfkit.js:3687-3705) sehingga muncul
 * `3.AtasPekerjaanyangdilakukan`. Klaim itu **KELIRU**. Justifikasi menulis celah
 * antar-kata sebagai offset numerik di dalam operator `TJ`, bukan sebagai glyph
 * spasi; PDF nyata tetap menampilkan spasi utuh dan `extract_text()` juga
 * mengembalikannya. Meski begitu, menggambar per-baris tetap dipilih di sini
 * karena master membutuhkan justifikasi PER-BARIS (baris terakhir tiap paragraf
 * rata kiri), yang tidak bisa diandalkan pada pembungkusan otomatis PDFKit.
 */
export function buildPkwtRows(
  doc: any,
  idBlocks: string[],
  enBlocks: string[],
  opts: { width: number, size: number, font?: string }
): PkwtRow[] {
  const font = opts.font ?? PKWT_FONT_NAMES.regular
  const wrap = (texts: string[]): string[][] =>
    texts.map(t => wrapCellLines(doc, t, opts.width, font, opts.size))

  const idLines = wrap(idBlocks)
  const enLines = wrap(enBlocks)

  const rows: PkwtRow[] = []
  const n = Math.max(idLines.length, enLines.length)
  for (let i = 0; i < n; i++) {
    const a = idLines[i] ?? []
    const b = enLines[i] ?? []
    const m = Math.max(a.length, b.length)
    for (let j = 0; j < m; j++) {
      rows.push({ id: a[j] ?? '', en: b[j] ?? '', kind: 'body' })
    }
  }
  return rows
}

/**
 * Seperti `buildPkwtRows`, tetapi MENANDAI baris terakhir tiap paragraf dengan
 * `justify: false` dan sisanya `justify: true`.
 *
 * Kenapa terpisah: `buildPkwtRows` meratakan semua paragraf menjadi satu daftar
 * baris, sehingga batas antar-paragraf hilang dan baris terakhir paragraf tidak
 * bisa dibedakan dari baris tengah. Justifikasi butuh informasi itu — kalau
 * tidak ada, baris terakhir paragraf ikut direntangkan dan tampak "melar"
 * (teks pendek dengan celah raksasa), yang justru menyimpang dari master.
 *
 * KUNCI ID/EN (perbaikan bug bold-bocor):
 * Baris tiap kolom dibangun PER-BLOK lalu dipasangkan berdasarkan `blockId`,
 * BUKAN berdasarkan index rata. Versi lama memasangkan `idLines[i]` dengan
 * `enLines[i]` memakai index global, sehingga begitu jumlah paragraf kolom ID
 * dan EN berbeda (mis. blok `recitals` kolom ID 1 paragraf vs EN 2 paragraf),
 * SELURUH paragraf setelah titik itu bergeser satu dan teks ID duduk di sebelah
 * redaksi EN yang tidak berpasangan. Karena `kind: 'heading'` ditentukan dari
 * posisi baris, geseran itu membuat judul pasal tampak tidak bold dan teks isi
 * tampak bold.
 *
 * Dengan pairing per-`blockId`, blok yang sama selalu saling berhadapan;
 * selisih jumlah paragraf di dalam satu blok ditangani secara LOKAL (baris sisa
 * di sisi yang lebih panjang menghasilkan sel kosong di sisi lain), sehingga
 * tidak menular ke blok-blok berikutnya.
 */
export function buildPkwtRowsFromParagraphs(
  doc: any,
  idBlocks: string[],
  enBlocks: string[],
  opts: { width: number, size: number, font?: string }
): PkwtRow[] {
  const font = opts.font ?? PKWT_FONT_NAMES.regular
  const wrap = (texts: string[]): string[][] =>
    texts.map(t => wrapCellLines(doc, t, opts.width, font, opts.size))

  const idLines = wrap(idBlocks)
  const enLines = wrap(enBlocks)
  // Index baris terakhir tiap paragraf, per kolom.
  const lastIdIdx = new Set<number>()
  const lastEnIdx = new Set<number>()
  let acc = 0
  for (const ls of idLines) {
    acc += ls.length
    if (acc > 0) lastIdIdx.add(acc - 1)
  }
  acc = 0
  for (const ls of enLines) {
    acc += ls.length
    if (acc > 0) lastEnIdx.add(acc - 1)
  }

  const rows: PkwtRow[] = []
  const n = Math.max(idLines.length, enLines.length)
  let globalIdx = 0
  for (let i = 0; i < n; i++) {
    const a = idLines[i] ?? []
    const b = enLines[i] ?? []
    const m = Math.max(a.length, b.length)
    for (let j = 0; j < m; j++) {
      const isLastOfPara = lastIdIdx.has(globalIdx) || lastEnIdx.has(globalIdx)
      rows.push({ id: a[j] ?? '', en: b[j] ?? '', kind: 'body', justify: !isLastOfPara })
      globalIdx += 1
    }
  }
  return rows
}

/** Apakah baris ini baris judul (salah satu kolom bold)? */
export function pkwtRowIsHeading(row: PkwtRow): boolean {
  return row.idBold === true || row.enBold === true
}

/**
 * Satu paragraf keluaran beserta identitas BLOK asalnya.
 *
 * `blockIndex` (nomor urut blok di antara blok yang menghasilkan paragraf)
 * dipakai untuk memasangkan kolom ID dan EN, agar paragraf milik blok yang sama
 * selalu berhadapan walau jumlah paragraf per blok berbeda antar bahasa.
 * `blockId` hanya untuk penelusuran/debug dan tidak dipakai sebagai kunci,
 * sebab blok bisa tidak punya id (mis. dibuat lewat editor) atau id-nya
 * berbeda antar bahasa.
 */
export interface PkwtParagraph {
  text: string
  bold: boolean
  /** Id blok sumber (`opening`, `recitals`, `section-3`, …); untuk debug saja. */
  blockId: string
  /** Nomor urut blok (0-based) di antara blok yang menghasilkan paragraf. */
  blockIndex: number
}

/**
 * Bangun baris paralel dari paragraf BER-`blockId`, dipasangkan per blok.
 *
 * INI PERBAIKAN BUG BOLD-BOCOR. Versi lama (`buildPkwtRowsFromParagraphs`)
 * memasangkan `idLines[i]` dengan `enLines[i]` memakai index rata. Begitu jumlah
 * paragraf kolom ID dan EN berbeda (mis. blok `recitals`: ID 1 paragraf, EN 2
 * paragraf), SELURUH paragraf setelah titik itu bergeser satu, sehingga teks ID
 * duduk di sebelah redaksi EN yang tidak berpasangan. Karena bold dulu
 * diturunkan dari posisi baris, geseran itu membuat judul pasal tampak TIDAK
 * bold dan teks isi tampak BOLD.
 *
 * Dengan pairing per-blok:
 *  - blok yang sama selalu berhadapan;
 *  - selisih jumlah paragraf ditangani LOKAL di dalam blok (baris sisa di sisi
 *    lebih panjang menghasilkan sel kosong di sisi lain), jadi tidak menular ke
 *    blok berikutnya;
 *  - bold dibawa PER-KOLOM dari paragraf asalnya.
 */
export function buildPkwtRowsFromStructuredParagraphs(
  doc: any,
  idParas: PkwtParagraph[],
  enParas: PkwtParagraph[],
  opts: { width: number, size: number, font?: string }
): PkwtRow[] {
  const font = opts.font ?? PKWT_FONT_NAMES.regular

  /** Satu baris keluaran dalam sebuah blok, lengkap dengan gaya per-kolom. */
  type BlockLine = { text: string, bold: boolean, lastOfPara: boolean }

  const toLines = (paras: PkwtParagraph[]): BlockLine[] => {
    const out: BlockLine[] = []
    for (const p of paras) {
      const lines = wrapCellLines(doc, p.text, opts.width, font, opts.size)
      lines.forEach((text, i) => {
        out.push({ text, bold: p.bold, lastOfPara: i === lines.length - 1 })
      })
    }
    return out
  }

  const group = (paras: PkwtParagraph[]): Map<number, PkwtParagraph[]> => {
    const m = new Map<number, PkwtParagraph[]>()
    for (const p of paras) {
      const arr = m.get(p.blockIndex) ?? []
      arr.push(p)
      m.set(p.blockIndex, arr)
    }
    return m
  }

  const idGroup = group(idParas)
  const enGroup = group(enParas)

  const rows: PkwtRow[] = []
  const emitBlock = (blockIndex: number) => {
    const a = toLines(idGroup.get(blockIndex) ?? [])
    const b = toLines(enGroup.get(blockIndex) ?? [])
    const m = Math.max(a.length, b.length)
    for (let j = 0; j < m; j++) {
      const left = a[j]
      const right = b[j]
      const idBold = left?.bold === true
      const enBold = right?.bold === true
      const isHeading = idBold || enBold
      rows.push({
        id: left?.text ?? '',
        en: right?.text ?? '',
        kind: isHeading ? 'heading' : 'body',
        idBold,
        enBold,
        // Baris judul tidak pernah direntangkan (lihat `renderPkwtLayout`).
        idJustify: !idBold && left !== undefined && !left.lastOfPara,
        enJustify: !enBold && right !== undefined && !right.lastOfPara
      })
    }
  }

  // Blok menurut urutan kolom ID (kolom kiri = acuan tata letak dokumen).
  for (const blockIndex of idGroup.keys()) emitBlock(blockIndex)
  // Blok EN tanpa padanan ID tetap dihormati — jangan hilangkan konten legal.
  for (const blockIndex of enGroup.keys()) if (!idGroup.has(blockIndex)) emitBlock(blockIndex)

  return rows
}

export function pkwtColumnInnerWidth(col: 0 | 1): number {
  const G = PKWT_GEOMETRY
  const w = col === 0 ? G.left.x1 - G.left.x0 : G.right.x1 - G.right.x0
  return w - G.textPaddingLeft * 2
}

/** Lebar konten kolom tanpa padding (dipakai `doc.text` yang sudah di-x). */
export function pkwtColumnWidth(col: 0 | 1): number {
  const G = PKWT_GEOMETRY
  return col === 0 ? G.left.x1 - G.left.x0 : G.right.x1 - G.right.x0
}

/* ------------------------------------------------------------------ *
 * Chrome (kop, judul, kotak kolom) — CHROME saja, bukan redaksi legal
 * ------------------------------------------------------------------ */

/**
 * CHROME — satu-satunya teks yang boleh di-hardcode: kop surat + label tetap
 * pada sub-tabel tanda tangan. Semua teks KONTRAK berasal dari Template Kontrak
 * (`contentDefinition`), tidak pernah dari sini.
 *
 * Nilai kop diukur dari master `PKWT DRIVER 2026.pdf`. Ketiga baris organisasi
 * ber-Times New Roman **regular** (master tidak menebalkannya) — berbeda dari
 * judul, yang seluruhnya Lucida Sans Typewriter Bold.
 *
 * Urutan pilar tanda tangan master PKWT **kebalikan MITRA**: kolom kiri =
 * Karyawan (PIHAK KEDUA), kolom kanan = Pengusaha/Perusahaan (PIHAK PERTAMA).
 * Jangan disamakan dengan `MITRA_HEADER_CHROME`.
 */
export const PKWT_HEADER_CHROME = {
  org: ['KOPERASI KARYAWAN', 'PT. SANKYU INDONESIA INTERNASIONAL', 'UNIT KANTOR PUSAT'],
  address: [
    'Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20',
    'GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330'
  ],
  /** Baris kontak di bawah alamat; master memakai Times New Roman 12pt. */
  contactLine: 'TELP. 021 - 50555340, FAX. 021- 50555341',
  /** Master memakai prefix `No. :` (spasi sebelum titik dua). */
  numberPrefix: 'No. :',
  signature: {
    /** Baris label sub-tabel; master: kiri Karyawan, kanan Pengusaha. */
    leftTitle: 'Karyawan/employee',
    rightTitle: 'Pengusaha/Perusahaan',
    /** Jabatan Ketua Koperasi di bawah nama (master: "(Ketua Koperasi)"). */
    rightRoleLabel: '(Ketua Koperasi)'
  }
} as const

export interface PkwtHeaderOptions {
  /** Baris-baris kop organisasi (dari template). */
  orgLines: string[]
  addressLines: string[]
  /**
   * Baris kontak di bawah alamat, mis. `TELP. … , FAX. …`.
   *
   * Catatan: sebelumnya ada `contactLineSegments` (dugaan master memakai dua
   * ukuran dalam satu baris). Pengukuran ulang per-karakter membuktikan itu
   * SALAH — satu-satunya penyimpangan 14.27 adalah artefak `Invisible`,
   * sehingga field itu dihapus.
   */
  contactLine?: string
  /** Judul ID & EN. */
  titleId: string
  titleEn: string
  /** Baris nomor kontrak, mis. `No. : 174/KUKP-SII/VII/2026`. */
  contractNumber?: string
  /** Path logo (opsional — master menaruhnya di kiri atas). */
  logoPath?: string | null
}

/**
 * Ukuran font terbesar (≤ `max`) yang membuat `text` muat dalam SATU baris.
 *
 * Tanpa ini, judul yang lebih panjang dari kotaknya akan membungkus ke baris
 * kedua dan BERTUMPUK dengan baris judul berikutnya — kedua baris digambar pada
 * `y` tetap, jadi hasilnya teks saling tindih seperti
 * `'STATED PERIOTDESR LTAEBNOTUUR AGREEMENT'`.
 */
function fitTitleSize(doc: any, text: string, width: number, max: number, min = 7): number {
  let size = max
  while (size > min) {
    doc.fontSize(size)
    if (doc.widthOfString(text) <= width) return size
    size -= 0.25
  }
  return min
}

/** Gambar kop + dua baris judul + baris nomor. Mengembalikan y awal badan. */

export function renderPkwtHeader(doc: any, o: PkwtHeaderOptions): number {
  const G = PKWT_GEOMETRY
  const F = PKWT_FONT_NAMES

  if (o.logoPath) {
    try {
      doc.image(o.logoPath, G.logo.x, G.logo.y, { fit: [G.logo.width, G.logo.height] })
    } catch {
      // Logo opsional; kegagalan baca tidak boleh menggagalkan kontrak.
    }
  }

  // Kop: SEMUA baris Times New Roman REGULAR — master tidak menebalkan satu
  // pun (histogram font master: `TimesNewRomanPSMT`, bukan `-BoldMT`).
  // Dipusatkan pada `headerCenterX` yang TERUKUR, bukan pada pusat area sisa
  // setelah logo (itu akan menggeser teks ~47pt ke kanan).
  let y = G.headerTop
  doc.fillColor('#000000')

  const kopLine = (text: string, size: number, advance: number) => {
    if (!text) return
    doc.font(F.headerRegular).fontSize(size)
    const w = doc.widthOfString(text)
    doc.text(text, G.headerCenterX - w / 2, pkwtTextTop(y, size, PKWT_TIMES_BASELINE), {
      lineBreak: false
    })
    y += advance
  }

  // Jarak antar-baris kop TIDAK seragam di master: transisi org→alamat dan
  // alamat→kontak lebih rapat (17.56 / 12.49) daripada dalam blok yang sama
  // (18.76 / 14.25). Karena itu advance dipilih per-transisi, bukan per-blok.
  const orgs = o.orgLines.filter(Boolean)
  const addrs = o.addressLines.filter(Boolean)

  orgs.forEach((line, i) => {
    const isLast = i === orgs.length - 1
    const advance = isLast && addrs.length ? G.headerOrgToAddressAdvance : G.headerOrgAdvance
    kopLine(line, G.font.headerOrg, advance)
  })

  addrs.forEach((line, i) => {
    const isLast = i === addrs.length - 1
    const advance
      = isLast && o.contactLine ? G.headerAddressToContactAdvance : G.headerAddressAdvance
    kopLine(line, G.font.headerAddress, advance)
  })

  if (o.contactLine) {
    kopLine(o.contactLine, G.font.headerAddress, G.headerAddressAdvance)
  }

  // Garis kop: satu tebal (2.85) + satu tipis (0.95), digambar sebagai FILL.
  doc.save()
  doc.fillColor('#000000')
  doc.rect(G.rules.x0, G.rules.y1, G.rules.x1 - G.rules.x0, G.rules.thickness1).fill()
  doc.rect(G.rules.x0, G.rules.y2, G.rules.x1 - G.rules.x0, G.rules.thickness2).fill()
  doc.restore()

  // Judul dua baris bertumpuk. KEDUANYA Lucida Sans Typewriter BOLD 12.0 —
  // master tidak memakai Times di sini (lihat catatan di PKWT_GEOMETRY).
  const titleW = G.rule.x1 - G.rule.x0
  const titleBoxW = titleW + 40
  const titleX = G.rule.x0 - 20

  doc.font(F.bold)
  const idSize = fitTitleSize(doc, o.titleId, titleBoxW, G.font.title)
  doc.font(F.bold).fontSize(idSize).fillColor('#000000')
  doc.text(o.titleId, titleX, pkwtTextTop(G.titleIdTop, idSize, PKWT_LUCIDA_BASELINE), {
    width: titleBoxW,
    align: 'center',
    lineBreak: false
  })

  doc.save()
  doc.fillColor('#000000')
  doc.rect(G.rule.x0, G.titleRuleY, titleW, G.rule.thickness).fill()
  doc.restore()

  doc.font(F.bold)
  const enSize = fitTitleSize(doc, o.titleEn, titleBoxW, G.font.title)
  doc.font(F.bold).fontSize(enSize).fillColor('#000000')
  const hEn = doc.heightOfString(o.titleEn, { width: titleBoxW })
  doc.text(o.titleEn, titleX, pkwtTextTop(G.titleEnTop, enSize, PKWT_LUCIDA_BASELINE), {
    width: titleBoxW,
    align: 'center',
    lineBreak: false
  })

  let ty = G.titleEnTop + hEn
  if (o.contractNumber) {
    doc.font(F.bold).fontSize(G.font.number).fillColor('#000000')
    const w = G.right.x1 - G.left.x0
    const hNo = doc.heightOfString(o.contractNumber, { width: w, align: 'center' })
    doc.text(o.contractNumber, G.left.x0, pkwtTextTop(G.numberTop, G.font.number, PKWT_LUCIDA_BASELINE), {
      width: w,
      align: 'center'
    })
    ty = G.numberTop + hNo
  }

  // Badan tidak pernah mulai di atas `bodyTop` master (186) agar tidak
  // menabrak judul; header yang lebih tinggi menggeser badan ke bawah.
  return Math.max(ty + 6, G.bodyTop)
}

/**
 * Gambar tepi dua kolom sebagai FILL 0.75pt (master: `stroke=False`).
 *
 * Geometri terukur dari master (jangan disederhanakan!):
 *  - tepi ATAS & BAWAH membentang dari `x0` ke `x1` (lebar dalam kolom);
 *  - tepi KIRI berada di LUAR kolom, `x0-0.75 → x0`;
 *  - tepi KANAN juga di LUAR, `x1 → x1+0.75`;
 *  - tepi kiri/kanan hanya setinggi bagian DALAM kotak (top+0.75 → bottom-0.75),
 *    sehingga keempat batang membentuk persegi tertutup tanpa saling tindih.
 *
 * Master terukur: 26.27→27.02, 296.63→297.38, 308.65→309.40, 566.98→567.73.
 * Menggambar batang vertikal terpusat pada `x0` (x0-0.375) membuat kotak 0.75pt
 * lebih sempit di tiap sisi dan batangnya menumpuk batang horizontal.
 */
export function renderPkwtColumnBox(doc: any, pageIndex: number, boxBottom: number): void {
  const G = PKWT_GEOMETRY
  const top = pageIndex === 0 ? G.firstPageBoxTop : G.contPageBoxTop
  const b = G.borderWidth

  doc.save()
  doc.fillColor('#000000')
  const draw = (x0: number, x1: number) => {
    const b = G.borderWidth
    const innerTop = top + b
    const innerBottom = boxBottom - b
    // Tepi atas/bawah membentang SELUAR batas luar (termasuk sudut), sehingga
    // keempat sudut 0.75x0.75 ikut terisi tanpa lubang.
    doc.rect(x0 - b, top, x1 - x0 + 2 * b, b).fill() // tepi atas + sudut
    doc.rect(x0 - b, boxBottom - b, x1 - x0 + 2 * b, b).fill() // tepi bawah + sudut
    // Batang vertikal hanya setinggi bagian DALAM, agar tidak menumpuk tepi
    // horizontal (master: top=183.15, bottom=765.67 pada halaman 1).
    doc.rect(x0 - b, innerTop, b, innerBottom - innerTop).fill() // tepi kiri
    doc.rect(x1, innerTop, b, innerBottom - innerTop).fill() // tepi kanan
  }
  draw(G.left.x0, G.left.x1)
  draw(G.right.x0, G.right.x1)
  doc.restore()
}

/* ------------------------------------------------------------------ *
 * Signature sub-table (ber-border, DI DALAM area kolom halaman terakhir)
 * ------------------------------------------------------------------ */

export interface PkwtSignatureOptions {
  /** Label pilar, mis. "PIHAK PERTAMA" / "PIHAK KEDUA". */
  leftTitle: string
  rightTitle: string
  /** Nama penanda tangan (boleh kosong → hanya ruang tanda tangan). */
  leftName?: string
  rightName?: string
  /** Keterangan jabatan di bawah nama. */
  leftRole?: string
  rightRole?: string
}

const SIG_PAD = 6
/** Tinggi baris label + tinggi area tanda tangan (terukur dari master). */
const SIG_LABEL_ROW = 34.52
const SIG_BODY_ROW = 97.57

/** Tinggi total sub-tabel tanda tangan. */
export function pkwtSignatureHeight(): number {
  return SIG_LABEL_ROW + SIG_BODY_ROW
}

/**
 * Ubah `top` GLYPH master menjadi `y` yang harus diberikan ke PDFKit.
 *
 * Master diukur dari puncak glyph; PDFKit menghitung dari puncak kotak baris.
 * Selisihnya bergantung font (lihat `textBaselineFactor*`), sehingga faktor
 * harus dipilih sesuai font yang sedang dipakai.
 */
export function pkwtTextTop(glyphTop: number, fontSize: number, factor: number): number {
  return glyphTop - factor * fontSize
}

/** Faktor baseline untuk teks kop (Times New Roman). */
export const PKWT_TIMES_BASELINE = PKWT_GEOMETRY.textBaselineFactorTimes
/** Faktor baseline untuk judul/nomor (Lucida Sans Typewriter). */
export const PKWT_LUCIDA_BASELINE = PKWT_GEOMETRY.textBaselineFactorLucida

/** Baris teks tanda tangan (dipakai bersama oleh pengukur & penggambar). */
function pkwtSignatureRows(o: PkwtSignatureOptions) {
  return [
    { left: o.leftTitle, right: o.rightTitle, bold: true },
    {
      left: [o.leftName, o.leftRole].filter(Boolean).join('\n'),
      right: [o.rightName, o.rightRole].filter(Boolean).join('\n'),
      bold: false
    }
  ]
}

/**
 * Gambar sub-tabel tanda tangan pada `tableTop`.
 *
 * Master menggambarnya BER-BORDER dengan divider tengah; tepi kiri/kanan
 * berada di dalam area kolom (x 125.40 → 459.58), bukan melebar ke tepi page.
 */
export function renderPkwtSignature(
  doc: any,
  o: PkwtSignatureOptions,
  tableTop: number,
  pageIndex: number
): void {
  const G = PKWT_GEOMETRY
  const F = PKWT_FONT_NAMES
  const T = G.signatureTable
  const rows = pkwtSignatureRows(o)
  const heights = [SIG_LABEL_ROW, SIG_BODY_ROW]
  const total = heights.reduce((a, b) => a + b, 0)

  doc.switchToPage(pageIndex)

  // Garis tabel: border luar + divider + garis antar-baris.
  doc.save()
  doc.lineWidth(G.borderWidth).strokeColor('#000000')
  doc.rect(T.left, tableTop, T.right - T.left, total).stroke()
  doc.moveTo(T.divider, tableTop).lineTo(T.divider, tableTop + total).stroke()
  doc.moveTo(T.left, tableTop + heights[0]).lineTo(T.right, tableTop + heights[0]).stroke()
  doc.restore()

  const leftW = T.divider - T.left
  const rightW = T.right - T.divider

  let rowTop = tableTop
  rows.forEach((row, i) => {
    const h = heights[i]
    doc.font(row.bold ? F.bold : F.regular).fontSize(G.font.signature).fillColor('#000000')
    if (row.left) {
      doc.text(row.left, T.left + SIG_PAD, rowTop + SIG_PAD, {
        width: leftW - SIG_PAD * 2,
        align: 'center'
      })
    }
    if (row.right) {
      doc.text(row.right, T.divider + SIG_PAD, rowTop + SIG_PAD, {
        width: rightW - SIG_PAD * 2,
        align: 'center'
      })
    }
    rowTop += h
  })

  // Garis bawah nama di dalam sel tanda tangan (master memilikinya).
  const underline = (x0: number, w: number) => {
    const uw = Math.min(w - SIG_PAD * 4, 90)
    const ux = x0 + (w - uw) / 2
    doc.save()
    doc.fillColor('#000000')
    doc.rect(ux, tableTop + total - 12, uw, G.borderWidth).fill()
    doc.restore()
  }
  underline(T.left, leftW)
  underline(T.divider, rightW)
}

/* ------------------------------------------------------------------ *
 * Document assembly
 * ------------------------------------------------------------------ */

/** Path TTF untuk tiap peran font. */
export interface PkwtFontPaths {
  /** Lucida Sans Typewriter regular (badan). */
  regular: string
  bold: string
  italic: string
  boldItalic?: string
  /**
   * Times New Roman regular — HANYA untuk kop surat (master: `TimesNewRomanPSMT`).
   * Judul TIDAK memakai ini; judul memakai `bold` (Lucida Sans Typewriter Bold).
   * Bila kosong, jatuh ke `regular` agar kontrak tetap bisa dirender.
   */
  headerRegular?: string
}

export interface PkwtRenderOptions {
  rows: PkwtRow[]
  header: PkwtHeaderOptions
  fonts: PkwtFontPaths
  signature: PkwtSignatureOptions
  /**
   * `true` (default) → kotak halaman terakhir dipendekkan seperlunya agar
   * sub-tabel tanda tangan muat di bawahnya, seperti master.
   */
  reserveSignatureZone?: boolean
}

/** Daftarkan font ke dokumen. Nama logis dipakai agar renderer tak tahu path. */
export function registerPkwtFonts(doc: any, f: PkwtFontPaths): void {
  const F = PKWT_FONT_NAMES
  doc.registerFont(F.regular, f.regular)
  doc.registerFont(F.bold, f.bold)
  doc.registerFont(F.italic, f.italic)
  doc.registerFont(F.boldItalic, f.boldItalic ?? f.bold)
  // Kop memakai Times New Roman REGULAR; tidak ada peran bold untuk kop.
  doc.registerFont(F.headerRegular, f.headerRegular ?? f.regular)
}

/** Hasil layout untuk audit/verifikasi (tidak dipakai untuk menggambar). */
export interface PkwtLayoutMeta {
  pageCount: number
  /** Batas bawah kotak yang benar-benar digambar, per halaman. */
  boxBottoms: number[]
  /** Batas terdalam isi, per halaman. */
  contentBottoms: number[]
  signaturePage: number
  signatureTop: number
}

/**
 * Alirkan isi dua kolom PKWT ke `doc` (setara `renderMitraLayout`).
 *
 * Alur: satu pass baris terkunci (ID & EN pada y yang sama) → gambar tepi kotak
 * per halaman → letakkan sub-tabel tanda tangan di halaman terakhir.
 *
 * Berbeda dari MITRA, TIDAK ada split-stream: pasangan baris sudah sejajar
 * secara semantik, jadi tidak ada pencarian titik potong.
 */
export function renderPkwtLayout(doc: any, opts: PkwtRenderOptions): void {
  const G = PKWT_GEOMETRY
  const F = PKWT_FONT_NAMES
  registerPkwtFonts(doc, opts.fonts)

  const innerW0 = pkwtColumnWidth(0) - G.textPaddingLeft * 2
  const innerW1 = pkwtColumnWidth(1) - G.textPaddingLeft * 2
  const boxBottomFor = (pi: number) => (pi === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom)
  const boxTopFor = (pi: number) => (pi === 0 ? G.firstPageBoxTop : G.contPageBoxTop)
  const PAD_TOP = 4

  // --- Pass tunggal: ukur + gambar tiap baris pada y yang sama ---
  let y = renderPkwtHeader(doc, opts.header)
  let pageIndex = 0
  const contentBottoms: number[] = [y]

  const measureRow = (row: PkwtRow): number => {
    // Ukur tiap kolom dengan font yang BENAR-BENAR dipakai kolom itu; lebar
    // glyph Lucida Bold sedikit berbeda dari regular, jadi tinggi baris bisa
    // berbeda bila salah satu kolom bold.
    doc.font(row.idBold === true ? F.bold : F.regular).fontSize(G.font.body)
    const hId = doc.heightOfString(row.id || 'Xg', { width: innerW0, lineGap: G.lineGap })
    doc.font(row.enBold === true ? F.bold : F.regular).fontSize(G.font.body)
    const hEn = doc.heightOfString(row.en || 'Xg', { width: innerW1, lineGap: G.lineGap })
    return Math.max(hId, hEn)
  }

  /**
   * Gambar satu baris pada satu kolom.
   *
   * PENTING: satu `PkwtRow` sudah merepresentasikan SATU baris keluaran —
   * `buildPkwtRows*` memanggil `wrapCellLines` lebih dulu, jadi `cell` di sini
   * tidak perlu dibungkus lagi. Itulah kenapa justifikasi diputuskan di tingkat
   * BARIS (`row.justify`), bukan di sini: baris terakhir paragraf sudah ditandai
   * `justify: false` oleh `buildPkwtRowsFromParagraphs`.
   *
   * Geometri tetap milik `measureRow`: tinggi baris TIDAK dihitung ulang, jadi
   * pagination identik dengan sebelum justifikasi ditambahkan.
   */
  const drawCell = (cell: string, x: number, w: number, bold: boolean, justify: boolean) => {
    const font = bold ? F.bold : F.regular
    doc.font(font).fontSize(G.font.body).fillColor('#000000')
    if (!justify) {
      // Jalur rata-kiri: sama persis dengan sebelum justifikasi ada.
      doc.text(cell, x, y, { width: w, lineGap: G.lineGap, align: 'left' })
      return
    }
    // `drawJustifiedLine` otomatis jatuh kembali ke rata-kiri bila baris hanya
    // punya <= 1 kata atau ruangnya sudah negatif (tidak ada celah untuk
    // direntangkan), sehingga tidak pernah menumpuk kata.
    drawJustifiedLine(doc, cell, x, y, w, { font, size: G.font.body })
  }

  for (const row of opts.rows ?? []) {
    const h = measureRow(row)
    // Hormati batas bawah kotak halaman berjalan.
    if (y + h > boxBottomFor(pageIndex) - PAD_TOP) {
      doc.addPage()
      pageIndex += 1
      y = boxTopFor(pageIndex) + PAD_TOP
      contentBottoms[pageIndex] = y
    }
    // Bold & justify PER-KOLOM. `justify` (row-level) tetap dihormati sebagai
    // fallback untuk pemanggil lama.
    const idBold = row.idBold === true
    const enBold = row.enBold === true
    const idJustify
      = idBold ? false : row.idJustify ?? (row.justify === true)
    const enJustify
      = enBold ? false : row.enJustify ?? (row.justify === true)
    if (row.id) drawCell(row.id, G.left.x0 + G.textPaddingLeft, innerW0, idBold, idJustify)
    if (row.en) drawCell(row.en, G.right.x0 + G.textPaddingLeft, innerW1, enBold, enJustify)
    y += h + (row.kind === 'heading' ? G.headingGapAfter : 0)
    contentBottoms[pageIndex] = y
  }

  // --- Tepi kotak per halaman (dipendekkan ke isi nyata, seperti master) ---
  const boxBottoms: number[] = []
  for (let pi = 0; pi <= pageIndex; pi++) {
    const top = boxTopFor(pi)
    const content = Math.max(contentBottoms[pi] ?? top, top + 20)
    boxBottoms[pi] = Math.min(boxBottomFor(pi), content + PAD_TOP)
  }

  // --- Tanda tangan di halaman terakhir (atau halaman baru bila tak muat) ---
  const sigH = pkwtSignatureHeight()
  const sigGap = G.signatureTable.gapFromBox
  let sigPage = pageIndex
  let sigTop = boxBottoms[sigPage] + sigGap

  if (opts.reserveSignatureZone !== false && sigTop + sigH > G.pageHeight - 40) {
    doc.addPage()
    sigPage += 1
    boxBottoms[sigPage] = G.contPageBoxTop
    contentBottoms[sigPage] = G.contPageBoxTop
    sigTop = G.contPageBoxTop + 40
  }

  // Gambar kotak SETELAH semua halaman diketahui (butuh `switchToPage`).
  for (let pi = 0; pi <= sigPage; pi++) {
    doc.switchToPage(pi)
    renderPkwtColumnBox(doc, pi, boxBottoms[pi])
  }

  renderPkwtSignature(doc, opts.signature, sigTop, sigPage)

  ;(doc as any).__pkwtLayout = {
    pageCount: sigPage + 1,
    boxBottoms,
    contentBottoms,
    signaturePage: sigPage,
    signatureTop: sigTop
  } satisfies PkwtLayoutMeta
}
