import { CONTRACT_DOCUMENT_DEFINITIONS } from '../contracts/contract-document-definitions'
import { mitraInterpolate } from '../contracts/mitra-layout.engine'
import { definitionToContentDefinition, definitionToFieldDefinitions } from './default-template-definition'
import { SYSTEM_FIELD_SEEDS } from './template-field-seeds'
import { collectAllPlaceholders, validateContentDefinition } from './template-schema.validator'

describe('default contract template definitions', () => {
  it('menghasilkan content dan field snapshot valid untuk setiap template bawaan', () => {
    for (const definition of Object.values(CONTRACT_DOCUMENT_DEFINITIONS)) {
      const content = definitionToContentDefinition(definition)
      const fields = definitionToFieldDefinitions(definition)
      const placeholders = collectAllPlaceholders(content)

      expect(fields.map(field => field.key)).toEqual(expect.arrayContaining(placeholders))
      expect(() => validateContentDefinition(content, fields.map(field => field.key), definition.family)).not.toThrow()
    }
  })

  it('memuat template MITRA Driver Truck B3 dengan tugas operasional khusus', () => {
    const definition = CONTRACT_DOCUMENT_DEFINITIONS.MITRA_DRIVER_TRUCK_B3

    expect(definition).toBeDefined()
    expect(definition.roleLabel).toBe('Driver Truck B3')
    expect(definition.sections.flatMap(section => section.paragraphs).join(' ')).toMatch(/truck|keselamatan|pengiriman/i)
  })
})

/**
 * Regresi: `publish()` menolak field SYSTEM yang tidak ada di katalog
 * (`validateFieldDefinitions`: "Field system ... tidak terdaftar di katalog").
 * PASAL 12 (PEMBERITAHUAN) memakai {{employee.phoneNumber}} dan {{employee.email}},
 * jadi keduanya WAJIB ada di `SYSTEM_FIELD_SEEDS`. Sebelumnya keduanya tidak
 * di-seed, sehingga setiap percobaan publish versi MITRA gagal dengan 400.
 */
describe('katalog field system mencakup semua placeholder SYSTEM template bawaan', () => {
  const catalog = new Set(SYSTEM_FIELD_SEEDS.map(seed => seed.key))

  it('menyediakan employee.phoneNumber dan employee.email untuk PASAL 12', () => {
    expect(catalog.has('employee.phoneNumber')).toBe(true)
    expect(catalog.has('employee.email')).toBe(true)
  })

  it('setiap placeholder non-custom definisi bawaan terdaftar di katalog seed', () => {
    for (const definition of Object.values(CONTRACT_DOCUMENT_DEFINITIONS)) {
      const content = definitionToContentDefinition(definition)
      const placeholders = [...new Set(collectAllPlaceholders(content))]
      const systemPlaceholders = placeholders.filter(key => !key.startsWith('custom.'))
      expect(systemPlaceholders.filter(key => !catalog.has(key))).toEqual([])
    }
  })
})

/**
 * Regresi: form MITRA menampilkan field dinamis "Tanggal Terbit KTP Mitra",
 * jadi nilai itu WAJIB dipakai di dalam dokumen. Sebelumnya paragraf identitas
 * PIHAK KEDUA memuat NIK tanpa tanggal terbit, sehingga tanggal yang diisi admin
 * tidak pernah muncul di PDF.
 *
 * Catatan: konten MITRA dibangun dari `definition.sections` (bukan `recitals`),
 * lihat `toLanguageBlocks()` di default-template-definition.ts.
 */
describe('Perjanjian Kemitraan — identitas PIHAK KEDUA memuat tanggal terbit KTP', () => {
  const mitraDefinitions = Object.values(CONTRACT_DOCUMENT_DEFINITIONS).filter(
    definition => definition.family === 'MITRA',
  )

  const identityParagraph = (definition: (typeof mitraDefinitions)[number]) =>
    definition.sections
      .flatMap(section => section.paragraphs)
      .find(paragraph => paragraph.includes('PIHAK KEDUA') && paragraph.includes('Kartu Tanda Penduduk'))

  it('mencakup seluruh template keluarga MITRA', () => {
    expect(mitraDefinitions.length).toBeGreaterThan(0)
  })

  it.each(mitraDefinitions.map(definition => [definition.key, definition] as const))(
    '%s menyisipkan {{custom.ktp_issued_date}} pada paragraf identitas PIHAK KEDUA',
    (_key, definition) => {
      const paragraph = identityParagraph(definition)

      expect(paragraph).toBeDefined()
      expect(paragraph).toContain('{{custom.ktp_issued_date}}')
      expect(paragraph).toContain('{{employee.nik}}')
      expect(paragraph).toMatch(/pemegang Kartu Tanda Penduduk \(KTP\) Nomor \{\{employee\.nik\}\} tertanggal \{\{custom\.ktp_issued_date\}\}/)
    },
  )

  it('placeholder tanggal KTP ikut terbit ke contentDefinition dan lolos validasi publish', () => {
    for (const definition of mitraDefinitions) {
      const content = definitionToContentDefinition(definition)
      const fields = definitionToFieldDefinitions(definition)
      const fieldKeys = [...fields.map(field => field.key), 'custom.ktp_issued_date']

      // `collectAllPlaceholders` memakai regex camelCase-only, jadi placeholder
      // custom (snake_case) diperiksa lewat teks blok langsung.
      expect(JSON.stringify(content)).toContain('{{custom.ktp_issued_date}}')
      expect(() => validateContentDefinition(content, fieldKeys, definition.family)).not.toThrow()
    }
  })

  it('mitraInterpolate mengisi tanggal terbit KTP pada kalimat identitas', () => {
    const paragraph = identityParagraph(mitraDefinitions[0])!
    const filled = mitraInterpolate(paragraph, {
      'employee.fullName': 'Nur Indah Kusuma H.',
      'employee.birthPlace': 'Jakarta',
      'employee.birthDate': '4 Januari 1994',
      'employee.nik': '3173014401940012',
      'employee.address': 'Jl Kayu Besar No. 21, Jakarta Barat',
      'custom.ktp_issued_date': '8 Agustus 2024',
    })

    expect(filled).toContain('tertanggal 8 Agustus 2024')
    expect(filled).not.toMatch(/«|\{\{/)
    expect(filled).not.toContain('«custom.ktp_issued_date»')
  })
})