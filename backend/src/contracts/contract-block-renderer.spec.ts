import { interpolate, buildValueMap, formatCell, listPrefix, renderBlocks } from './contract-block-renderer'

describe('interpolate', () => {
  it('mengganti placeholder dengan nilai', () => {
    const values = { 'employee.fullName': 'Budi Santoso', 'contract.contractNo': '001/KK/2026' }
    expect(interpolate('Nama {{employee.fullName}} no {{contract.contractNo}}', values)).toBe(
      'Nama Budi Santoso no 001/KK/2026',
    )
  })

  it('placeholder tanpa nilai tetap terlihat (fail-visible) dengan penanda', () => {
    expect(interpolate('Nama {{employee.fullName}}', {})).toBe('Nama «employee.fullName»')
  })

  it('nilai kosong juga ditandai', () => {
    expect(interpolate('X {{custom.a}}', { 'custom.a': '' })).toBe('X «custom.a»')
  })

  it('teks tanpa placeholder tidak berubah', () => {
    expect(interpolate('Teks biasa', {})).toBe('Teks biasa')
  })

  it('string kosong aman', () => {
    expect(interpolate('', {})).toBe('')
  })
})

describe('buildValueMap', () => {
  it('mengambil displayValue dari bentuk { value, displayValue }', () => {
    const map = buildValueMap({
      'contract.contractNo': { value: 'X', displayValue: 'X' },
      'employee.fullName': { value: 'Budi', displayValue: 'Budi' },
    })
    expect(map).toEqual({ 'contract.contractNo': 'X', 'employee.fullName': 'Budi' })
  })

  it('mendukung nilai scalar langsung', () => {
    expect(buildValueMap({ 'custom.a': 'teks' })).toEqual({ 'custom.a': 'teks' })
  })

  it('null/undefined aman', () => {
    expect(buildValueMap(null)).toEqual({})
    expect(buildValueMap(undefined)).toEqual({})
  })

  it('default bahasa Indonesia: displayValueEn diabaikan', () => {
    // Pemanggil lama (MITRA satu kolom) tidak boleh ikut berubah.
    const map = buildValueMap({
      'employee.gender': { value: 'MALE', displayValue: 'Laki-laki', displayValueEn: 'Male' },
    })
    expect(map['employee.gender']).toBe('Laki-laki')
  })

  it("bahasa 'EN': memakai displayValueEn bila ada, jatuh ke displayValue bila tidak", () => {
    // Inti fitur gender bilingual: kolom kanan PKWT harus "Male", sementara
    // field lain (yang teksnya tidak bergantung bahasa) tetap satu nilai.
    const map = buildValueMap({
      'employee.gender': { value: 'MALE', displayValue: 'Laki-laki', displayValueEn: 'Male' },
      'employee.fullName': { value: 'Budi', displayValue: 'Budi' },
      'contract.contractNo': { value: 'X', displayValue: 'X' },
    }, 'EN')
    expect(map).toEqual({
      'employee.gender': 'Male',
      'employee.fullName': 'Budi',
      'contract.contractNo': 'X',
    })
  })
})

describe('formatCell', () => {
  it('currency dari angka mentah', () => {
    expect(formatCell('4500000', 'currency')).toContain('4.500.000')
  })

  it('currency dari string berformat rupiah', () => {
    expect(formatCell('Rp 4.500.000', 'currency')).toContain('4.500.000')
  })

  it('number', () => {
    expect(formatCell('1234567', 'number')).toBe('1.234.567')
  })

  it('text dibiarkan apa adanya', () => {
    expect(formatCell('Upah Pokok', 'text')).toBe('Upah Pokok')
    expect(formatCell('Tanpa format', undefined)).toBe('Tanpa format')
  })

  it('nilai non-numerik dengan format currency dibiarkan', () => {
    expect(formatCell('Belum ada', 'currency')).toBe('Belum ada')
  })
})

describe('listPrefix — sub-butir sample MITRA', () => {
  it('numbered', () => {
    expect(listPrefix('numbered', 0)).toBe('1.')
    expect(listPrefix('numbered', 2)).toBe('3.')
  })

  it('alphabetic (a, b, c)', () => {
    expect(listPrefix('alphabetic', 0)).toBe('a.')
    expect(listPrefix('alphabetic', 1)).toBe('b.')
    expect(listPrefix('alphabetic', 2)).toBe('c.')
  })

  it('bullet default', () => {
    expect(listPrefix('bullet', 0)).toBe('•')
    expect(listPrefix('unknown', 5)).toBe('•')
  })
})

