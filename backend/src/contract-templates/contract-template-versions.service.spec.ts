/**
 * Regresi: saat membuat draft untuk template legacy yang belum punya versi
 * PUBLISHED, service harus ikut me-merge `template.contentOverrides` yang
 * tersimpan — bukan hanya `dto.overrides`.
 *
 * Alasannya: `contentOverrides` adalah satu-satunya tempat konten hasil edit
 * admin pada template legacy generasi lama disimpan. Saat draft versi pertama
 * dibuat, konten itu harus terbawa ke contentDefinition versi; kalau diabaikan,
 * hasil edit admin hilang tanpa jejak dan tidak bisa dipulihkan (lihat Risk
 * "Perubahan legacy override hilang").
 *
 * Catatan (DoD #10, sudah ditutup): jalur RUNTIME `contentOverrides` —
 * `mergeDefinition(base, template.contentOverrides)` di
 * contract-document.service.ts — sudah dihapus; kontrak dirender eksklusif dari
 * snapshot versi template. Jalur BOOTSTRAP di sini sengaja dipertahankan karena
 * justru inilah yang memindahkan konten legacy ke versi, dan
 * scripts/rollout-contract-template-versioning.ts memakai perlakuan yang sama.
 */

// PrismaService melempar error saat modul di-import bila DATABASE_URL tidak diset.
// Test ini murni unit test logika merge, jadi cukup di-mock agar tidak butuh DB.
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    // Mock kosong: test ini tidak menyentuh database.
    readonly client = undefined
  }
}))

type Row = Record<string, unknown>

interface MockOptions {
  template: Row | null
  versions?: Row[]
  existingDraft?: Row | null
  /** Binding `ContractTemplateField` (termasuk relasi `field`). */
  bindings?: Row[]
  /** Katalog `TemplateFieldDefinition` aktif untuk validasi publish/preview. */
  catalog?: Row[]
  /** Error yang dilempar `contractTemplateVersion.create` (mis. P2002 balapan). */
  createError?: unknown
  /** Versi "pemenang" balapan: hanya terlihat setelah percobaan create gagal. */
  raceWinner?: Row
}

interface FindFirstArgs {
  where: { status?: string }
}

interface CreateArgs {
  data: Row
}

function makeService(opts: MockOptions) {
  const created: Row[] = []
  // Percobaan create tetap dihitung walau gagal — mock butuh itu untuk
  // mensimulasikan pemenang balapan yang baru "terlihat" setelah P2002.
  let createAttempts = 0
  const client = {
    contractTemplate: {
      findUnique: async () => opts.template
    },
    contractTemplateVersion: {
      findFirst: async ({ where }: FindFirstArgs) => {
        const rows: Row[] = opts.versions ?? []
        if (where.status === 'PUBLISHED') {
          return rows.find(r => r.status === 'PUBLISHED') ?? null
        }
        if (where.status === 'DRAFT') {
          return opts.existingDraft ?? null
        }
        // Query tanpa filter status (dipakai `getPublished()` untuk melihat versi
        // apa pun). Winner balapan baru muncul setelah percobaan create gagal.
        if (opts.raceWinner && createAttempts > 0) return opts.raceWinner
        return rows[0] ?? null
      },
      findUnique: async ({ where }: { where: { id?: number } }) =>
        (opts.versions ?? []).find(r => r.id === where.id)
        ?? (opts.existingDraft && opts.existingDraft.id === where.id ? opts.existingDraft : null),
      create: async ({ data }: CreateArgs) => {
        createAttempts += 1
        if (opts.createError) throw opts.createError
        created.push(data)
        return { id: 999, ...data }
      },
      update: async ({ data }: CreateArgs) => data
    },
    contractTemplateField: {
      findMany: async () => opts.bindings ?? []
    },
    templateFieldDefinition: {
      findMany: async () => opts.catalog ?? []
    },
    // publish()/rollback() menulis lewat transaksi. Test di file ini hanya
    // menguji jalur validasi (yang melempar sebelum transaksi), jadi transaksi
    // sengaja dibuat gagal agar tidak ada test yang diam-diam menulis.
    $transaction: async () => {
      throw new Error('Transaksi tidak diharapkan pada unit test ini')
    }
  }
  return { client, created }
}

