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
  buildPkwtRows,
  buildPkwtRowsFromStructuredParagraphs,
  pkwtColumnInnerWidth,
  pkwtSignatureHeight
} from './pkwt-layout.engine'
import { createPkwtPdfBuffer } from './pkwt-document.renderer'

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
})