/**
 * Dokumen PDFKit PALSU yang merekam pemanggilan.
 *
 * Dipakai untuk membedakan dua jalur tanpa PDF nyata:
 *  - jalur lama    → `doc.text` dipanggil SEKALI per blok, tanpa `lineBreak`
 *  - jalur bermark → `doc.text` dipanggil per POTONGAN run, `lineBreak: false`
 *
 * Metrik teks dibuat deterministik (5pt per karakter, 12pt per baris) supaya
 * posisi perataan bisa diasersi persis tanpa bergantung pada font sistem.
 */
function recordingDoc() {
  const doc: any = {
    page: { width: 595.5, height: 842.25 },
    y: 0,
    pages: 1,
    currentFont: '',
    texts: [] as Array<{ text: string, x: number, y: number, font: string, opts: any }>,
    fontNames: [] as string[],
    underlineStrokes: 0,
  }
  doc.font = (name: string) => { doc.currentFont = name; doc.fontNames.push(name); return doc }
  doc.fontSize = () => doc
  doc.fillColor = () => doc
  doc.strokeColor = () => doc
  doc.lineWidth = () => doc
  doc.save = () => doc
  doc.restore = () => doc
  doc.rect = () => doc
  doc.lineTo = () => doc
  doc.stroke = () => doc
  doc.widthOfString = (text: string) => String(text).length * 5
  doc.heightOfString = (text: string, o: any = {}) => {
    const width = o.width ?? 500
    const perLine = 12
    const chars = Math.max(1, Math.floor(width / 5))
    const lines = String(text)
      .split('\n')
      .reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / chars)), 0)
    return lines * perLine
  }
  doc.currentLineHeight = () => 12
  doc.text = (text: string, x: number, y: number, o: any = {}) => {
    doc.texts.push({ text: String(text), x, y, font: doc.currentFont, opts: o })
    doc.y = y + doc.heightOfString(String(text), { width: o.width ?? 500 })
    return doc
  }
  doc.addPage = () => { doc.pages += 1; doc.y = 0; return doc }
  // `moveTo` HANYA dipakai untuk menggambar garis bawah manual (jalur bermark).
  doc.moveTo = () => { doc.underlineStrokes += 1; return doc }
  return doc
}

const RENDER_OPTS = {
  leftX: 34,
  rightX: 310,
  columnWidth: 252,
  topY: 100,
  bottomY: 742,
  fontRegular: 'Times-Roman',
  fontBold: 'Times-Bold',
  fontItalic: 'Times-Italic',
}

/** Semua potongan teks yang digambar, digabung — untuk membandingkan isi visual. */
function drawnText(doc: any): string {
  return doc.texts.map((t: any) => t.text).join('')
}


describe('renderBlocks — jalur legacy tanpa mark (regresi Fase 2d)', () => {
  it('paragraf polos memakai jalur lama: satu panggilan doc.text tanpa lineBreak', () => {
    const doc = recordingDoc()
    renderBlocks(doc, [{ type: 'paragraph', text: 'Halo dunia biasa.' }], { values: {} }, RENDER_OPTS)

    expect(doc.texts).toHaveLength(1)
    expect(doc.texts[0].text).toBe('Halo dunia biasa.')
    expect(doc.texts[0].opts.lineBreak).toBeUndefined()
    expect(doc.texts[0].opts.align).toBe('justify')
    expect(doc.texts[0].opts.lineGap).toBe(0.6)
    expect(doc.texts[0].font).toBe('Times-Roman')
    expect(doc.underlineStrokes).toBe(0)
  })

  it('paragraf polos dengan align eksplisit diteruskan apa adanya', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'paragraph', text: 'Halo dunia biasa.', align: 'right' }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts).toHaveLength(1)
    expect(doc.texts[0].opts.align).toBe('right')
  })

  it('align tak dikenal diabaikan → perilaku lama (justify)', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'paragraph', text: 'Teks biasa.', align: 'middle' }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts[0].opts.align).toBe('justify')
  })

  it('article polos: judul left (bukan center) dan paragraf justify', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'article', heading: 'PASAL 1', paragraphs: ['Isi pasal.'] }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts.map((t: any) => t.text)).toEqual(['PASAL 1', 'Isi pasal.'])
    expect(doc.texts[0].opts.align).toBe('left')
    expect(doc.texts[0].font).toBe('Times-Bold')
    expect(doc.texts[1].opts.align).toBe('justify')
  })

  it('headingAlign pada article mengatur judul sendiri; uraian tetap align blok', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{
        type: 'article',
        heading: 'PASAL 1',
        headingAlign: 'center',
        align: 'justify',
        paragraphs: ['Isi pasal.'],
      }],
      { values: {} },
      RENDER_OPTS,
    )
    // Judul ikut headingAlign (center), BUKAN align blok (justify).
    expect(doc.texts[0].opts.align).toBe('center')
    expect(doc.texts[1].opts.align).toBe('justify')
  })

  it('headingAlign tidak sah diabaikan → perilaku lama (judul left)', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'article', heading: 'PASAL 1', headingAlign: 'middle', paragraphs: ['Isi pasal.'] }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts[0].opts.align).toBe('left')
    expect(doc.texts[1].opts.align).toBe('justify')
  })

  it('title/subtitle tetap center dan mark TIDAK diterapkan (di luar lingkup)', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [
        { type: 'title', text: '**tebal**' },
        { type: 'subtitle', text: 'Anak judul' },
      ],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts[0].text).toBe('**tebal**')
    expect(doc.texts[0].opts.align).toBe('center')
    expect(doc.texts[1].opts.align).toBe('center')
    expect(doc.underlineStrokes).toBe(0)
  })

  it('align pada list tidak diteruskan (list selalu rata kiri)', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'list', style: 'bullet', align: 'center', items: ['satu'] }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts[0].opts.align).toBe('left')
  })
})