describe('ContractTemplateVersionsService.createDraft (legacy override merge)', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { CONTRACT_DOCUMENT_DEFINITIONS } = require('../contracts/contract-document-definitions')
  const { ContractTemplateVersionsService } = require('./contract-template-versions.service')
  const { TemplateFieldsService } = require('./template-fields.service')
  /* eslint-enable @typescript-eslint/no-require-imports */

  interface TestService {
    createDraft: (templateId: number, dto: Row, actor: { name: string }) => Promise<Row>
  }

  function build(client: unknown): TestService {
    // Konstruktor asli: (prisma, fieldsService, activityLog).
    // fieldsService nyata dipakai supaya query binding katalog ikut teruji.
    const noop = {} as never
    return new ContractTemplateVersionsService({ client } as never, new TemplateFieldsService({ client } as never), noop)
  }

  it('menggabungkan contentOverrides legacy saat template belum punya versi PUBLISHED', async () => {
    const templateKey = 'PKWT_DRIVER'
    const base = CONTRACT_DOCUMENT_DEFINITIONS[templateKey]
    expect(base).toBeDefined()

    // Ambil salah satu section nyata agar merge per-heading benar-benar cocok.
    const target = base.sections[0]
    const marker = 'PARAGRAF HASIL EDIT ADMIN'
    const overrideSections = [
      { heading: target.heading, paragraphs: [marker, ...(target.paragraphs ?? [])] }
    ]

    const { client, created } = makeService({
      template: {
        id: 17142,
        code: '001',
        templateKey,
        family: base.family,
        contentOverrides: { sections: overrideSections }
      },
      versions: []
    })

    await build(client).createDraft(17142, {}, { name: 'tester' })

    expect(created).toHaveLength(1)
    const serialized = JSON.stringify(created[0].contentDefinition)
    expect(serialized).toContain(marker)
  })

  it('mengutamakan dto.overrides daripada contentOverrides legacy', async () => {
    const templateKey = 'PKWT_DRIVER'
    const base = CONTRACT_DOCUMENT_DEFINITIONS[templateKey]

    const target = base.sections[0]
    const legacyMarker = 'MARKER_LEGACY'
    const dtoMarker = 'MARKER_DTO'

    const { client, created } = makeService({
      template: {
        id: 1,
        code: '00X',
        templateKey,
        family: base.family,
        contentOverrides: { sections: [{ heading: target.heading, paragraphs: [legacyMarker] }] }
      },
      versions: []
    })

    await build(client).createDraft(
      1,
      { overrides: { sections: [{ heading: target.heading, paragraphs: [dtoMarker] }] } },
      { name: 'tester' }
    )

    const serialized = JSON.stringify(created[0].contentDefinition)
    expect(serialized).toContain(dtoMarker)
    expect(serialized).not.toContain(legacyMarker)
  })

  it('menerapkan binding katalog ke fieldDefinitions draft', async () => {
    const templateKey = 'MITRA_DRIVER_TRUCK_B3'
    const base = CONTRACT_DOCUMENT_DEFINITIONS[templateKey]
    expect(base).toBeDefined()

    const { client, created } = makeService({
      template: {
        id: 42,
        code: '002',
        templateKey,
        family: base.family,
        contentOverrides: null
      },
      versions: [],
      bindings: [
        {
          required: true,
          sortOrder: 0,
          field: {
            key: 'ktp_issued_date',
            label: 'Tanggal Terbit KTP Mitra',
            dataType: 'DATE',
            sourceType: 'CONTRACT_INPUT'
          }
        }
      ]
    })

    await build(client).createDraft(42, {}, { name: 'tester' })

    const fieldDefinitions = created[0].fieldDefinitions as Array<{ key: string, required: boolean }>
    const ktp = fieldDefinitions.find(field => field.key === 'ktp_issued_date')
    expect(ktp).toBeDefined()
    expect(ktp?.required).toBe(true)
    // Field system bawaan definisi tetap ada.
    expect(fieldDefinitions.some(field => field.key === 'employee.nik')).toBe(true)
  })

  it('menghormati checkbox wajib-diisi (required=false) dari binding', async () => {
    const templateKey = 'MITRA_DRIVER_TRUCK_B3'
    const base = CONTRACT_DOCUMENT_DEFINITIONS[templateKey]

    const { client, created } = makeService({
      template: { id: 43, code: '003', templateKey, family: base.family, contentOverrides: null },
      versions: [],
      bindings: [
        {
          required: false,
          sortOrder: 0,
          field: {
            key: 'ktp_issued_date',
            label: 'Tanggal Terbit KTP Mitra',
            dataType: 'DATE',
            sourceType: 'CONTRACT_INPUT'
          }
        }
      ]
    })

    await build(client).createDraft(43, {}, { name: 'tester' })

    const fieldDefinitions = created[0].fieldDefinitions as Array<{ key: string, required: boolean }>
    expect(fieldDefinitions.find(field => field.key === 'ktp_issued_date')?.required).toBe(false)
  })

  it('menghormati fieldDefinitions eksplisit dari pemanggil', async () => {
    const templateKey = 'MITRA_DRIVER_TRUCK_B3'
    const base = CONTRACT_DOCUMENT_DEFINITIONS[templateKey]
    // contentDefinition valid dibutuhkan agar cabang "definisi lengkap" terpakai.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { definitionToContentDefinition: toContent } = require('./default-template-definition')
    /* eslint-enable @typescript-eslint/no-require-imports */

    const { client, created } = makeService({
      template: { id: 44, code: '004', templateKey, family: base.family, contentOverrides: null },
      versions: []
    })

    await build(client).createDraft(44, {
      contentDefinition: toContent(base),
      fieldDefinitions: [
        { key: 'employee.nik', label: 'NIK', dataType: 'TEXT', sourceType: 'SYSTEM', required: true }
      ]
    }, { name: 'tester' })

    expect(created[0].fieldDefinitions).toEqual([
      { key: 'employee.nik', label: 'NIK', dataType: 'TEXT', sourceType: 'SYSTEM', required: true }
    ])
  })
})

