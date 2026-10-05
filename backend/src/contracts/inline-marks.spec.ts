import {
  containsMarkDelimiters,
  escapeInlineMarks,
  hasInlineMarks,
  parseInlineRuns,
  runsToText,
  stripInlineMarks,
  validateInlineMarks,
} from './inline-marks'

/**
 * Uji modul mark inline Template Kontrak.
 *
 * Yang dijaga di sini bukan sekadar "bold bekerja", tetapi tiga sifat yang
 * membuat fitur ini aman untuk dokumen legal:
 *  1. TIDAK ADA karakter yang hilang — delimiter tanpa pasangan jadi literal.
 *  2. Placeholder `{{...}}` tetap OPAQUE (key ber-underscore tidak salah tafsir).
 *  3. Teks tanpa mark keluar 100% identik, sehingga template lama tidak berubah.
 */
describe('parseInlineRuns — dasar', () => {
  it('teks kosong menghasilkan satu run kosong tanpa mark', () => {
    expect(parseInlineRuns('')).toEqual([
      { text: '', bold: false, italic: false, underline: false },
    ])
  })

  it('teks biasa menghasilkan satu run tanpa mark', () => {
    expect(parseInlineRuns('teks biasa')).toEqual([
      { text: 'teks biasa', bold: false, italic: false, underline: false },
    ])
  })

  it('**tebal** menjadi satu run bold tanpa delimiter', () => {
    expect(parseInlineRuns('**tebal**')).toEqual([
      { text: 'tebal', bold: true, italic: false, underline: false },
    ])
  })

  it('*miring* menjadi italic', () => {
    expect(parseInlineRuns('*miring*')).toEqual([
      { text: 'miring', bold: false, italic: true, underline: false },
    ])
  })

  it('__garis__ menjadi underline', () => {
    expect(parseInlineRuns('__garis__')).toEqual([
      { text: 'garis', bold: false, italic: false, underline: true },
    ])
  })

  it('mark di tengah kalimat memecah menjadi tiga run', () => {
    expect(parseInlineRuns('a **b** c')).toEqual([
      { text: 'a ', bold: false, italic: false, underline: false },
      { text: 'b', bold: true, italic: false, underline: false },
      { text: ' c', bold: false, italic: false, underline: false },
    ])
  })

  it('***teks*** menjadi SATU run bold+italic', () => {
    expect(parseInlineRuns('***teks***')).toEqual([
      { text: 'teks', bold: true, italic: true, underline: false },
    ])
  })

  it('mark bersarang: bagian dalam menambah italic pada teks yang sudah bold', () => {
    expect(parseInlineRuns('**tebal *dan miring***')).toEqual([
      { text: 'tebal ', bold: true, italic: false, underline: false },
      { text: 'dan miring', bold: true, italic: true, underline: false },
    ])
  })

  it('mark melintasi newline tanpa terpotong', () => {
    expect(parseInlineRuns('**baris 1\nbaris 2**')).toEqual([
      { text: 'baris 1\nbaris 2', bold: true, italic: false, underline: false },
    ])
  })
})


describe('parseInlineRuns — delimiter tanpa pasangan menjadi literal', () => {
  it('* tunggal tidak dibuang', () => {
    expect(parseInlineRuns('*tak berpasangan')).toEqual([
      { text: '*tak berpasangan', bold: false, italic: false, underline: false },
    ])
  })

  it('** pembuka tanpa penutup tidak dibuang', () => {
    expect(parseInlineRuns('**a')).toEqual([
      { text: '**a', bold: false, italic: false, underline: false },
    ])
  })

  it('__ tanpa penutup tidak dibuang', () => {
    expect(parseInlineRuns('__a')).toEqual([
      { text: '__a', bold: false, italic: false, underline: false },
    ])
  })

  it('delimiter berlebih di akhir menjadi teks', () => {
    // '**a**' sah, '*' ketiga tidak punya pasangan.
    expect(parseInlineRuns('**a***')).toEqual([
      { text: 'a', bold: true, italic: false, underline: false },
      { text: '*', bold: false, italic: false, underline: false },
    ])
  })

  it('pasangan tanpa isi tidak menghilangkan karakter', () => {
    // 'a****b' — kalau pasangan kosong dianggap mark, keempat bintang HILANG.
    expect(parseInlineRuns('a****b')).toEqual([
      { text: 'a****b', bold: false, italic: false, underline: false },
    ])
    expect(parseInlineRuns('****')).toEqual([
      { text: '****', bold: false, italic: false, underline: false },
    ])
    expect(parseInlineRuns('a____b')).toEqual([
      { text: 'a____b', bold: false, italic: false, underline: false },
    ])
  })

  it('tanda bintang tunggal di kalimat legal tetap utuh', () => {
    const text = 'Ketentuan ini berlaku untuk pasal 1 * dan pasal 2.'
    expect(parseInlineRuns(text)).toEqual([
      { text, bold: false, italic: false, underline: false },
    ])
  })
})

