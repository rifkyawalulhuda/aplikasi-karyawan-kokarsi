/**
 * Uji REGRESI geometris engine PKWT.
 *
 * Uji ini merender PDF nyata lalu MENGUKUR ulang hasilnya memakai pdfplumber,
 * membandingkannya dengan angka master. Pendekatan "render lalu ukur" dipakai
 * karena bug yang pernah terjadi (kotak kolom salah y, badan tidak justified)
 * tidak terlihat dari unit test biasa — hanya kelihatan dari geometri PDF.
 *
 * Bila `pdfplumber` tidak tersedia, uji geometris di-skip dengan jelas; uji
 * yang tidak butuh Python tetap berjalan.
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  PKWT_GEOMETRY,
  PKWT_HEADER_CHROME,
  buildPkwtRows,
  buildPkwtRowsFromStructuredParagraphs,
  pkwtColumnInnerWidth,
  pkwtSignatureHeight,
  resolveCellAlign
} from './pkwt-layout.engine'
import { parseInlineRuns } from './inline-marks'
import { createPkwtPdfBuffer, resolvePkwtFonts } from './pkwt-document.renderer'
import { PKWT_PREVIEW_VALUES } from './pkwt-preview-sample'
import {
  CONTRACT_DOCUMENT_DEFINITIONS,
  getContractDocumentDefinition
} from './contract-document-definitions'
import { definitionToContentDefinition, type SeedContentDefinition } from '../contract-templates/default-template-definition'

describe('PKWT layout engine — geometri master', () => {
  it('geometri cocok dengan hasil pengukuran master', () => {
    const G = PKWT_GEOMETRY
    expect(G.pageWidth).toBeCloseTo(595.5, 1)
    expect(G.pageHeight).toBeCloseTo(842.25, 1)
    expect(G.left.x0).toBeCloseTo(27.02, 2)
    expect(G.left.x1).toBeCloseTo(296.62, 2)
    expect(G.right.x0).toBeCloseTo(309.4, 2)
    expect(G.right.x1).toBeCloseTo(566.98, 2)
    // Kotak halaman 1 mulai DI BAWAH judul, bukan di garis kop (125.42).
    expect(G.firstPageBoxTop).toBeCloseTo(182.4, 2)
    expect(G.firstPageBoxTop).toBeGreaterThan(G.rules.y1)
    expect(G.firstPageBoxBottom).toBeCloseTo(766.42, 2)
    expect(G.contPageBoxTop).toBeCloseTo(31.53, 2)
    expect(G.contPageBoxBottom).toBeCloseTo(767.92, 2)
  })

  it('ukuran font sesuai master (judul 12, nomor 9.75, badan 9)', () => {
    const G = PKWT_GEOMETRY
    expect(G.font.body).toBe(9)
    expect(G.font.heading).toBe(9)
    // Terukur: judul = Lucida Sans Typewriter BOLD 12.0 (bukan TNR 14.27).
    expect(G.font.title).toBe(12)
    expect(G.font.number).toBe(9.75)
    expect(G.font.signature).toBe(9.75)
    // Kop: 14.27 untuk baris organisasi, 12 untuk baris alamat.
    expect(G.font.headerOrg).toBeCloseTo(14.27, 2)
    expect(G.font.headerAddress).toBe(12)
  })

  it('blok judul memakai geometri master (termasuk koreksi y)', () => {
    const G = PKWT_GEOMETRY
    expect(G.titleIdTop).toBeCloseTo(144.3, 2)
    expect(G.titleRuleY).toBeCloseTo(155.4, 2)
    expect(G.titleEnTop).toBeCloseTo(158.6, 2)
    expect(G.numberTop).toBeCloseTo(172.4, 2)
    expect(G.bodyTop).toBe(186)
    // Judul ID harus muat SATU baris pada lebar kotaknya.
    expect(G.rule.x1 - G.rule.x0).toBeGreaterThan(200)
  })

  it('kop dipusatkan pada x terukur, bukan pusat area sisa', () => {
    const G = PKWT_GEOMETRY
    expect(G.headerCenterX).toBeCloseTo(301.14, 2)
    // Pusat area sisa setelah logo ≈ 348.75; memakai itu akan menggeser teks.
    const leftoverCenter = (G.logo.x + G.logo.width + G.rules.x1) / 2
    expect(Math.abs(leftoverCenter - G.headerCenterX)).toBeGreaterThan(40)
  })

  it('tinggi blok tanda tangan = label + area tanda tangan master', () => {
    // Master: baris label 34.52 + area tanda tangan 97.57.
    expect(pkwtSignatureHeight()).toBeCloseTo(34.52 + 97.57, 2)
    expect(PKWT_GEOMETRY.signatureTable.height).toBeCloseTo(97.57, 2)
  })

  it('lebar dalam kolom positif dan lebih kecil dari lebar kotak', () => {
    const w0 = pkwtColumnInnerWidth(0)
    const w1 = pkwtColumnInnerWidth(1)
    expect(w0).toBeGreaterThan(200)
    expect(w1).toBeGreaterThan(200)
    expect(w0).toBeLessThan(PKWT_GEOMETRY.left.x1 - PKWT_GEOMETRY.left.x0)
    expect(w1).toBeLessThan(PKWT_GEOMETRY.right.x1 - PKWT_GEOMETRY.right.x0)
  })
})

describe('buildPkwtRows — baris ID/EN terkunci', () => {
  // Stub minimal: PDFKit hanya dipakai lewat `widthOfString` di `wrapCellLines`.
  const stubDoc = {
    font() { return this },
    fontSize() { return this },
    widthOfString(s: string) { return String(s).length * 5 }
  }

  it('memasangkan baris ID dan EN pada index yang sama', () => {
    const rows = buildPkwtRows(
      stubDoc,
      ['baris satu id', 'baris dua id'],
      ['line one en', 'line two en'],
      { width: 1000, size: 9 }
    )
    expect(rows.length).toBe(2)
    expect(rows[0].id).toBe('baris satu id')
    expect(rows[0].en).toBe('line one en')
    expect(rows[1].id).toBe('baris dua id')
    expect(rows[1].en).toBe('line two en')
  })

  it('sisi yang lebih pendek menghasilkan sel kosong, bukan pergeseran', () => {
    const rows = buildPkwtRows(stubDoc, ['hanya id'], [], { width: 1000, size: 9 })
    expect(rows.length).toBe(1)
    expect(rows[0].id).toBe('hanya id')
    expect(rows[0].en).toBe('')
  })

  it('TIDAK membuang spasi antar kata (klaim AtasPekerjaan tidak berlaku di pemecahan baris)', () => {
    const rows = buildPkwtRows(
      stubDoc,
      ['3. Atas Pekerjaan yang dilakukan PIHAK KEDUA'],
      [],
      { width: 1000, size: 9 }
    )
    const joined = rows.map(r => r.id).join(' ')
    expect(joined).toContain('3. Atas Pekerjaan yang dilakukan PIHAK KEDUA')
    expect(joined).not.toContain('AtasPekerjaan')
  })
})

describe('buildPkwtRowsFromStructuredParagraphs — pasangan ID/EN per blok', () => {
  const stubDoc = {
    font() { return this },
    fontSize() { return this },
    widthOfString(s: string) { return String(s).length * 5 }
  }
  const opts = { width: 1000, size: 9 }

  const para = (blockId: string, blockIndex: number, text: string, bold = false) =>
    ({ blockId, blockIndex, text, bold })

  it('selisih jumlah paragraf di dalam satu blok TIDAK menggeser blok berikutnya', () => {
    // Skenario nyata (template 17142): blok `recitals` kolom ID 1 paragraf,
    // kolom EN 2 paragraf. Dulu ini menggeser SELURUH dokumen satu baris.
    const idParas = [
      para('opening', 0, 'opening id'),
      para('recitals', 1, 'recitals id', true),
      para('recitals', 1, 'recital id 1'),
      para('role', 2, 'role id', true),
      para('role', 2, 'role body id')
    ]
    const enParas = [
      para('opening', 0, 'opening en'),
      para('recitals', 1, 'recitals en', true),
      para('recitals', 1, 'recital en 1'),
      para('recitals', 1, 'recital en 2'),
      para('role', 2, 'role en', true),
      para('role', 2, 'role body en')
    ]

    const rows = buildPkwtRowsFromStructuredParagraphs(stubDoc, idParas, enParas, opts)

    // Blok `role` harus tetap berhadapan meski `recitals` beda panjang.
    const roleHead = rows.findIndex(r => r.id === 'role id')
    expect(roleHead).toBeGreaterThanOrEqual(0)
    expect(rows[roleHead].en).toBe('role en')
    expect(rows[roleHead].idBold).toBe(true)
    expect(rows[roleHead].enBold).toBe(true)

    // Baris sisa `recitals` kolom EN menghasilkan sel ID kosong, bukan geseran.
    const recital2 = rows.findIndex(r => r.en === 'recital en 2')
    expect(recital2).toBeGreaterThanOrEqual(0)
    expect(rows[recital2].id).toBe('')

    // Tidak ada teks ID yang hilang atau terduplikasi.
    const ids = rows.map(r => r.id).filter(Boolean)
    expect(ids).toEqual(['opening id', 'recitals id', 'recital id 1', 'role id', 'role body id'])
    const ens = rows.map(r => r.en).filter(Boolean)
    expect(ens).toEqual([
      'opening en', 'recitals en', 'recital en 1', 'recital en 2', 'role en', 'role body en'
    ])
  })

  it('bold ditentukan PER-KOLOM, tidak bocor dari kolom sebelah', () => {
    // Judul di kolom ID, teks isi di kolom EN pada baris yang sama.
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'Pasal 1', true), para('a', 0, 'isi id')],
      [para('a', 0, 'Article 1', true), para('a', 0, 'body en')],
      opts
    )
    expect(rows[0].idBold).toBe(true)
    expect(rows[0].enBold).toBe(true)
    expect(rows[1].idBold).toBe(false)
    expect(rows[1].enBold).toBe(false)
  })

  it('blok EN tanpa padanan ID tetap dirender (konten legal tidak hilang)', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'id saja')],
      [para('a', 0, 'en a'), para('b', 1, 'en b')],
      opts
    )
    expect(rows.map(r => r.en)).toEqual(['en a', 'en b'])
    expect(rows[1].id).toBe('')
  })
})

describe('PKWT layout engine — jarak antar-blok', () => {
  const stubDoc = {
    font() { return this },
    fontSize() { return this },
    widthOfString(s: string) { return String(s).length * 5 }
  }
  // `stubDoc.widthOfString` = 5pt/char, jadi setiap teks pendek di bawah
  // `opts.width` menyatu menjadi SATU baris (aturan `cur === ''` pada
  // `wrapCellLines` memaksa minimal satu kata per baris). Karena itu satu
  // paragraf == satu baris, dan index baris keluaran == index input.
  const opts = { width: 1000, size: 9 }
  const para = (blockId: string, blockIndex: number, text: string, bold = false) =>
    ({ blockId, blockIndex, text, bold })

  it('konstanta gap benar-benar hidup (dulu dideklarasikan tanpa satu pun pemakai)', () => {
    // `paragraphGap` pernah ada di geometri tetapi TIDAK PERNAH dibaca renderer,
    // sehingga blok tercetak rapat. Tes ini menahan pemutusan sambungan itu.
    expect(PKWT_GEOMETRY.blockGap).toBeGreaterThan(0)
    // 8 = nilai terbesar yang masih menahan dokumen pada 4 halaman untuk
    // keempat varian PKWT bawaan SETELAH blok identitas PIHAK KEDUA dikodekan
    // (sebelumnya 10; blok itu memakan seluruh sisa anggaran halaman).
    // Ambangnya tajam: 8.5 sudah mendorong semuanya ke 5 halaman.
    expect(PKWT_GEOMETRY.blockGap).toBe(8)
    // Antar-blok harus JELAS lebih besar daripada jarak setelah judul, kalau
    // tidak batas blok tidak terbaca sebagai pemisah (bug yang dilaporkan:
    // "belum melihat spacing antar blok" walau gap 4pt sudah tercetak).
    expect(PKWT_GEOMETRY.blockGap).toBeGreaterThan(PKWT_GEOMETRY.headingGapAfter)
  })

  it('gap hanya di baris PERTAMA tiap blok, tidak di baris pembuka dokumen', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'aa'), para('b', 1, 'bb'), para('c', 2, 'cc')],
      [para('a', 0, '11'), para('b', 1, '22'), para('c', 2, '33')],
      opts
    )
    expect(rows.map(r => r.id)).toEqual(['aa', 'bb', 'cc'])
    expect(rows[0].gapBefore).toBeUndefined()
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
    expect(rows[2].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
  })

  it('baris lanjutan dalam SATU blok tidak diberi jarak (daftar tetap utuh)', () => {
    // Blok `list` mengalirkan banyak paragraf dengan `blockIndex` sama; mereka
    // satu daftar dan justru HARUS rapat.
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('list', 0, 'satu'), para('list', 0, 'dua'), para('list', 0, 'tiga')],
      [para('list', 0, 'one'), para('list', 0, 'two'), para('list', 0, 'three')],
      opts
    )
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.gapBefore)).toEqual([undefined, undefined, undefined])
  })

  it('jarak dipasang per BLOK, bukan per paragraf', () => {
    // Kasus nyata: blok `list` 3 item di antara dua blok lain. Kalau jaraknya
    // salah dipasang per paragraf, akan muncul 4 jarak, bukan 2.
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [
        para('a', 0, 'buka'),
        para('list', 1, 'satu'),
        para('list', 1, 'dua'),
        para('list', 1, 'tiga'),
        para('b', 2, 'tutup')
      ],
      [
        para('a', 0, 'open'),
        para('list', 1, 'one'),
        para('list', 1, 'two'),
        para('list', 1, 'three'),
        para('b', 2, 'close')
      ],
      opts
    )
    expect(rows.map(r => r.id)).toEqual(['buka', 'satu', 'dua', 'tiga', 'tutup'])
    const gapped = rows.map((r, i) => (r.gapBefore ? i : -1)).filter(i => i >= 0)
    // Baris pembuka blok ke-2 (`satu`) dan blok ke-3 (`tutup`).
    expect(gapped).toEqual([1, 4])
  })

  it('blok yang tidak menghasilkan baris tidak menyerap jarak (start duplikat dibuang)', () => {
    // Blok `title`/`signature` tidak menghasilkan baris, sehingga blok
    // berikutnya menyumbang start yang SAMA; tanpa dedup jaraknya mengena
    // baris yang salah.
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'aa'), para('b', 1, 'bb')],
      [para('a', 0, '11')],
      opts
    )
    expect(rows.map(r => r.id)).toEqual(['aa', 'bb'])
    expect(rows[0].gapBefore).toBeUndefined()
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
  })

  it('`buildPkwtRows` (jalur stream) menandai batas paragraf sebagai batas blok', () => {
    // Di jalur ini elemen input ADALAH satu paragraf, bukan satu blok: API-nya
    // hanya menerima string plat, tanpa identitas blok. Jadi dua elemen =
    // dua blok, dan jaraknya jatuh di baris pembuka elemen ke-2 dan ke-3.
    const rows = buildPkwtRows(stubDoc, ['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], opts)
    expect(rows).toHaveLength(3)
    expect(rows[0].gapBefore).toBeUndefined()
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
    expect(rows[2].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
  })
})

describe('PKWT layout engine — spaceAfter per blok (aditif di atas blockGap)', () => {
  const stubDoc = {
    font() { return this },
    fontSize() { return this },
    widthOfString(s: string) { return String(s).length * 5 }
  }
  const opts = { width: 1000, size: 9 }
  const para = (blockIndex: number, text: string, spaceAfter?: number, bold = false) =>
    ({ blockId: `b${blockIndex}`, blockIndex, text, bold, spaceAfter })

  it('menambah gapBefore blok berikutnya tepat sebesar spaceAfter', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para(0, 'aa', 12), para(1, 'bb'), para(2, 'cc')],
      [para(0, '11', 12), para(1, '22'), para(2, '33')],
      opts
    )
    expect(rows.map(r => r.id)).toEqual(['aa', 'bb', 'cc'])
    // Blok 0: baris pertama dokumen (tanpa gap). Blok 1: blockGap + 12.
    expect(rows[0].gapBefore).toBeUndefined()
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap + 12)
    // Blok 1 tidak punya spaceAfter → blok 2 hanya blockGap.
    expect(rows[2].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
  })

  it('tanpa spaceAfter, gap tetap persis blockGap (tidak ada regresi)', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para(0, 'aa'), para(1, 'bb')],
      [para(0, '11'), para(1, '22')],
      opts
    )
    expect(rows[0].gapBefore).toBeUndefined()
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
  })

  it('spaceAfter blok TERAKHIR diabaikan (tidak ada blok setelahnya)', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para(0, 'aa'), para(1, 'bb', 20)],
      [para(0, '11'), para(1, '22', 20)],
      opts
    )
    expect(rows).toHaveLength(2)
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap)
  })

  it('kolom ID & EN terkunci: jarak = nilai TERBESAR kedua kolom', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para(0, 'aa', 12), para(1, 'bb')],
      [para(0, '11', 20), para(1, '22')],
      opts
    )
    // max(12, 20) = 20.
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap + 20)
  })

  it('spaceAfter di satu kolom saja tetap berlaku (kolom lain tanpa nilai)', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para(0, 'aa', 16), para(1, 'bb')],
      [para(0, '11'), para(1, '22')],
      opts
    )
    expect(rows[1].gapBefore).toBe(PKWT_GEOMETRY.blockGap + 16)
  })
})

/** Apakah pdfplumber tersedia untuk uji geometris? */
function hasPdfplumber(): boolean {
  try {
    execFileSync('python', ['-c', 'import pdfplumber'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const describeGeometric = hasPdfplumber() ? describe : describe.skip

describeGeometric('PKWT render — PDF nyata lalu diukur ulang', () => {
  jest.setTimeout(120_000)

  let pdfPath: string
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkwt-spec-'))
    pdfPath = path.join(tmpDir, 'pkwt.pdf')
    const buffer = await createPkwtPdfBuffer({
      blocks: [
        { type: 'title', text: 'KESEPAKATAN KERJA WAKTU TERTENTU' },
        { type: 'subtitle', text: 'STATED PERIODS LABOUR AGREEMENT' },
        {
          type: 'article',
          heading: 'Pasal 1\nMaksud Kesepakatan',
          paragraphs: [
            '1. Perusahaan mempekerjakan Karyawan untuk waktu tertentu.',
            '3. Atas Pekerjaan yang dilakukan PIHAK KEDUA sesuai kesepakatan.'
          ]
        },
        {
          type: 'article',
          heading: 'Pasal 2\nMasa Berlakunya Kesepakatan Kerja',
          paragraphs: ['1. Jangka waktu kesepakatan mengikuti {{contract.termRange}}.']
        }
      ],
      blocksEn: [
        { type: 'title', text: 'STATED PERIODS LABOUR AGREEMENT' },
        {
          type: 'article',
          heading: 'Article 1\nPurpose of Agreement',
          paragraphs: [
            '1. Company employ the Employee for stated periods according to company need.',
            '3. For work performed by the SECOND PARTY as agreed.'
          ]
        }
      ],
      values: { 'contract.termRange': '1 Januari 2026 - 31 Desember 2026' },
      titleId: 'KESEPAKATAN KERJA WAKTU TERTENTU',
      titleEn: 'STATED PERIODS LABOUR AGREEMENT',
      numberLabel: 'No. : 174/KUKP-SII/VII/2026',
      orgLines: [
        'KOPERASI KARYAWAN',
        'PT. SANKYU INDONESIA INTERNASIONAL',
        'UNIT KANTOR PUSAT'
      ],
      addressLines: [
        'Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20',
        'GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330'
      ],
      contactLine: 'TELP. 021 - 50555340, FAX. 021- 50555341',
      signature: {
        leftTitle: 'PIHAK PERTAMA',
        rightTitle: 'PIHAK KEDUA',
        leftName: 'Ketua Koperasi',
        rightName: 'Karyawan'
      }
    })
    fs.writeFileSync(pdfPath, buffer)
  })

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  /** Ukur PDF hasil render dan kembalikan ringkasannya. */
  function measure(file: string) {
    const script = `
import json, sys, pdfplumber
pdf = pdfplumber.open(sys.argv[1])
out = {"pages": [], "text": ""}
for p in pdf.pages:
    pg = {"width": p.width, "height": p.height, "rects": [], "chars": []}
    for r in p.rects:
        pg["rects"].append({"x0": r["x0"], "x1": r["x1"], "top": r["top"], "bottom": r["bottom"]})
    for c in p.chars:
        pg["chars"].append({"text": c["text"], "top": c["top"], "x0": c["x0"], "x1": c["x1"], "size": c["size"], "fontname": c.get("fontname")})
    out["pages"].append(pg)
    out["text"] += (p.extract_text() or "") + "\\n"
print(json.dumps(out))
`
    const raw = execFileSync('python', ['-c', script, file], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
    return JSON.parse(raw) as {
      pages: { width: number, height: number, rects: any[], chars: any[] }[]
      text: string
    }
  }

  it('halaman A4 dan kotak kolom berada di x master', () => {
    const m = measure(pdfPath)
    expect(m.pages.length).toBeGreaterThanOrEqual(1)
    expect(m.pages[0].width).toBeCloseTo(595.5, 0)
    expect(m.pages[0].height).toBeCloseTo(842.25, 0)

    const rects = m.pages[0].rects
    // Kotak digambar sebagai FILL per-tepi, jadi yang terukur adalah potongan
    // tepi. Tepi VERTIKAL = lebar 0.75 dan cukup tinggi.
    const vEdges = rects.filter(r => (r.x1 - r.x0) < 1.5 && (r.bottom - r.top) > 20)
    expect(vEdges.length).toBe(4)

    // Master terukur: 26.27→27.02, 296.63→297.38, 308.65→309.40, 566.98→567.73.
    // Artinya tepi KIRI berada DI LUAR kolom (x0-0.75) dan tepi KANAN di x1.
    const xs = [...new Set(vEdges.map(r => Math.round(r.x0 * 100) / 100))].sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(PKWT_GEOMETRY.left.x0 - 0.75, 2)
    expect(xs[1]).toBeCloseTo(PKWT_GEOMETRY.left.x1, 2)
    expect(xs[2]).toBeCloseTo(PKWT_GEOMETRY.right.x0 - 0.75, 2)
    expect(xs[3]).toBeCloseTo(PKWT_GEOMETRY.right.x1, 2)

    // Batang vertikal master hanya setinggi bagian DALAM kotak, jadi `top`-nya
    // = firstPageBoxTop + borderWidth (182.40 + 0.75 = 183.15), bukan 182.40.
    const boxTop = Math.min(...vEdges.map(r => r.top))
    expect(boxTop).toBeCloseTo(PKWT_GEOMETRY.firstPageBoxTop + PKWT_GEOMETRY.borderWidth, 2)
    expect(boxTop).toBeGreaterThan(PKWT_GEOMETRY.titleEnTop)

    // Sudut harus terisi: tepi atas membentang seluar batas luar (termasuk sudut).
    const hEdges = rects.filter(r => (r.bottom - r.top) < 1.5 && (r.x1 - r.x0) > 250)
    const topEdge = hEdges.find(r => Math.abs(r.top - PKWT_GEOMETRY.firstPageBoxTop) < 0.01)
    expect(topEdge).toBeDefined()
    expect(topEdge.x0).toBeCloseTo(PKWT_GEOMETRY.left.x0 - 0.75, 2)
    expect(topEdge.x1).toBeCloseTo(PKWT_GEOMETRY.left.x1 + 0.75, 2)
  })

  it('teks badan tetap memuat spasi (tidak ada kata tergabung)', () => {
    const m = measure(pdfPath)
    // Cari frasa di SELURUH halaman, bukan hanya kolom kiri: kolom kanan
    // (Bahasa Inggris) lega, sedangkan kolom kiri padat — jadi bila ada spasi
    // yang hilang, kolom kiri yang paling mungkin memperlihatkannya. Pencarian
    // global lebih tahan terhadap pergeseran layout.
    // PENTING: jangan merekonstruksi baris dari `chars` saja. Justifikasi
    // menulis celah antar-kata sebagai offset numerik di dalam operator `TJ`,
    // bukan sebagai glyph spasi (0x20) — jadi `chars` memang TIDAK memuat spasi.
    // `extract_text()` merekonstruksi celah TJ itu kembali menjadi spasi, dan
    // itulah yang dilihat pembaca PDF, sehingga properti yang benar-benar
    // penting adalah: hasil ekstraksi tetap memuat spasi antar-kata.
    const text = m.text
    expect(text).toContain('Atas Pekerjaan yang dilakukan PIHAK KEDUA')
    expect(text).not.toContain('AtasPekerjaan')
    expect(text).not.toContain('yangdilakukan')
  })

  /**
   * Master memang justified: baris badan berakhir pada tepi kanan yang SAMA
   * PERSIS — terukur ≈291.0 / ≈561.5pt (selisih < 1pt). Sebelum perbaikan,
   * engine menggambar rata kiri sehingga tidak ada pengelompokan tepi sama
   * sekali (stdev lebar baris tersisa ~104pt).
   *
   * Uji ini mengunci sifat itu pada PDF nyata: tepi kanan baris badan harus
   * membentuk satu puncak tajam di dekat tepi dalam kolom. Jumlah baris segaris
   * tidak pernah 100% karena tiap paragraf punya SATU baris terakhir yang memang
   * rata kiri (tidak direntangkan).
   */
  it('baris badan direntangkan ke tepi kanan kolom; baris judul TIDAK (justify, seperti master)', () => {
    const m = measure(pdfPath)
    const G = PKWT_GEOMETRY
    const pad = G.textPaddingLeft
    const midX = (G.left.x1 + G.right.x0) / 2
    const norm = (f?: string) =>
      (f ?? '').replace(/^[A-Z]{6}\+/, '').replace(/[()]/g, '').trim()

    // Tepi kanan tiap baris, plus apakah baris itu memuat glyph bold (judul).
    const buckets = new Map<string, { col: 'L' | 'R', maxX1: number, bold: boolean }>()
    for (const c of m.pages[0].chars) {
      // Batasi ke badan di dalam kotak kolom halaman 1 (lewati kop/judul).
      if (c.top < G.firstPageBoxTop || c.top > G.firstPageBoxBottom) continue
      const col: 'L' | 'R' = c.x0 < midX ? 'L' : 'R'
      const key = `${col}:${Math.round(c.top * 2) / 2}`
      const b = buckets.get(key) ?? { col, maxX1: 0, bold: false }
      b.maxX1 = Math.max(b.maxX1, c.x1)
      if (norm(c.fontname).includes('Bold')) b.bold = true
      buckets.set(key, b)
    }

    for (const col of ['L', 'R'] as const) {
      const rows = [...buckets.values()].filter(b => b.col === col)
      expect(rows.length).toBeGreaterThanOrEqual(6)

      const edge = (col === 'L' ? G.left.x1 : G.right.x1) - pad
      const isFlush = (x: number) => Math.abs(x - edge) < 1.5

      const body = rows.filter(r => !r.bold)
      const headings = rows.filter(r => r.bold)
      expect(body.length).toBeGreaterThanOrEqual(4)
      expect(headings.length).toBeGreaterThan(0)

      // Justifikasi: baris BADAN berakhir persis di tepi dalam kolom. Jumlahnya
      // tidak pernah 100% karena tiap paragraf punya SATU baris terakhir yang
      // memang rata kiri (tidak direntangkan) — jadi yang diuji adalah bahwa
      // baris TENGAH paragraf benar-benar direntangkan.
      expect(body.filter(r => isFlush(r.maxX1)).length).toBeGreaterThanOrEqual(2)

      // Tepi itu harus menjadi MODE-nya: puncak tajam, bukan salah satu dari
      // banyak tepi acak. Inilah sidik jari justifikasi.
      const hist = new Map<number, number>()
      for (const r of body) {
        const k = Math.round(r.maxX1 * 2) / 2
        hist.set(k, (hist.get(k) ?? 0) + 1)
      }
      const [modeEdge, modeCount] = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]
      expect(Math.abs(modeEdge - edge)).toBeLessThan(1.5)
      expect(modeCount).toBeGreaterThanOrEqual(2)

      // JUDUL (PASAL) TIDAK PERNAH DIRENTANGKAN.
      //
      // Guard ini menahan regresi yang nyata: dulu bold & justifikasi ditentukan
      // dari `headingId.has(row.id)`, yang membandingkan SATU BARIS hasil bungkus
      // dengan teks paragraf UTUH. Judul dua baris ("Pasal 1\nMaksud
      // Kesepakatan") karena itu tidak pernah cocok, sehingga baris judul ikut
      // direntangkan dan tampak "melar" — persis yang dilarang master.
      for (const r of headings) expect(isFlush(r.maxX1)).toBe(false)
    }
  })

  it('memakai family font yang benar per elemen (kop Times, judul/isi Lucida)', () => {
    const m = measure(pdfPath)
    const chars = m.pages[0].chars
    const norm = (f?: string) =>
      (f ?? '').replace(/^[A-Z]{6}\+/, '').replace(/[()]/g, '').trim()
    const fams = (cs: typeof chars) =>
      [...new Set(cs.map(c => norm(c.fontname)))].sort()

    // Judul + nomor berada di blok judul (di bawah garis pemisah kop).
    const titleChars = chars.filter(
      c => c.text.trim() && c.top >= PKWT_GEOMETRY.titleIdTop && c.top < PKWT_GEOMETRY.bodyTop
    )
    expect(titleChars.length).toBeGreaterThan(0)
    expect(fams(titleChars)).toEqual(['LucidaSans-TypewriterBold'])

    // Isi badan: hanya Lucida.
    const body = chars.filter(c => Math.abs(c.size - 9) < 0.01)
    expect(body.length).toBeGreaterThan(0)
    expect(fams(body).every(f => f.includes('Lucida'))).toBe(true)

    // Kop: Times New Roman, dan TIDAK boleh Lucida.
    const kop = chars.filter(c => c.top < PKWT_GEOMETRY.titleIdTop)
    expect(kop.length).toBeGreaterThan(0)
    expect(fams(kop).every(f => f.includes('Times'))).toBe(true)
  })

  it('setiap baris kop duduk dalam 0.1pt dari posisi master', () => {
    const m = measure(pdfPath)
    // Hasil ukur master (top glyph), urut atas→bawah.
    const expected = [15.84, 34.61, 53.36, 70.92, 85.17, 97.66]
    const rows: number[] = []
    for (const c of m.pages[0].chars) {
      if (c.top > PKWT_GEOMETRY.titleIdTop) continue
      if (!rows.some(t => Math.abs(t - c.top) < 2)) rows.push(c.top)
    }
    rows.sort((a, b) => a - b)
    expect(rows.length).toBe(expected.length)
    rows.forEach((top, i) => expect(Math.abs(top - expected[i])).toBeLessThan(0.1))
  })

  it('setiap baris judul/nomor duduk dalam 0.1pt dari posisi master', () => {
    const m = measure(pdfPath)
    const expected = [
      { top: 144.33, text: 'KESEPAKATAN KERJA WAKTU TERTENTU' },
      { top: 158.61, text: 'STATED PERIODS LABOUR AGREEMENT' },
      { top: 172.4, text: 'No. : 174/KUKP-SII/VII/2026' }
    ]
    for (const e of expected) {
      const hit = m.pages[0].chars.filter(
        c => Math.abs(c.top - e.top) < 2 && c.text.trim()
      )
      expect(hit.length).toBeGreaterThan(0)
      const top = Math.min(...hit.map(c => c.top))
      expect(Math.abs(top - e.top)).toBeLessThan(0.1)
    }
  })

  it('badan dirender pada ukuran 9pt', () => {
    const m = measure(pdfPath)
    const sizes = m.pages.flatMap(p => p.chars).map(c => Math.round(c.size * 100) / 100)
    const freq = new Map<number, number>()
    for (const s of sizes) freq.set(s, (freq.get(s) ?? 0) + 1)
    const dominant = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
    expect(dominant).toBeCloseTo(9, 1)
  })

  it('baris ID dan EN berada pada y yang sama', () => {
    const m = measure(pdfPath)
    const p0 = m.pages[0]
    const midX = (PKWT_GEOMETRY.left.x1 + PKWT_GEOMETRY.right.x0) / 2
    const leftTops = new Set(p0.chars.filter(c => c.x0 < midX).map(c => Math.round(c.top)))
    const rightTops = new Set(p0.chars.filter(c => c.x0 > midX).map(c => Math.round(c.top)))
    const shared = [...leftTops].filter(t => rightTops.has(t))
    expect(shared.length).toBeGreaterThanOrEqual(1)
  })

  /**
   * Bukti end-to-end bahwa jarak antar-blok BENAR-BENAR tercetak.
   *
   * Caranya membandingkan dua dokumen dengan isi yang SAMA PERSIS, hanya
   * berbeda cara membungkusnya:
   *   A. dua blok `paragraph`  -> ada satu batas blok  -> satu `blockGap`
   *   B. satu blok `article` dengan dua paragraf -> TIDAK ada batas blok
   * Karena teksnya identik, tinggi barisnya identik, sehingga selisih posisi
   * baris kedua HARUS tepat sebesar `blockGap`. Kalau `gapBefore` diputus dari
   * `renderPkwtLayout`, selisih ini menjadi 0 dan tes gagal.
   */
  it('jarak antar-blok benar-benar tercetak di PDF (dua blok vs satu blok dua paragraf)', async () => {
    const G = PKWT_GEOMETRY
    const base = {
      values: {} as Record<string, string>,
      titleId: 'KESEPAKATAN KERJA WAKTU TERTENTU',
      titleEn: 'STATED PERIODS LABOUR AGREEMENT',
      numberLabel: 'No. : 1/KUKP-SII/I/2026',
      orgLines: ['KOPERASI KARYAWAN'],
      addressLines: ['Jl. Contoh No. 1'],
      contactLine: 'TELP. 021 - 0',
      signature: { leftTitle: 'PIHAK PERTAMA', rightTitle: 'PIHAK KEDUA' }
    }

    const twoBlocks = path.join(tmpDir, 'gap-two-blocks.pdf')
    fs.writeFileSync(twoBlocks, await createPkwtPdfBuffer({
      ...base,
      blocks: [
        { type: 'paragraph', text: 'PARA-SATU' },
        { type: 'paragraph', text: 'PARA-DUA' }
      ]
    }))

    const oneBlock = path.join(tmpDir, 'gap-one-block.pdf')
    fs.writeFileSync(oneBlock, await createPkwtPdfBuffer({
      ...base,
      blocks: [
        { type: 'article', paragraphs: ['PARA-SATU', 'PARA-DUA'] }
      ]
    }))

    /**
     * Top baris kolom KIRI yang benar-benar memuat teks paragraf uji.
     *
     * Tidak boleh sekadar mengambil N baris teratas: pada dokumen pendek blok
     * TANDA TANGAN juga berada di halaman 1 dan kolom kirinya, jadi ia ikut
     * terhitung. Karena teksnya satu kata tanpa spasi (`PARA-SATU`), justifikasi
     * tidak menyisipkan celah, sehingga `join('')` merekonstruksinya utuh.
     */
    const paraRowTops = (file: string) => {
      const p0 = measure(file).pages[0]
      const midX = (G.left.x1 + G.right.x0) / 2
      const tops: number[] = []
      for (const c of p0.chars) {
        if (c.x0 > midX) continue
        if (!tops.some(t => Math.abs(t - c.top) < 2)) tops.push(c.top)
      }
      return tops
        .map(top => ({
          top,
          text: p0.chars
            .filter(c => c.x0 <= midX && Math.abs(c.top - top) < 2)
            .map(c => c.text)
            .join('')
        }))
        .filter(r => r.text.includes('PARA'))
        .sort((a, b) => a.top - b.top)
        .map(r => r.top)
    }

    const a = paraRowTops(twoBlocks)
    const b = paraRowTops(oneBlock)
    expect(a).toHaveLength(2)
    expect(b).toHaveLength(2)

    // Baris pertama identik: keduanya mulai di `boxTop + PAD_TOP`.
    expect(a[0]).toBeCloseTo(b[0], 1)
    // Baris kedua pada dokumen DUA-BLOK turun tepat sebesar `blockGap`.
    expect(a[1] - b[1]).toBeCloseTo(G.blockGap, 1)
    expect(a[1] - a[0]).toBeGreaterThan(b[1] - b[0])
  })
})

/**
 * Invarian ANGGARAN HALAMAN.
 *
 * `blockGap` memberi jarak nyata antar blok supaya batas blok terlihat jelas.
 * Kenaikan itu dibayar dari ruang halaman: setiap batas blok × tambahan pt,
 * sedangkan halaman 2–3 nyaris penuh. Sisa ruang halaman terakhir yang
 * menyerapnya, jadi `blockGap` punya **plafon keras**.
 *
 * Plafon itu bergerak setiap kali jumlah blok berubah: setelah blok identitas
 * PIHAK KEDUA dikodekan (17 batas blok, dari 16), plafonnya turun 10 → 8 pt.
 * Ambangnya tajam — 8.5 pt sudah memaksa keempat varian ke halaman 5 (terukur
 * lewat `scripts/measure-pkwt-page-budget.ts`).
 *
 * Sebelum ini tidak ada satu pun tes yang menahan invarian tersebut. Menambah
 * satu halaman pada kontrak legal berarti menambah satu lembar yang ikut
 * ditandatangani, jadi plafon ini harus dijaga eksplisit.
 */
describeGeometric('PKWT — jumlah halaman tidak bertambah (plafon blockGap)', () => {
  jest.setTimeout(180_000)

  /**
   * Mengukur jumlah halaman sebuah buffer PDF. Sengaja lewat pdfplumber, bukan
   * menebak dari `doc.bufferedPageRange()`: yang diuji adalah PDF yang
   * benar-benar ditulis, bukan state internal PDFKit.
   */
  const PAGES_PY = `
import sys, pdfplumber
with pdfplumber.open(sys.argv[1]) as pdf:
    print(len(pdf.pages))
`

  function countPages(buffer: Buffer, tmpDir: string, name: string): number {
    const file = path.join(tmpDir, `${name}.pdf`)
    fs.writeFileSync(file, buffer)
    return Number(execFileSync('python', ['-c', PAGES_PY, file]).toString().trim())
  }

  it('keempat varian PKWT bawaan tetap 4 halaman pada blockGap sekarang', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkwt-pages-'))
    try {
      const keys = Object.keys(CONTRACT_DOCUMENT_DEFINITIONS).filter(k => k.startsWith('PKWT_'))
      expect(keys.length).toBeGreaterThanOrEqual(4)

      for (const key of keys) {
        const content: SeedContentDefinition = definitionToContentDefinition(getContractDocumentDefinition(key))
        const buffer = await createPkwtPdfBuffer({
          blocks: content?.languages?.id ?? [],
          blocksEn: content?.languages?.en ?? [],
          values: { ...PKWT_PREVIEW_VALUES },
          orgLines: [...PKWT_HEADER_CHROME.org],
          addressLines: [...PKWT_HEADER_CHROME.address],
          contactLine: PKWT_HEADER_CHROME.contactLine,
          titleId: 'KESEPAKATAN KERJA WAKTU TERTENTU',
          titleEn: 'STATED PERIODS LABOUR AGREEMENT',
          numberLabel: `${PKWT_HEADER_CHROME.numberPrefix} 174/KUKP-SII/VII/2026`,
          fonts: resolvePkwtFonts(),
          signature: {
            leftTitle: PKWT_HEADER_CHROME.signature.leftTitle,
            rightTitle: PKWT_HEADER_CHROME.signature.rightTitle,
            leftName: PKWT_PREVIEW_VALUES['employee.fullName'],
            leftRole: PKWT_PREVIEW_VALUES['employee.jobRole'],
            rightName: PKWT_PREVIEW_VALUES['settings.cooperativeChairmanName'],
            rightRole: PKWT_HEADER_CHROME.signature.rightRoleLabel
          }
        })
        // Bila ini gagal: `blockGap` sudah melewati plafon dan dokumen legal
        // bertambah satu lembar. Turunkan `blockGap`, jangan naikkan angka ini.
        expect({ key, pages: countPages(buffer, tmpDir, key) }).toEqual({ key, pages: 4 })
      }
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // Direktori sementara OS; gagal bersih-bersih tidak boleh menggagalkan tes.
      }
    }
  })
})

