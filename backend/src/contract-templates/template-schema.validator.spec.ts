import { validateContentDefinition, extractPlaceholders, findBrokenPlaceholders, collectAllPlaceholders, normalizeCustomPlaceholders, normalizeArticleHeadings } from './template-schema.validator'

const VALID_FIELD_KEYS = ['employee.fullName', 'contract.contractNo', 'contract.termRange', 'contract.duration', 'custom.ktp_issued_date']

function baseContent(extra: (b: any[]) => any[] = b => b) {
  return {
    languages: {
      id: extra([
        { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        { id: 'sig', type: 'signature' },
      ]),
    },
  }
}

describe('extractPlaceholders', () => {
  it('mengekstrak placeholder valid', () => {
    expect(extractPlaceholders('Nama {{employee.fullName}} no {{contract.contractNo}}')).toEqual([
      'employee.fullName',
      'contract.contractNo',
    ])
  })

  it('tidak mengekstrak teks biasa', () => {
    expect(extractPlaceholders('tanpa placeholder')).toEqual([])
  })

  it('deteksi placeholder rusak', () => {
    expect(findBrokenPlaceholders('ini {{broken placeholder')).toBe(true)
    expect(findBrokenPlaceholders('ini {{valid.key}} placeholder')).toBe(false)
  })
})

describe('collectAllPlaceholders', () => {
  it('mengumpulkan placeholder dari semua blok dan bahasa', () => {
    const content = {
      languages: {
        id: [
          { id: 'p1', type: 'paragraph', text: 'No {{contract.contractNo}}' },
        ],
        en: [
          { id: 'a1', type: 'article', heading: 'ARTICLE 1', paragraphs: ['Signed by {{employee.fullName}} on {{contract.termRange}}'] },
        ],
      },
    }
    const result = collectAllPlaceholders(content).sort()
    expect(result).toEqual(['contract.contractNo', 'contract.termRange', 'employee.fullName'].sort())
  })
})

describe('validateContentDefinition', () => {
  it('menerima konten valid minimal', () => {
    const result = validateContentDefinition(baseContent(), VALID_FIELD_KEYS, 'MITRA')
    expect(result.blockCount).toBe(2)
    expect(result.markedBlockCount).toBe(0)
    expect(result.alignedBlockCount).toBe(0)
    expect(result.inlineMarkWarnings).toEqual([])
  })

  it('menerima mark di paragraph dan article paragraphs serta menghitung blok unik', () => {
    const content = baseContent(blocks => [
      { id: 'p', type: 'paragraph', text: '**Tebal** dan *miring*' },
      { id: 'article', type: 'article', heading: 'PASAL 1', paragraphs: ['__garis__', '**tebal**'] },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    const result = validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
    expect(result.markedBlockCount).toBe(2)
    expect(result.inlineMarkWarnings).toEqual([])
  })

  it.each([
    ['article heading', { id: 'article', type: 'article', heading: '**PASAL 1**', paragraphs: ['Teks'] }, /\.heading$/],
    ['title text', { id: 'title', type: 'title', text: '**JUDUL**' }, /\.text$/],
    ['list item', { id: 'list', type: 'list', style: 'bullet', items: ['**item**'] }, /items\[0\]/],
    ['table cell', {
      id: 'table', type: 'table', columns: [{ key: 'value', label: 'Nilai' }], rows: [{ value: '**sel**' }],
    }, /rows\[0\]\.value/],
    ['signature text', { id: 'sig', type: 'signature', text: '**Nama**' }, /\.text$/],
    ['page break text', { id: 'break', type: 'pageBreak', text: '**halaman baru**' }, /\.text$/],
  ])('menolak mark di %s', (_label, disallowedBlock, fieldPathPattern) => {
    const content = baseContent(blocks => [
      ...blocks.filter(block => block.type !== 'signature'),
      disallowedBlock,
      ...(disallowedBlock.type === 'signature' ? [] : blocks.filter(block => block.type === 'signature')),
    ])
    try {
      validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
      throw new Error('Expected validator to reject inline marks')
    } catch (error: any) {
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ fieldPath: expect.stringMatching(fieldPathPattern) }),
      ]))
    }
  })

  it.each(['middle', '', 1, null])('rejects invalid block alignment %p', align => {
    const content = baseContent(blocks => [
      { id: 'p', type: 'paragraph', text: 'Body', align },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/align/)
  })

  it('menolak align pada jenis blok yang tidak mendukung dan tidak menghitungnya', () => {
    const content = baseContent(blocks => [
      { id: 'title-aligned', type: 'title', text: 'Title', align: 'center' },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    try {
      validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
      throw new Error('Expected validator to reject alignment on title')
    } catch (error: any) {
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ fieldPath: 'languages.id[0].align', message: expect.stringMatching(/tidak didukung/) }),
      ]))
    }
  })

  it('menghitung hanya alignment paragraph/article yang valid', () => {
    const content = baseContent(blocks => [
      { id: 'p', type: 'paragraph', text: 'Body', align: 'right' },
      { id: 'a', type: 'article', heading: 'PASAL 1', paragraphs: ['Body'], align: 'justify' },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    const result = validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
    expect(result.alignedBlockCount).toBe(2)
  })

  it('menerima headingAlign pada blok article', () => {
    const content = baseContent(blocks => [
      { id: 'a', type: 'article', heading: 'PASAL 1', paragraphs: ['Body'], headingAlign: 'center' },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).not.toThrow()
  })

  it('menolak headingAlign dengan nilai tidak valid', () => {
    const content = baseContent(blocks => [
      { id: 'a', type: 'article', heading: 'PASAL 1', paragraphs: ['Body'], headingAlign: 'middle' },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    try {
      validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
      throw new Error('Expected validator to reject invalid headingAlign')
    } catch (error: any) {
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          fieldPath: 'languages.id[0].headingAlign',
          message: expect.stringMatching(/headingAlign/),
        }),
      ]))
    }
  })

  it('menolak headingAlign pada blok selain article', () => {
    const content = baseContent(blocks => [
      { id: 'p', type: 'paragraph', text: 'Body', headingAlign: 'center' },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    try {
      validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
      throw new Error('Expected validator to reject headingAlign on paragraph')
    } catch (error: any) {
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          fieldPath: 'languages.id[0].headingAlign',
          message: expect.stringMatching(/hanya didukung pada blok article/),
        }),
      ]))
    }
  })

  it('menerima spaceAfter valid pada blok konten MITRA dan menghitungnya', () => {
    const content = baseContent(blocks => [
      { id: 'p', type: 'paragraph', text: 'Body', spaceAfter: 12 },
      { id: 'a', type: 'article', heading: 'PASAL 1', paragraphs: ['Body'], spaceAfter: 0 },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    const result = validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
    expect(result.spacedBlockCount).toBe(2)
  })

  it.each([-1, 41, 12.5, '12', null])('menolak spaceAfter tidak valid %p', value => {
    const content = baseContent(blocks => [
      { id: 'p', type: 'paragraph', text: 'Body', spaceAfter: value },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/spaceAfter/)
  })

  it('menolak spaceAfter pada blok yang tidak mendukung (pageBreak)', () => {
    const content = baseContent(blocks => [
      { id: 'pb', type: 'pageBreak', spaceAfter: 10 },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    try {
      validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
      throw new Error('Expected validator to reject spaceAfter on pageBreak')
    } catch (error: any) {
      expect(error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          fieldPath: 'languages.id[0].spaceAfter',
          message: expect.stringMatching(/tidak didukung pada blok pageBreak/),
        }),
      ]))
    }
  })

  it('menolak spaceAfter pada template PKWT', () => {
    const content = {
      languages: {
        id: [
          { id: 'p', type: 'paragraph', text: 'Body', spaceAfter: 10 },
          { id: 'sig', type: 'signature' },
        ],
        en: [
          { id: 'p-en', type: 'paragraph', text: 'Body' },
          { id: 'sig-en', type: 'signature' },
        ],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'PKWT')).toThrow(/spaceAfter/)
  })

  it('melaporkan delimiter tak berpasangan sebagai warning tanpa menggagalkan validasi', () => {
    const content = baseContent(blocks => [
      { id: 'p', type: 'paragraph', text: 'Asterisk *literal' },
      ...blocks.filter(block => block.type === 'signature'),
    ])
    const result = validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
    expect(result.inlineMarkWarnings).toEqual([
      expect.objectContaining({ blockId: 'p', fieldPath: 'languages.id[0].text', message: expect.stringMatching(/tidak memiliki pasangan/) }),
    ])
  })

  it('menolak tanpa signature', () => {
    const content = {
      languages: {
        id: [{ id: 'title', type: 'title', text: 'X' }],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/signature/)
  })

  it('menolak lebih dari satu blok signature (agar tidak duplikat)', () => {
    const content = baseContent(b => [
      ...b,
      { id: 'sig-2', type: 'signature' },
    ])
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA'))
      .toThrow(/Hanya satu blok tanda tangan/i)
  })

  it('menerima tepat satu blok signature', () => {
    const content = baseContent()
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).not.toThrow()
  })

  it('menolak MITRA tanpa konten', () => {
    const content = { languages: { id: [] } }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow()
  })

  it('menolak blok dengan tipe tidak dikenal', () => {
    const content = baseContent(b => [
      ...b,
      { id: 'bad', type: 'freeformHtml', html: '<script>' },
    ])
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/tidak didukung/)
  })

  it('menolak placeholder tidak terdaftar', () => {
    const content = {
      languages: {
        id: [
          { id: 'p', type: 'paragraph', text: 'Nama {{employee.unknownField}}' },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/tidak terdaftar/)
  })

  it('menerima placeholder yang tervalidasi', () => {
    const content = {
      languages: {
        id: [
          { id: 'p', type: 'paragraph', text: 'No {{contract.contractNo}} periode {{contract.termRange}}' },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    const result = validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')
    expect(result.placeholderCount).toBe(2)
  })

  it('menolak placeholder rusak', () => {
    const content = {
      languages: {
        id: [
          { id: 'p', type: 'paragraph', text: 'Rusak {{employee fullName}}' },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow()
  })

  it('menolak ID blok duplikat', () => {
    const content = {
      languages: {
        id: [
          { id: 'p1', type: 'paragraph', text: 'A' },
          { id: 'p1', type: 'paragraph', text: 'B' },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/duplikat/)
  })

  it('table: kolom & baris tervalidasi', () => {
    const content = {
      languages: {
        id: [
          {
            id: 'tbl',
            type: 'table',
            columns: [
              { key: 'comp', label: 'Komponen' },
              { key: 'amt', label: 'Jumlah', format: 'currency' },
            ],
            rows: [{ comp: 'Upah Pokok', amt: '{{contract.baseCompensation}}', unknownKey: 'x' }],
          },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/tidak dikenal/)
  })

  it('list: style tidak valid ditolak', () => {
    const content = {
      languages: {
        id: [
          { id: 'list', type: 'list', style: 'weird', items: ['a', 'b'] },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/style/)
  })

  it('list alphabetic valid (sub-butir MITRA)', () => {
    const content = {
      languages: {
        id: [
          {
            id: 'eval-list',
            type: 'list',
            style: 'alphabetic',
            items: [{ text: 'pembahasan perkembangan' }, { text: 'hal-hal lain' }],
          },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).not.toThrow()
  })
})

describe('normalizeCustomPlaceholders', () => {
  it('menambahkan prefix custom. pada key CONTRACT_INPUT tanpa prefix', () => {
    const content = {
      languages: {
        id: [
          { id: 'p', type: 'paragraph', text: 'No {{contract.contractNo}} tgl {{ktp_issued_date}}.' },
          { id: 'sig', type: 'signature' },
        ],
      },
    }
    const fixed = normalizeCustomPlaceholders(content, ['ktp_issued_date', 'shift_code'])
    expect(fixed).toBe(1)
    expect(content.languages.id[0].text).toBe('No {{contract.contractNo}} tgl {{custom.ktp_issued_date}}.')
  })

  it('tidak menyentuh placeholder sistem yang sudah benar', () => {
    const content = { languages: { id: [{ id: 'p', type: 'paragraph', text: '{{employee.fullName}}' }] } }
    const fixed = normalizeCustomPlaceholders(content, ['ktp_issued_date'])
    expect(fixed).toBe(0)
    expect(content.languages.id[0].text).toBe('{{employee.fullName}}')
  })

  it('tidak menyentuh key yang bukan field CONTRACT_INPUT', () => {
    const content = { languages: { id: [{ id: 'p', type: 'paragraph', text: '{{tidak_dikenal}}' }] } }
    const fixed = normalizeCustomPlaceholders(content, ['ktp_issued_date'])
    expect(fixed).toBe(0)
    expect(content.languages.id[0].text).toBe('{{tidak_dikenal}}')
  })

  it('menormalkan item list, baris tabel, dan heading', () => {
    const content = {
      languages: {
        id: [
          { id: 'a', type: 'article', heading: 'Pasal {{shift_code}}', paragraphs: ['x {{ktp_issued_date}}'] },
          { id: 'l', type: 'list', items: ['{{shift_code}}'] },
          { id: 't', type: 'table', columns: [{ key: 'c', label: 'C' }], rows: [{ c: '{{ktp_issued_date}}' }] },
        ],
      },
    }
    const fixed = normalizeCustomPlaceholders(content, ['ktp_issued_date', 'shift_code'])
    expect(fixed).toBe(4)
    expect(content.languages.id[0].heading).toBe('Pasal {{custom.shift_code}}')
    expect(content.languages.id[0].paragraphs[0]).toBe('x {{custom.ktp_issued_date}}')
    expect(content.languages.id[1].items[0]).toBe('{{custom.shift_code}}')
    expect(content.languages.id[2].rows[0].c).toBe('{{custom.ktp_issued_date}}')
  })

  it('menerima key dengan prefix custom. sebagai input daftar', () => {
    const content = { languages: { id: [{ id: 'p', type: 'paragraph', text: '{{ktp_issued_date}}' }] } }
    expect(normalizeCustomPlaceholders(content, ['custom.ktp_issued_date'])).toBe(1)
    expect(content.languages.id[0].text).toBe('{{custom.ktp_issued_date}}')
  })
})

describe('normalizeArticleHeadings', () => {
  function articleContent(heading: string, type = 'article') {
    return { languages: { id: [{ id: 'a1', type, heading, paragraphs: ['x'] }] } }
  }

  it('membiarkan judul 2 baris yang sudah benar tanpa perubahan', () => {
    const content = articleContent('PASAL 1\nRUANG LINGKUP')
    expect(normalizeArticleHeadings(content)).toBe(0)
    expect(content.languages.id[0].heading).toBe('PASAL 1\nRUANG LINGKUP')
  })

  it('menggabungkan baris kosong hasil tempel-teks (\\n\\n)', () => {
    const content = articleContent('PASAL 1\n\nRUANG LINGKUP')
    expect(normalizeArticleHeadings(content)).toBe(1)
    expect(content.languages.id[0].heading).toBe('PASAL 1\nRUANG LINGKUP')
  })

  it('memotong judul yang lebih dari 2 baris', () => {
    const content = articleContent('PASAL 1\nRUANG\nLINGKUP')
    expect(normalizeArticleHeadings(content)).toBe(1)
    expect(content.languages.id[0].heading).toBe('PASAL 1\nRUANG')
  })

  it('menormalkan CRLF dan membuang baris kosong di tepi', () => {
    const content = articleContent('\r\nPASAL 3\r\nJANGKA WAKTU\r\n\r\n')
    expect(normalizeArticleHeadings(content)).toBe(1)
    expect(content.languages.id[0].heading).toBe('PASAL 3\nJANGKA WAKTU')
  })

  it('membuang spasi di ujung tiap baris', () => {
    const content = articleContent('PASAL 4  \nKEADAAN MEMAKSA ')
    expect(normalizeArticleHeadings(content)).toBe(1)
    expect(content.languages.id[0].heading).toBe('PASAL 4\nKEADAAN MEMAKSA')
  })

  it('mengubah judul yang hanya berisi spasi/baris kosong menjadi string kosong', () => {
    const content = articleContent(' \n \n ')
    expect(normalizeArticleHeadings(content)).toBe(1)
    expect(content.languages.id[0].heading).toBe('')
  })

  it('tidak menyentuh blok non-article', () => {
    const content = { languages: { id: [{ id: 't', type: 'title', text: 'A\n\nB\nC' }] } }
    expect(normalizeArticleHeadings(content)).toBe(0)
    expect(content.languages.id[0].text).toBe('A\n\nB\nC')
  })

  it('idempoten: pemanggilan kedua tidak mengubah apa pun', () => {
    const content = articleContent('PASAL 5\n\nA\nB\nC  ')
    expect(normalizeArticleHeadings(content)).toBe(1)
    const once = content.languages.id[0].heading
    expect(normalizeArticleHeadings(content)).toBe(0)
    expect(content.languages.id[0].heading).toBe(once)
  })

  it('aman untuk konten tanpa languages', () => {
    expect(normalizeArticleHeadings({})).toBe(0)
    expect(normalizeArticleHeadings(null)).toBe(0)
  })
})