describe('parseInlineRuns — escape', () => {
  it('\\* menghasilkan bintang literal tanpa mark', () => {
    expect(parseInlineRuns('\\*literal\\*')).toEqual([
      { text: '*literal*', bold: false, italic: false, underline: false },
    ])
  })

  it('\\_ menghasilkan garis bawah literal', () => {
    expect(parseInlineRuns('\\_x\\_')).toEqual([
      { text: '_x_', bold: false, italic: false, underline: false },
    ])
  })

  it('backslash ganda menghasilkan satu backslash', () => {
    expect(parseInlineRuns('a\\\\b')).toEqual([
      { text: 'a\\b', bold: false, italic: false, underline: false },
    ])
  })

  it('backslash di depan karakter biasa dibiarkan apa adanya', () => {
    expect(parseInlineRuns('C:\\temp')).toEqual([
      { text: 'C:\\temp', bold: false, italic: false, underline: false },
    ])
  })
})

describe('parseInlineRuns — placeholder OPAQUE', () => {
  it('{{custom.ktp_issued_date}} tidak dianggap underline', () => {
    expect(parseInlineRuns('{{custom.ktp_issued_date}}')).toEqual([
      { text: '{{custom.ktp_issued_date}}', bold: false, italic: false, underline: false },
    ])
  })

  it('placeholder di dalam mark mewarisi mark-nya', () => {
    expect(parseInlineRuns('**{{employee.fullName}}**')).toEqual([
      { text: '{{employee.fullName}}', bold: true, italic: false, underline: false },
    ])
  })

  it('dua placeholder ber-underscore tidak saling memengaruhi', () => {
    const text = '{{custom.a_b}} dan {{custom.c_d}}'
    expect(parseInlineRuns(text)).toEqual([
      { text, bold: false, italic: false, underline: false },
    ])
  })

  it('{{ pembuka tanpa penutup jatuh ke teks biasa', () => {
    const text = '{{bukan placeholder'
    expect(parseInlineRuns(text)).toEqual([
      { text, bold: false, italic: false, underline: false },
    ])
  })
})

describe('invariant round-trip', () => {
  const plainSamples = [
    '',
    'teks biasa',
    'PASAL 1\nRUANG LINGKUP',
    'Nomor: 220/KUKP-SII/2026',
    "KOPERASI PT. SANKYU INT'L",
    'Warga Negara Indonesia, lahir di Jakarta',
    'snake_case_field dan lain-lain',
    '{{employee.fullName}} beralamat di {{employee.address}}',
    'Harga 100% dari Rp 4.000.000,-',
    'a - b (c) [d] {e}',
  ]

  it('teks tanpa mark keluar 100% identik (tidak ada karakter hilang)', () => {
    for (const sample of plainSamples) {
      expect(runsToText(parseInlineRuns(sample))).toBe(sample)
    }
  })

  it('serialisasi kanonik bersifat idempoten', () => {
    const markedSamples = [
      '**tebal**',
      '*miring*',
      '__garis__',
      'a **b** c',
      '***teks***',
      '**tebal *dan miring***',
      '*tak berpasangan',
      '**a***',
      '\\*literal\\*',
      '**{{employee.fullName}}**',
    ]
    for (const sample of markedSamples) {
      const first = parseInlineRuns(sample)
      const second = parseInlineRuns(runsToText(first))
      expect(second).toEqual(first)
    }
  })

  it('stripInlineMarks tidak pernah menghilangkan teks', () => {
    for (const sample of plainSamples) {
      expect(stripInlineMarks(sample)).toBe(sample)
    }
  })
})