/**
 * Gerbang Fase 2b: mark & perataan TIDAK BOLEH mengubah paginasi dokumen legal.
 *
 * Diuji pada definisi PRODUKSI (`CONTRACT_DOCUMENT_DEFINITIONS`), bukan fixture
 * kecil, dan memakai perbandingan RELATIF (dengan mark vs tanpa mark pada
 * definisi yang sama) supaya tes ini tidak bergantung pada jumlah halaman dasar
 * yang bisa berubah bila template bawaan disunting.
 */
describeGeometric('PKWT — mark & perataan tidak menggeser paginasi (definisi produksi)', () => {
  jest.setTimeout(180_000)

  const PAGES_PY = `
import sys, pdfplumber
with pdfplumber.open(sys.argv[1]) as pdf:
    print(len(pdf.pages))
`

  function countPages(buffer: Buffer, tmpDir: string, name: string): number {
    const file = path.join(tmpDir, `${name}.pdf`)
    fs.writeFileSync(file, buffer)
    return Number(execFileSync('python', ['-c', PAGES_PY, file]).toString().trim())
  }

  const headerOpts = () => ({
    values: { ...PKWT_PREVIEW_VALUES },
    orgLines: [...PKWT_HEADER_CHROME.org],
    addressLines: [...PKWT_HEADER_CHROME.address],
    contactLine: PKWT_HEADER_CHROME.contactLine,
    titleId: 'KESEPAKATAN KERJA WAKTU TERTENTU',
    titleEn: 'STATED PERIODS LABOUR AGREEMENT',
    numberLabel: `${PKWT_HEADER_CHROME.numberPrefix} 174/KUKP-SII/VII/2026`,
    fonts: resolvePkwtFonts(),
    signature: {
      leftTitle: PKWT_HEADER_CHROME.signature.leftTitle,
      rightTitle: PKWT_HEADER_CHROME.signature.rightTitle,
      leftName: PKWT_PREVIEW_VALUES['employee.fullName'],
      leftRole: PKWT_PREVIEW_VALUES['employee.jobRole'],
      rightName: PKWT_PREVIEW_VALUES['settings.cooperativeChairmanName'],
      rightRole: PKWT_HEADER_CHROME.signature.rightRoleLabel
    }
  })

  /**
   * Tandai kata PERTAMA tiap paragraf sebagai bold (perubahan lebar minimal) dan
   * beri perataan pada blok `paragraph`/`article`.
   */
  const decorate = (blocks: any[], align: string) =>
    (blocks ?? []).map((block: any) => {
      if (block.type === 'paragraph') {
        const text = String(block.text ?? '')
        const marked = text.replace(/^(\S+)/, '**$1**')
        return { ...block, text: marked, align }
      }
      if (block.type === 'article') {
        return { ...block, align }
      }
      return block
    })

  it('mark + keempat nilai perataan tidak menambah/mengurangi halaman', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkwt-pages-mark-'))
    try {
      const keys = Object.keys(CONTRACT_DOCUMENT_DEFINITIONS).filter(k => k.startsWith('PKWT_'))
      expect(keys.length).toBeGreaterThanOrEqual(4)

      for (const key of keys) {
        const content: SeedContentDefinition = definitionToContentDefinition(getContractDocumentDefinition(key))
        const base = {
          ...headerOpts(),
          blocks: content?.languages?.id ?? [],
          blocksEn: content?.languages?.en ?? []
        }
        const plainPages = countPages(await createPkwtPdfBuffer(base), tmpDir, `${key}-plain`)

        for (const align of ['left', 'center', 'right', 'justify']) {
          const marked = await createPkwtPdfBuffer({
            ...base,
            blocks: decorate(content?.languages?.id, align),
            blocksEn: decorate(content?.languages?.en, align)
          })
          expect({ key, align, pages: countPages(marked, tmpDir, `${key}-${align}`) })
            .toEqual({ key, align, pages: plainPages })
        }
      }
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // Direktori sementara OS; gagal bersih-bersih tidak boleh menggagalkan tes.
      }
    }
  })
})

