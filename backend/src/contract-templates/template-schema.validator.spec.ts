import { validateContentDefinition, extractPlaceholders, findBrokenPlaceholders, collectAllPlaceholders } from './template-schema.validator'

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
  })

  it('menolak tanpa signature', () => {
    const content = {
      languages: {
        id: [{ id: 'title', type: 'title', text: 'X' }],
      },
    }
    expect(() => validateContentDefinition(content, VALID_FIELD_KEYS, 'MITRA')).toThrow(/signature/)
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