describe('ContractTemplateVersionsService.getContractInputFields', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { ContractTemplateVersionsService } = require('./contract-template-versions.service')
  const { TemplateFieldsService } = require('./template-fields.service')
  /* eslint-enable @typescript-eslint/no-require-imports */

  interface FieldsService {
    getContractInputFields: (templateId: number) => Promise<{ published: boolean; fields: Row[] }>
  }

  function buildFieldsService(client: unknown): FieldsService {
    return new ContractTemplateVersionsService({ client } as never, new TemplateFieldsService({ client } as never), {} as never)
  }

  it('membaca field dinamis dari versi PUBLISHED, bukan dari draft', async () => {
    const { client } = makeService({
      template: { id: 7 },
      versions: [
        {
          id: 1,
          status: 'DRAFT',
          fieldDefinitions: [{ key: 'ktpBaru', label: 'Draft', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT' }]
        },
        {
          id: 2,
          status: 'PUBLISHED',
          fieldDefinitions: [
            { key: 'tanggalTerbitKtp', label: 'Tanggal Terbit KTP', dataType: 'DATE', sourceType: 'CONTRACT_INPUT', required: true },
            { key: 'employee.nik', label: 'NIK', dataType: 'TEXT', sourceType: 'SYSTEM', required: true }
          ]
        }
      ]
    })

    const fields = await buildFieldsService(client).getContractInputFields(7)

    // Hanya CONTRACT_INPUT dari versi PUBLISHED yang lolos ke form.
    expect(fields.published).toBe(true)
    expect(fields.fields).toEqual([
      {
        key: 'tanggalTerbitKtp',
        label: 'Tanggal Terbit KTP',
        dataType: 'DATE',
        required: true
      }
    ])
  })

  it('bootstrap lazy versi PUBLISHED juga melewati binding katalog', async () => {
    // Template legacy tanpa snapshot versi: `getPublished()` menerbitkan versi
    // awal secara lazy. Jalur ini dulu melewatkan binding, sehingga field wajib
    // yang dicentang admin tidak pernah muncul di form kontrak.
    const templateKey = 'MITRA_DRIVER_TRUCK_B3'
    const { client, created } = makeService({
      template: { id: 7, templateKey, family: 'MITRA' },
      versions: [],
      bindings: [
        {
          required: true,
          sortOrder: 0,
          field: {
            key: 'tanggalTerbitKtp',
            label: 'Tanggal Terbit KTP Mitra',
            dataType: 'DATE',
            sourceType: 'CONTRACT_INPUT'
          }
        }
      ]
    })

    const fields = await buildFieldsService(client).getContractInputFields(7)

    expect(created).toHaveLength(1)
    expect(created[0].status).toBe('PUBLISHED')
    expect(fields.published).toBe(true)
    expect(fields.fields).toEqual([
      {
        key: 'tanggalTerbitKtp',
        label: 'Tanggal Terbit KTP Mitra',
        dataType: 'DATE',
        required: true
      }
    ])
  })

  it('TIDAK menulis versi baru saat template sudah punya DRAFT tapi belum ada PUBLISHED', async () => {
    // Regresi: `getPublished()` dulu selalu menulis `versionNumber: 1` saat tidak
    // ada versi PUBLISHED. Admin yang sudah menyimpan draft tanpa mempublikasinya
    // lalu membuka modal kontrak / editor template akan kena
    // P2002 (templateId, versionNumber) — fitur jadi tidak bisa dipakai sama sekali.
    const draft = {
      id: 11,
      status: 'DRAFT',
      versionNumber: 1,
      fieldDefinitions: [
        { key: 'shift_code', label: 'Shift Kerja', dataType: 'DROPDOWN', sourceType: 'CONTRACT_INPUT', required: true }
      ]
    }
    const templateKey = 'MITRA_DRIVER_TRUCK_B3'
    const { client, created } = makeService({
      template: { id: 7, templateKey, family: 'MITRA' },
      versions: [draft],
      bindings: [
        {
          required: true,
          field: { key: 'tanggalTerbitKtp', label: 'Tanggal Terbit KTP Mitra', dataType: 'DATE', sourceType: 'CONTRACT_INPUT' }
        }
      ]
    })

    const fields = await buildFieldsService(client).getContractInputFields(7)

    expect(created).toHaveLength(0)
    // Draft dipakai apa adanya: field dinamis yang sudah disusun admin tetap
    // tampil di form, jadi UI tidak lagi mentok.
    expect(fields.fields).toEqual([
      { key: 'shift_code', label: 'Shift Kerja', dataType: 'DROPDOWN', required: true }
    ])
    // …tetapi ditandai belum terbit supaya modal kontrak memblokir submit:
    // kontrak dari versi non-PUBLISHED tidak punya snapshot, sehingga field
    // dinamis ini tidak akan pernah tercetak ke PDF.
    expect(fields.published).toBe(false)
  })

  it('memakai versi terbaru (non-PUBLISHED) saat template belum pernah terbit', async () => {
    const { client, created } = makeService({
      template: { id: 7, templateKey: 'MITRA_DRIVER_TRUCK_B3', family: 'MITRA' },
      versions: [{ id: 4, status: 'ARCHIVED', versionNumber: 3, fieldDefinitions: [] }]
    })

    const fields = await buildFieldsService(client).getContractInputFields(7)

    expect(created).toHaveLength(0)
    expect(fields.fields).toEqual([])
    expect(fields.published).toBe(false)
  })

  it('tidak gagal saat dua request balapan membuat versi awal (P2002)', async () => {
    // Dua request bersamaan sama-sama melihat "belum ada versi". Yang kalah
    // balapan harus memakai versi yang sudah dibuat pemenangnya, bukan melempar.
    const winner = { id: 12, status: 'PUBLISHED', versionNumber: 1, fieldDefinitions: [] }
    const { client, created } = makeService({
      template: { id: 7, templateKey: 'MITRA_DRIVER_TRUCK_B3', family: 'MITRA' },
      versions: [],
      raceWinner: winner,
      createError: Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    })

    const fields = await buildFieldsService(client).getContractInputFields(7)

    // Tidak ada versi baru yang tertulis (create gagal), tapi request tetap
    // sukses memakai versi pemenang — bukan melempar P2002 ke pengguna.
    expect(created).toHaveLength(0)
    expect(fields.fields).toEqual([])
    // Pemenang balapan sudah PUBLISHED, jadi form boleh submit.
    expect(fields.published).toBe(true)
  })

  it('menerbitkan versi 1 saat template benar-benar belum punya versi apa pun', async () => {
    const { client, created } = makeService({
      template: { id: 7, templateKey: 'MITRA_DRIVER_TRUCK_B3', family: 'MITRA' },
      versions: []
    })

    await buildFieldsService(client).getContractInputFields(7)

    expect(created).toHaveLength(1)
    expect(created[0].versionNumber).toBe(1)
    expect(created[0].status).toBe('PUBLISHED')
  })

  it('melempar NotFoundException saat definisi bawaan template tidak dikenal', async () => {
    const { client } = makeService({ template: { id: 7, templateKey: 'TIDAK_ADA' }, versions: [] })

    await expect(buildFieldsService(client).getContractInputFields(7)).rejects.toThrow(/Definisi bawaan/)
  })
})

describe('ContractTemplateVersionsService.publish (guard MASTER_REFERENCE)', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { ContractTemplateVersionsService } = require('./contract-template-versions.service')
  const { TemplateFieldsService } = require('./template-fields.service')
  /* eslint-enable @typescript-eslint/no-require-imports */

  function buildPublish(client: unknown) {
    return new ContractTemplateVersionsService({ client } as never, new TemplateFieldsService({ client } as never), {} as never)
  }

  it('menolak publish field MASTER_REFERENCE agar tidak terbit field yang tak pernah punya nilai', async () => {
    const { client } = makeService({
      template: { id: 8, templateKey: 'PKWT_DRIVER', family: 'PKWT' },
      catalog: [{ key: 'employee.fullName' }],
      existingDraft: {
        id: 21,
        status: 'DRAFT',
        templateId: 8,
        contentDefinition: { sections: [] },
        fieldDefinitions: [
          {
            key: 'employee.fullName',
            label: 'Nama Vendor',
            dataType: 'MASTER_REFERENCE',
            sourceType: 'MASTER_REFERENCE',
            sourceConfig: { master: 'EMPLOYEE', field: 'fullName' }
          }
        ]
      },
      versions: []
    })

    await expect(buildPublish(client).publish(21, { name: 'tester' })).rejects.toThrow(/belum didukung/)
  })
})
