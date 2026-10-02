import {
  applyTemplateBindings,
  extractContractInputFields,
  normalizeVersionFieldDefinitions,
} from './template-field-bindings.helpers'

describe('normalizeVersionFieldDefinitions', () => {
  it('menerima array, { fields: [] }, dan nilai kosong', () => {
    expect(normalizeVersionFieldDefinitions([{ key: 'a', required: true }]).map(d => d.key)).toEqual(['a'])
    expect(normalizeVersionFieldDefinitions({ fields: [{ key: 'b' }] }).map(d => d.key)).toEqual(['b'])
    expect(normalizeVersionFieldDefinitions(undefined)).toEqual([])
    expect(normalizeVersionFieldDefinitions(null)).toEqual([])
  })

  it('menormalkan key custom.xxx milik CONTRACT_INPUT menjadi key tanpa prefix', () => {
    const [definition] = normalizeVersionFieldDefinitions([
      { key: 'custom.ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: true },
    ])
    expect(definition.key).toBe('ktp_issued_date')
    expect(definition.sourceType).toBe('CONTRACT_INPUT')
    expect(definition.required).toBe(true)
  })

  it('tidak memaksa required true untuk field tanpa flag required', () => {
    const [definition] = normalizeVersionFieldDefinitions([{ key: 'employee.nik' }])
    expect(definition.sourceType).toBe('SYSTEM')
    expect(definition.required).toBe(false)
  })

  it('membuang entri tanpa key string yang valid', () => {
    const result = normalizeVersionFieldDefinitions([null, {}, { key: '' }, { key: 'ok' }])
    expect(result.map(d => d.key)).toEqual(['ok'])
  })
})

describe('applyTemplateBindings', () => {
  const ktpBinding = {
    required: true,
    sortOrder: 0,
    field: { key: 'ktp_issued_date', label: 'Tanggal Terbit KTP Mitra', dataType: 'DATE', sourceType: 'CONTRACT_INPUT' },
  }

  it('menambahkan field CONTRACT_INPUT yang ter-bind tetapi belum ada di fieldDefinitions', () => {
    const result = applyTemplateBindings([{ key: 'employee.nik', sourceType: 'SYSTEM', required: true }], [ktpBinding])

    expect(result.map(d => d.key)).toEqual(['employee.nik', 'ktp_issued_date'])
    const ktp = result[1]
    expect(ktp.label).toBe('Tanggal Terbit KTP Mitra')
    expect(ktp.dataType).toBe('DATE')
    expect(ktp.sourceType).toBe('CONTRACT_INPUT')
    expect(ktp.required).toBe(true)
  })

  it('menyelaraskan required field yang sudah ada dari binding (dua arah)', () => {
    const optional = applyTemplateBindings(
      [{ key: 'ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: true }],
      [{ ...ktpBinding, required: false }],
    )
    expect(optional).toHaveLength(1)
    expect(optional[0].required).toBe(false)

    const mandatory = applyTemplateBindings(
      [{ key: 'ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: false }],
      [ktpBinding],
    )
    expect(mandatory[0].required).toBe(true)
  })

  it('mencocokkan binding dengan key versi yang masih memakai prefix custom.', () => {
    const result = applyTemplateBindings(
      [{ key: 'custom.ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: false }],
      [ktpBinding],
    )
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('ktp_issued_date')
    expect(result[0].required).toBe(true)
  })

  it('mengabaikan binding SYSTEM dan MASTER_REFERENCE', () => {
    const result = applyTemplateBindings([], [
      { required: true, sortOrder: 0, field: { key: 'employee.nik', sourceType: 'SYSTEM' } },
      { required: true, sortOrder: 1, field: { key: 'vendor.name', sourceType: 'MASTER_REFERENCE', dataType: 'MASTER_REFERENCE' } },
    ])
    expect(result).toEqual([])
  })

  it('mengurutkan field baru mengikuti sortOrder binding', () => {
    const result = applyTemplateBindings([], [
      { required: false, sortOrder: 2, field: { key: 'b', sourceType: 'CONTRACT_INPUT', label: 'B' } },
      { required: false, sortOrder: 1, field: { key: 'a', sourceType: 'CONTRACT_INPUT', label: 'A' } },
    ])
    expect(result.map(d => d.key)).toEqual(['a', 'b'])
  })

  it('mempertahankan options/sourceConfig katalog pada field baru', () => {
    const result = applyTemplateBindings([], [{
      required: false,
      sortOrder: 0,
      field: {
        key: 'shift',
        label: 'Shift',
        dataType: 'DROPDOWN',
        sourceType: 'CONTRACT_INPUT',
        options: ['PAGI', 'SIANG'],
      },
    }])
    expect(result[0].options).toEqual(['PAGI', 'SIANG'])
  })

  it('tidak menghapus field dinamis yang tidak ter-bind (editor tetap bisa menambah)', () => {
    const result = applyTemplateBindings(
      [{ key: 'catatan_tambahan', sourceType: 'CONTRACT_INPUT', required: false }],
      [],
    )
    expect(result.map(d => d.key)).toEqual(['catatan_tambahan'])
  })

  it('tidak menggandakan key yang sudah ada', () => {
    const result = applyTemplateBindings(
      [{ key: 'ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: true }],
      [ktpBinding, ktpBinding],
    )
    expect(result).toHaveLength(1)
  })

  it('menerima bentuk { fields: [] } sebagai masukan', () => {
    const result = applyTemplateBindings({ fields: [{ key: 'employee.nik', sourceType: 'SYSTEM' }] }, [ktpBinding])
    expect(result.map(d => d.key)).toEqual(['employee.nik', 'ktp_issued_date'])
  })

  describe('uncheck "Pakai" (catalogContractInputKeys)', () => {
    it('menghapus field katalog yang tidak ter-bind ke template', () => {
      const result = applyTemplateBindings(
        [
          { key: 'employee.nik', sourceType: 'SYSTEM', required: true },
          { key: 'ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: false },
        ],
        [], // tidak ada binding → ktp_issued_date dilepas
        { catalogContractInputKeys: ['ktp_issued_date', 'shift_code'] },
      )
      expect(result.map(d => d.key)).toEqual(['employee.nik'])
    })

    it('mempertahankan field yang masih ter-bind', () => {
      const result = applyTemplateBindings(
        [{ key: 'ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: false }],
        [ktpBinding],
        { catalogContractInputKeys: ['ktp_issued_date'] },
      )
      expect(result.map(d => d.key)).toEqual(['ktp_issued_date'])
    })

    it('mempertahankan field dinamis di luar katalog (placeholder lepasan editor)', () => {
      const result = applyTemplateBindings(
        [{ key: 'catatan_tambahan', sourceType: 'CONTRACT_INPUT', required: false }],
        [],
        { catalogContractInputKeys: ['ktp_issued_date'] },
      )
      expect(result.map(d => d.key)).toEqual(['catatan_tambahan'])
    })

    it('tidak menyentuh field SYSTEM', () => {
      const result = applyTemplateBindings(
        [{ key: 'employee.nik', sourceType: 'SYSTEM', required: true }],
        [],
        { catalogContractInputKeys: ['employee.nik'] },
      )
      expect(result.map(d => d.key)).toEqual(['employee.nik'])
    })

    it('tanpa opsi, perilaku lama dipertahankan (tidak menghapus)', () => {
      const result = applyTemplateBindings(
        [{ key: 'ktp_issued_date', sourceType: 'CONTRACT_INPUT', required: false }],
        [],
      )
      expect(result.map(d => d.key)).toEqual(['ktp_issued_date'])
    })
  })
})

describe('extractContractInputFields', () => {
  it('hanya mengembalikan field CONTRACT_INPUT dan mempertahankan urutannya', () => {
    const fields = extractContractInputFields([
      { key: 'employee.nik', label: 'NIK', dataType: 'TEXT', sourceType: 'SYSTEM', required: true },
      { key: 'ktp_issued_date', label: 'Tanggal Terbit KTP Mitra', dataType: 'DATE', sourceType: 'CONTRACT_INPUT', required: true },
      { key: 'contract.startDate', label: 'Mulai', dataType: 'DATE', sourceType: 'SYSTEM' },
      { key: 'catatan', label: 'Catatan', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT', required: false },
    ])

    expect(fields).toEqual([
      { key: 'ktp_issued_date', label: 'Tanggal Terbit KTP Mitra', dataType: 'DATE', required: true },
      { key: 'catatan', label: 'Catatan', dataType: 'TEXT', required: false },
    ])
  })

  it('membuang prefix custom. agar sesuai key yang dipakai form & resolver', () => {
    const fields = extractContractInputFields([
      { key: 'custom.ktp_issued_date', label: 'KTP', dataType: 'DATE', sourceType: 'CONTRACT_INPUT', required: true },
    ])

    expect(fields[0].key).toBe('ktp_issued_date')
  })

  it('memakai key sebagai label bila label kosong/hilang', () => {
    const fields = extractContractInputFields([
      { key: 'tanpa_label', sourceType: 'CONTRACT_INPUT' },
      { key: 'label_kosong', label: '', sourceType: 'CONTRACT_INPUT' },
    ])

    expect(fields.map(f => f.label)).toEqual(['tanpa_label', 'label_kosong'])
  })

  it('menormalkan dataType tak dikenal menjadi TEXT agar form tetap bisa render', () => {
    const fields = extractContractInputFields([
      { key: 'aneh', label: 'Aneh', dataType: 'JSON', sourceType: 'CONTRACT_INPUT' },
      { key: 'tanpa_tipe', label: 'Tanpa Tipe', sourceType: 'CONTRACT_INPUT' },
    ])

    expect(fields.map(f => f.dataType)).toEqual(['TEXT', 'TEXT'])
  })

  it('menganggap required hanya bila benar-benar true', () => {
    const fields = extractContractInputFields([
      { key: 'a', label: 'A', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT', required: 'true' },
      { key: 'b', label: 'B', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT', required: true },
    ])

    expect(fields.map(f => f.required)).toEqual([false, true])
  })

  it('meneruskan options & sourceConfig hanya bila ada', () => {
    const fields = extractContractInputFields([
      {
        key: 'shift',
        label: 'Shift',
        dataType: 'DROPDOWN',
        sourceType: 'CONTRACT_INPUT',
        required: true,
        options: ['PAGI', 'SIANG'],
      },
      { key: 'polos', label: 'Polos', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT' },
    ])

    expect(fields[0].options).toEqual(['PAGI', 'SIANG'])
    expect('options' in fields[1]).toBe(false)
    expect('sourceConfig' in fields[1]).toBe(false)
  })

  it('menerima bentuk { fields: [] } dan nilai kosong', () => {
    expect(extractContractInputFields({ fields: [{ key: 'a', label: 'A', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT' }] }))
      .toEqual([{ key: 'a', label: 'A', dataType: 'TEXT', required: false }])
    expect(extractContractInputFields(undefined)).toEqual([])
    expect(extractContractInputFields(null)).toEqual([])
    expect(extractContractInputFields([])).toEqual([])
  })
})
