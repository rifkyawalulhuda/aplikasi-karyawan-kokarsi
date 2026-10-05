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

  /**
   * Regresi: blok identitas PIHAK KEDUA pada draft PKWT memuat baris
   * `Jenis Kelamin : {{employee.gender}}`. Bila key itu tidak ada di katalog,
   * `validateContentDefinition()` menolak publish dengan "Placeholder ...
   * tidak terdaftar di katalog field", dan picker field di editor template tidak
   * pernah menampilkannya. Nilainya enum Prisma (`MALE`/`FEMALE`), jadi label
   * katalognya juga dipakai `resolvePlaceholderValue()` untuk mencetak
   * "Laki-laki"/"Male" — lihat `genderLabel`.
   */
  it('menyediakan employee.gender untuk blok identitas PIHAK KEDUA PKWT', () => {
    const seed = SYSTEM_FIELD_SEEDS.find(item => item.key === 'employee.gender')

    expect(seed).toBeDefined()
    expect(seed!.label).toBe('Jenis Kelamin')
    expect(seed!.dataType).toBe('TEXT')
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

/**
 * Penanda redaksi Indonesia yang TIDAK boleh muncul di kolom kanan PKWT.
 *
 * Sengaja memakai frasa yang hanya ada di definisi Indonesia (bukan kata umum
 * seperti `Karyawan` yang memang bagian dari `Koperasi Karyawan`).
 */
const INDONESIAN_MARKERS = [
  'Pada hari ini',
  'Demikian Kesepakatan',
  'Para Pihak',
  'Ruang Lingkup',
  'Jangka Waktu',
  'Upah Karyawan',
  'Penutup',
  'PIHAK PERTAMA adalah',
  'PIHAK KEDUA adalah',
  'Perusahaan mempekerjakan',
  'Jangka waktu kesepakatan',
  'Upah/imbalan yang disepakati',
  'Kesepakatan kerja ini berlaku',
  'Dengan lokasi kerja',
  'dibuat tanpa adanya desakan',
  'Maksud Kesepakatan',
  'Masa Berlakunya',
  'Pengupahan',
  'Waktu Kerja',
  'Tata Tertib',
  'Disiplin Kerja',
  'Mangkir',
  'Berakhirnya',
  'Tugas dan Tanggung',
  'Penyelesaian Keluh',
]

/**
 * Regresi: kolom KANAN (EN) template PKWT harus berbahasa Inggris.
 *
 * Dulu `englishSections` bertipe `Record<string, string[]>` sehingga KUNCI-nya
 * ikut dipakai sebagai judul pasal — dan kuncinya adalah heading Indonesia. Jadi
 * kolom kanan mencetak `Pasal 1\nMaksud Kesepakatan` walau paragrafnya sudah
 * Inggris. Selain itu `openingLine`/`recitals`/`closingParagraphs` Indonesia
 * diteruskan apa adanya ke kolom kanan, dan `__TERM_DATE__`/`__WAGE_AMOUNT__`
 * juga menghasilkan kalimat Indonesia di tengah naskah Inggris.
 */
describe('PKWT — kolom kanan (EN) berbahasa Inggris', () => {
  const pkwtDefinitions = Object.values(CONTRACT_DOCUMENT_DEFINITIONS).filter(
    definition => definition.family === 'PKWT',
  )

  it('mencakup seluruh template keluarga PKWT', () => {
    expect(pkwtDefinitions.length).toBeGreaterThan(0)
  })

  it.each(pkwtDefinitions.map(definition => [definition.key, definition] as const))(
    '%s: tidak ada redaksi Indonesia di kolom kanan',
    (_key, definition) => {
      const en = definitionToContentDefinition(definition).languages.en as any[]
      expect(en.length).toBeGreaterThan(0)
      const text = JSON.stringify(en)
      for (const marker of INDONESIAN_MARKERS) {
        expect(text).not.toContain(marker)
      }
    },
  )

  it.each(pkwtDefinitions.map(definition => [definition.key, definition] as const))(
    '%s: judul pasal memakai "Article N", bukan "Pasal N"',
    (_key, definition) => {
      const en = definitionToContentDefinition(definition).languages.en as any[]
      // Blok non-Pasal memang berjudul deskriptif (mis. "The Parties"),
      // bukan "Article N" — hanya pasal yang diperiksa di sini.
      const nonPasal = new Set(['recitals', 'role', 'term', 'compensation', 'closing'])
      const headings = en
        .filter(block => block?.type === 'article' && !nonPasal.has(String(block.id)))
        .map(block => String(block.heading))

      expect(headings.length).toBeGreaterThan(0)
      for (const heading of headings) expect(heading).toMatch(/^Article \d+\n/)
      expect(headings.join(' ')).not.toMatch(/Pasal \d/)
    },
  )

  it.each(pkwtDefinitions.map(definition => [definition.key, definition] as const))(
    '%s: bentuk badan ID dan EN sejajar (baris terkunci tetap aman)',
    (_key, definition) => {
      const content = definitionToContentDefinition(definition)
      // Engine memasangkan baris ID/EN PER BLOK, jadi selisih jumlah paragraf di
      // dalam satu blok tidak lagi menggeser blok berikutnya. Meski begitu,
      // konten ID dan EN yang dikirim template bawaan harus tetap SEPADAN:
      // selisih bentuk menandakan terjemahan yang hilang, bukan sekadar beda
      // panjang kalimat.
      const shape = (blocks: any[]) =>
        blocks
          .filter(block => block?.type === 'paragraph' || block?.type === 'article')
          .map(block => (block.type === 'article' ? `a:${(block.paragraphs ?? []).length}` : 'p'))
          .join(',')

      expect(shape(content.languages.en)).toBe(shape(content.languages.id))
    },
  )

  it.each(pkwtDefinitions.map(definition => [definition.key, definition] as const))(
    '%s: kolom EN memakai jumlah paragraf per blok yang sama dengan kolom ID',
    (_key, definition) => {
      // REGRESI: `toLanguageBlocks(..., english=true)` dulu jatuh ke field ID
      // (`en?.recitals ?? definition.recitals`). Akibatnya jumlah paragraf kolom
      // kanan mengikuti definisi ID, padahal override legacy bisa memendekkan
      // `definition.recitals` — timbul selisih paragraf ID vs EN yang dulu
      // menggeser seluruh dokumen.
      //
      // Catatan: teksnya TIDAK dibandingkan, karena beberapa paragraf memang
      // identik antar bahasa secara sah (`Driver`, `{{contract.baseCompensation}}`).
      // Yang diuji adalah BENTUKNYA per blok.
      const content = definitionToContentDefinition(definition)
      const idByBlock = new Map<string, any>()
      for (const block of content.languages.id as any[]) idByBlock.set(String(block.id), block)

      const enArticles = (content.languages.en as any[]).filter(b => b?.type === 'article')
      expect(enArticles.length).toBeGreaterThan(0)
      for (const enBlock of enArticles) {
        const idBlock = idByBlock.get(String(enBlock.id))
        expect(idBlock).toBeDefined()
        expect(enBlock.paragraphs?.length ?? 0).toBe(idBlock.paragraphs?.length ?? 0)
      }
    },
  )

  /**
   * Regresi: blok identitas PIHAK KEDUA harus ada di KEDUA kolom PKWT dan memuat
   * baris gender.
   *
   * Sebelumnya blok ini hanya hidup di draft yang diketik manual lewat editor —
   * padahal master memilikinya. Akibatnya `{{employee.gender}}`, walau sudah
   * terdaftar di katalog, tidak punya tempat di versi yang dibuat dari definisi
   * kode (`createDraft`), sehingga field itu praktis tidak pernah terpakai.
   *
   * CATATAN: menambah blok ini menambah satu batas blok, jadi `blockGap` harus
   * turun bersamaan supaya dokumen tetap 4 halaman. Lihat invarian anggaran
   * halaman di `pkwt-layout.engine.spec.ts`.
   */
  it.each(pkwtDefinitions.map(definition => [definition.key, definition] as const))(
    '%s: blok identitas PIHAK KEDUA ada di kedua kolom dan memuat baris gender',
    (_key, definition) => {
      const content = definitionToContentDefinition(definition)
      const identity = (lang: 'id' | 'en') =>
        (content.languages[lang] as any[]).find(block => block?.id === 'identity-employee')

      const id = identity('id')
      const en = identity('en')
      expect(id).toBeDefined()
      expect(en).toBeDefined()

      // Placeholder yang SAMA di kedua kolom — yang berbeda hanya label nilainya,
      // dan itu urusan resolver (`genderLabel`), bukan urusan konten.
      expect(id.text).toContain('{{employee.gender}}')
      expect(en.text).toContain('{{employee.gender}}')
      expect(id.text).toContain('Jenis Kelamin :')
      expect(en.text).toContain('Gender :')

      // Identitas karyawan harus lengkap, bukan hanya baris gender.
      for (const key of ['{{employee.fullName}}', '{{employee.birthPlace}}', '{{employee.birthDate}}']) {
        expect(id.text).toContain(key)
        expect(en.text).toContain(key)
      }

      // Kolom Inggris tidak boleh memakai label Indonesia — termasuk label
      // `N a m a` yang masih ada di master.
      expect(en.text).not.toContain('Jenis Kelamin')
      expect(en.text).not.toContain('N a m a')
      expect(en.text).not.toContain('Tgl. Lahir')
    },
  )
})