describe('resolveCellAlign — prioritas perataan (kunci nol regresi)', () => {
  it('tanpa align eksplisit, mereproduksi rumus lama PERSIS', () => {
    // Perilaku lama: `idJustify = idBold ? false : row.idJustify`, lalu
    // `justify ? drawJustifiedLine : doc.text(align:'left')`.
    expect(resolveCellAlign(undefined, false, true)).toBe('justify')
    expect(resolveCellAlign(undefined, false, false)).toBe('left')
    // Baris bold tidak pernah direntangkan, walau `justify` true.
    expect(resolveCellAlign(undefined, true, true)).toBe('left')
    expect(resolveCellAlign(undefined, true, false)).toBe('left')
  })

  it('align eksplisit MENANG atas bold dan justify', () => {
    // Inilah yang membuat "Rata Tengah" pada pasal menengahkan judulnya juga.
    expect(resolveCellAlign('center', true, true)).toBe('center')
    expect(resolveCellAlign('right', true, false)).toBe('right')
    expect(resolveCellAlign('left', false, true)).toBe('left')
    expect(resolveCellAlign('justify', true, true)).toBe('justify')
  })

  it('nilai align yang tidak dikenal diperlakukan sebagai tidak ada', () => {
    // Jaring pengaman: data lama/rusak tidak boleh mengubah perataan.
    expect(resolveCellAlign('middle' as never, false, true)).toBe('justify')
    expect(resolveCellAlign(null as never, false, false)).toBe('left')
    expect(resolveCellAlign(undefined, true, true)).toBe('left')
  })

  it('keempat nilai sah diteruskan apa adanya', () => {
    for (const align of ['left', 'center', 'right', 'justify'] as const) {
      expect(resolveCellAlign(align, false, false)).toBe(align)
      expect(resolveCellAlign(align, true, true)).toBe(align)
    }
  })
})