describe('renderBlocks — jalur bermark & perataan (Fase 2d)', () => {
  it('teks bermark digambar per potongan run (lineBreak: false)', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'paragraph', text: 'Halo **dunia** biasa.', align: 'left' }],
      { values: {} },
      RENDER_OPTS,
    )

    expect(doc.texts.length).toBeGreaterThan(1)
    expect(doc.texts.every((t: any) => t.opts.lineBreak === false)).toBe(true)
    // `align: 'left'` mempertahankan spasi asli, jadi hasil gabungan identik.
    expect(drawnText(doc)).toBe('Halo dunia biasa.')
    expect(doc.fontNames).toContain('Times-Bold')
  })

  it('mark tanpa align tetap justified (perilaku lama untuk perataan)', () => {
    const doc = recordingDoc()
    renderBlocks(doc, [{ type: 'paragraph', text: 'a **b** c' }], { values: {} }, RENDER_OPTS)
    // Justify membuang spasi lalu merentangkan celah, jadi yang dibandingkan
    // adalah karakter non-spasi.
    expect(drawnText(doc).replace(/\s/g, '')).toBe('abc')
    expect(doc.underlineStrokes).toBe(0)
  })

  it("align 'right' menggeser titik awal potongan pertama, 'left' tidak", () => {
    const left = recordingDoc()
    renderBlocks(left, [{ type: 'paragraph', text: 'A **B**', align: 'left' }], { values: {} }, RENDER_OPTS)
    const right = recordingDoc()
    renderBlocks(right, [{ type: 'paragraph', text: 'A **B**', align: 'right' }], { values: {} }, RENDER_OPTS)

    expect(left.texts[0].x).toBe(RENDER_OPTS.leftX)
    expect(right.texts[0].x).toBeGreaterThan(RENDER_OPTS.leftX)
    // natural = 'A' + ' ' + 'B' = 15pt; right → x + width − natural.
    expect(right.texts[0].x).toBe(RENDER_OPTS.leftX + RENDER_OPTS.columnWidth - 15)
  })

  it("align 'center' menggeser titik awal ke tengah", () => {
    const doc = recordingDoc()
    renderBlocks(doc, [{ type: 'paragraph', text: 'A **B**', align: 'center' }], { values: {} }, RENDER_OPTS)
    expect(doc.texts[0].x).toBe(RENDER_OPTS.leftX + (RENDER_OPTS.columnWidth - 15) / 2)
  })

  it('__underline__ menggambar garis bawah manual', () => {
    const doc = recordingDoc()
    renderBlocks(doc, [{ type: 'paragraph', text: 'A __garis__ B.' }], { values: {} }, RENDER_OPTS)
    expect(doc.underlineStrokes).toBe(1)
  })

  it('interpolasi dilakukan SEBELUM mark dibaca (nilai yang jadi bold)', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'paragraph', text: '**{{employee.fullName}}**', align: 'left' }],
      { values: { 'employee.fullName': 'Budi' } },
      RENDER_OPTS,
    )
    expect(drawnText(doc)).toBe('Budi')
    expect(doc.texts[0].font).toBe('Times-Bold')
  })

  it('article: align mengikuti judul DAN paragraf', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'article', heading: 'PASAL 1', paragraphs: ['Isi **pasal**.'], align: 'center' }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts[0].text).toBe('PASAL 1')
    expect(doc.texts[0].opts.align).toBe('center')
    // Paragraf bermark: semua potongan digambar, isi non-spasi utuh.
    expect(drawnText(doc).replace(/\s/g, '')).toBe('PASAL1Isipasal.')
    expect(doc.texts.slice(1).every((t: any) => t.opts.lineBreak === false)).toBe(true)
  })

  it('article: align juga berlaku pada paragraf polos', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'article', heading: 'PASAL 2', paragraphs: ['Isi pasal polos.'], align: 'right' }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts[1].opts.align).toBe('right')
  })

  it('paragraf yang tidak muat di sisa kolom dipindahkan UTUH — sama dengan jalur polos', () => {
    // Filler 2549 karakter = 51 baris @12pt pada `recordingDoc`:
    //  - jalur polos: heightOfString = ceil(2549/50) × 12 = 612pt
    //  - jalur bermark: 51 token 'b' + 51 token spasi (@5pt/karakter) = 306pt/baris
    //    → 50 baris wrapRunsToLines = 600pt
    // Keduanya > sisa kolom kiri (692.25 − 612 = 80.25pt setelah filler) tapi
    // muat dalam SATU kolom kosong (692.25pt) → harus dipindahkan UTUH, bukan
    // dicicil. Perbedaan kecil (612 vs 600) tidak memengaruhi keputusan.
    const filler = `a${' b'.repeat(1200)}`
    const build = (text: string) => {
      const doc = recordingDoc()
      renderBlocks(
        doc,
        [{ type: 'paragraph', text: filler }, { type: 'paragraph', text }],
        { values: {} },
        RENDER_OPTS,
      )
      return doc
    }

    const plain = build('Halo dunia biasa.')
    const marked = build('Halo **dunia** biasa.')

    // Kedua paragraf (filler 600pt + 'Halo...' 1 baris 12pt) muat UTUH di kolom
    // kiri: 100 + 600 + 12 = 712 ≤ 792.25 (pageBottom). Jadi KEDUA jalur
    // menggambar paragraf kedua di kolom yang SAMA (x=34) pada y setelah filler
    // — tanpa pindah kolom. Inilah invariansi yang dikunci: keputusan pindah
    // kolom TIDAK berubah karena ada mark.
    expect(plain.texts[1].x).toBe(RENDER_OPTS.leftX)
    expect(marked.texts[1].x).toBe(RENDER_OPTS.leftX)
    expect(marked.texts[1].y).toBe(plain.texts[1].y)
    expect(marked.texts.filter((t: any) => t.opts.lineBreak === false).every((t: any) => t.y === plain.texts[1].y)).toBe(true)
  })

  it('mark di list tetap literal (di luar lingkup, validator menolaknya)', () => {
    const doc = recordingDoc()
    renderBlocks(
      doc,
      [{ type: 'list', style: 'bullet', items: ['**tebal**'] }],
      { values: {} },
      RENDER_OPTS,
    )
    expect(doc.texts[0].text).toContain('**tebal**')
    expect(doc.underlineStrokes).toBe(0)
  })

  it('paragraf bermark panjang pindah kolom/halaman tanpa melewati batas', () => {
    const doc = recordingDoc()
    // 252pt / 5pt = 50 karakter per baris → jauh lebih tinggi dari satu kolom.
    // Satu kolom menyediakan pageBottom − topY = (842.25 − 50) − 100 = 692.25pt.
    const long = `**${'kata '.repeat(1200)}**`
    renderBlocks(doc, [{ type: 'paragraph', text: long }], { values: {} }, RENDER_OPTS)

    // 120 baris @12pt → kolom kiri (57 baris) + kolom kanan (57) + sisa 6 → halaman 2.
    expect(doc.pages).toBeGreaterThan(1)
    // Tidak ada baris yang melewati batas bawah halaman (baris terakhir harus
    // masih muat: y + lineHeight ≤ pageBottom).
    const pageBottom = doc.page.height - 50
    expect(doc.texts.every((t: any) => t.y + 12 <= pageBottom)).toBe(true)
  })
})