describe('stripInlineMarks / hasInlineMarks', () => {
  it('membuang delimiter tetapi mempertahankan teks', () => {
    expect(stripInlineMarks('Halo **dunia** *indah* __sekali__')).toBe('Halo dunia indah sekali')
  })

  it('delimiter tanpa pasangan ikut dipertahankan', () => {
    expect(stripInlineMarks('*a')).toBe('*a')
  })

  it('hasInlineMarks false untuk teks polos dan delimiter tak berpasangan', () => {
    expect(hasInlineMarks('teks biasa')).toBe(false)
    expect(hasInlineMarks('*a')).toBe(false)
    expect(hasInlineMarks('__a')).toBe(false)
    expect(hasInlineMarks('')).toBe(false)
  })

  it('hasInlineMarks true hanya bila ada mark sah', () => {
    expect(hasInlineMarks('**a**')).toBe(true)
    expect(hasInlineMarks('*a*')).toBe(true)
    expect(hasInlineMarks('__a__')).toBe(true)
  })
})

describe('containsMarkDelimiters / escapeInlineMarks', () => {
  it('mendeteksi delimiter di luar placeholder', () => {
    expect(containsMarkDelimiters('**a**')).toBe(true)
    expect(containsMarkDelimiters('*a')).toBe(true)
    expect(containsMarkDelimiters('__a__')).toBe(true)
  })

  it('mengabaikan isi placeholder', () => {
    expect(containsMarkDelimiters('{{custom.a_b}}')).toBe(false)
    expect(containsMarkDelimiters('teks biasa')).toBe(false)
    expect(containsMarkDelimiters('')).toBe(false)
  })

  it('escape menetralkan karakter khusus tanpa merusak underscore tunggal', () => {
    expect(escapeInlineMarks('a*b_c\\d')).toBe('a\\*b_c\\\\d')
    expect(escapeInlineMarks('a__b')).toBe('a\\_\\_b')
    expect(parseInlineRuns(escapeInlineMarks('**a**'))).toEqual([
      { text: '**a**', bold: false, italic: false, underline: false },
    ])
  })

  it('teks ber-underscore tunggal tidak berubah setelah escape', () => {
    expect(escapeInlineMarks('snake_case_field')).toBe('snake_case_field')
  })
})


describe('validateInlineMarks', () => {
  it('mark sah tidak menghasilkan issue', () => {
    const result = validateInlineMarks('**tebal** dan *miring*')
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('delimiter tanpa pasangan hanya warning, bukan error', () => {
    // PENTING: teks lama yang memuat '*' tunggal tidak boleh menggagalkan publish.
    const result = validateInlineMarks('*tak berpasangan')
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({ severity: 'warning', kind: 'unpaired' })
  })

  it('allowMarks:false menolak mark yang sah', () => {
    const result = validateInlineMarks('**tebal**', { allowMarks: false })
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatchObject({ severity: 'error', kind: 'forbidden' })
  })

  it('allowMarks:false tetap MELOLOSKAN tanda bintang tunggal', () => {
    // Regresi yang dicegah: judul pasal berisi '*' literal tidak boleh gagal publish.
    const result = validateInlineMarks('PASAL 1 * CATATAN', { allowMarks: false })
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('allowMarks:false meloloskan teks tanpa delimiter', () => {
    expect(validateInlineMarks('PASAL 1\nRUANG LINGKUP', { allowMarks: false }).ok).toBe(true)
  })

  it('pesan issue menyebut lokasi bila diberikan', () => {
    const result = validateInlineMarks('**a**', { allowMarks: false, location: 'judul pasal' })
    expect(result.issues[0].message).toContain('judul pasal')
  })

  it('input kosong / null aman', () => {
    expect(validateInlineMarks('').ok).toBe(true)
    expect(validateInlineMarks(null as never).ok).toBe(true)
    expect(parseInlineRuns(null as never)).toEqual([
      { text: '', bold: false, italic: false, underline: false },
    ])
    expect(stripInlineMarks(null as never)).toBe('')
    expect(hasInlineMarks(null as never)).toBe(false)
    expect(containsMarkDelimiters(null as never)).toBe(false)
  })
})