describe('buildPkwtRowsFromStructuredParagraphs — runs & align', () => {
  const stubDoc = {
    font() { return this },
    fontSize() { return this },
    widthOfString(s: string) { return String(s).length * 5 }
  }
  const opts = { width: 1000, size: 9 }

  const para = (blockId: string, blockIndex: number, text: string, extra: Record<string, unknown> = {}) =>
    ({ blockId, blockIndex, text, bold: false, ...extra })

  it('paragraf TANPA runs tidak menghasilkan idRuns/enRuns (jalur lama utuh)', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'teks polos')],
      [para('a', 0, 'plain text')],
      opts
    )
    expect(rows[0].idRuns).toBeUndefined()
    expect(rows[0].enRuns).toBeUndefined()
    expect(rows[0].id).toBe('teks polos')
    expect(rows[0].en).toBe('plain text')
  })

  it('paragraf BER-runs menghasilkan idRuns yang cocok dengan teks polosnya', () => {
    const text = 'Halo **dunia**'
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, text, { runs: parseInlineRuns(text) })],
      [],
      opts
    )
    expect(rows[0].id).toBe('Halo dunia')
    expect(rows[0].idRuns).toEqual([
      { text: 'Halo ', bold: false, italic: false, underline: false },
      { text: 'dunia', bold: true, italic: false, underline: false },
    ])
  })

  it('perataan blok diteruskan ke idAlign/enAlign', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'isi id', { align: 'center' })],
      [para('a', 0, 'body en', { align: 'center' })],
      opts
    )
    expect(rows[0].idAlign).toBe('center')
    expect(rows[0].enAlign).toBe('center')
  })

  it('tanpa align, idAlign/enAlign tetap undefined', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'isi id')],
      [para('a', 0, 'body en')],
      opts
    )
    expect(rows[0].idAlign).toBeUndefined()
    expect(rows[0].enAlign).toBeUndefined()
  })

  it('perataan tetap mengikuti baris judul pasal (bold)', () => {
    // "Rata Tengah" pada sebuah pasal harus menengahkan judul DAN uraiannya.
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [
        { blockId: 'a', blockIndex: 0, text: 'Pasal 1', bold: true, align: 'center' },
        para('a', 0, 'uraian pasal', { align: 'center' }),
      ],
      [],
      opts
    )
    expect(rows[0].idBold).toBe(true)
    expect(rows[0].idAlign).toBe('center')
    expect(resolveCellAlign(rows[0].idAlign, true, false)).toBe('center')
  })

  it('runs ikut terpecah bila paragrafnya lebih panjang dari lebar kolom', () => {
    // Lebar 100 / 5 = 20 karakter per baris.
    const text = '**satu dua tiga empat lima enam tujuh delapan**'
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'satu dua tiga empat lima enam tujuh delapan', { runs: parseInlineRuns(text) })],
      [],
      { width: 100, size: 9 }
    )
    expect(rows.length).toBeGreaterThan(1)
    // Setiap baris membawa run-nya sendiri dan tetap bold.
    for (const row of rows) {
      expect(row.idRuns).toBeDefined()
      expect(row.idRuns!.every(run => run.bold)).toBe(true)
    }
    // Teks polos gabungan == teks asli tanpa mark.
    expect(rows.map(r => r.id).join(' ')).toBe('satu dua tiga empat lima enam tujuh delapan')
  })

  it('kolom ID dan EN boleh punya perataan berbeda (per-kolom)', () => {
    const rows = buildPkwtRowsFromStructuredParagraphs(
      stubDoc,
      [para('a', 0, 'id center', { align: 'center' })],
      [para('a', 0, 'en right', { align: 'right' })],
      opts
    )
    expect(rows[0].idAlign).toBe('center')
    expect(rows[0].enAlign).toBe('right')
  })
})
