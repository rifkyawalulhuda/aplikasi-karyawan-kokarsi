// `contract-templates.service.ts` meng-import `PrismaService`, yang membuat
// Prisma client saat modul dimuat. URL dummy cukup; koneksi nyata tidak dibuka
// karena test menyuntikkan client tiruan.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

/**
 * Regresi: "Duplikat template" harus menyalin hasil terakhir yang SUDAH
 * di-deploy, bukan kembali ke definisi bawaan.
 *
 * Dulu `openDuplicate()` hanya memanggil `POST /contract-templates`, yang
 * menulis baris template tanpa versi. Karena konten efektif dibaca dari versi
 * PUBLISHED, template baru jatuh ke `CONTRACT_DOCUMENT_DEFINITIONS[templateKey]`
 * (definisi hard-code) — salinan tampak "reset ke default".
 *
 * Kontrak baru yang dikunci test ini:
 *  - snapshot versi PUBLISHED terakhir disalin APA ADANYA (contentDefinition +
 *    fieldDefinitions), sebagai versi 1 berstatus DRAFT;
 *  - binding `ContractTemplateField` ikut disalin (tanpa ini field dinamis
 *    dibuang `applyTemplateBindings()`);
 *  - `family`/`templateKey` diwarisi sumber;
 *  - tanpa versi PUBLISHED → ditolak, tidak ada baris tertulis;
 *  - draft WIP sumber diabaikan;
 *  - validasi dijalankan sebelum menulis.
 */

const SOURCE = {
  id: 7,
  code: 'PKWT_KASIR',
  name: 'PKWT Kasir',
  family: 'PKWT',
  templateKey: 'PKWT_KASIR',
  isActive: true,
  version: 3,
  requiredFields: ['employee.nik'],
  contentOverrides: null,
  contractTypeId: 2,
  jobRoleId: 4,
  description: 'Template kasir',
  notes: 'catatan lama',
}

const CONTENT = {
  languages: {
    id: [
      { id: 'title', type: 'title', text: 'KESEPAKATAN KERJA' },
      { id: 'body', type: 'paragraph', text: 'NIK {{employee.nik}}' },
      { id: 'sig', type: 'signature' },
    ],
    // PKWT bilingual: validator menuntut kolom EN juga terisi.
    en: [
      { id: 'title', type: 'title', text: 'EMPLOYMENT AGREEMENT' },
      { id: 'body', type: 'paragraph', text: 'NIK {{employee.nik}}' },
      { id: 'sig', type: 'signature' },
    ],
  },
}

const FIELD_DEFINITIONS = [
  { key: 'employee.nik', label: 'NIK', dataType: 'TEXT', sourceType: 'SYSTEM', required: true },
  { key: 'ktp_issued_date', label: 'Tanggal KTP', dataType: 'DATE', sourceType: 'CONTRACT_INPUT', required: false },
]

const BINDINGS = [
  { id: 11, templateId: 7, fieldId: 3, required: true, sortOrder: 2, config: { hint: 'x' } },
  { id: 12, templateId: 7, fieldId: 9, required: false, sortOrder: 1, config: null },
]

interface Options {
  published?: Record<string, unknown> | null
  draftOnly?: Record<string, unknown> | null
  contentDefinition?: unknown
  fieldDefinitions?: unknown
  catalog?: Array<{ key: string }>
  createError?: unknown
}

function makeService(options: Options = {}) {
  const calls = {
    templateCreate: [] as any[],
    versionCreate: [] as any[],
    bindingCreateMany: [] as any[],
    templateUpdate: [] as any[],
    templateDelete: [] as any[],
    versionUpdate: [] as any[],
  }
  const logs: Array<Record<string, unknown>> = []

  const published = options.published === undefined
    ? {
      id: 99,
      templateId: 7,
      versionNumber: 3,
      status: 'PUBLISHED',
      contentDefinition: options.contentDefinition ?? CONTENT,
      fieldDefinitions: options.fieldDefinitions ?? FIELD_DEFINITIONS,
    }
    : options.published

  const tx = {
    contractTemplate: {
      create: async (args: any) => {
        calls.templateCreate.push(args)
        return { id: 55, ...args.data }
      },
    },
    contractTemplateField: {
      createMany: async (args: any) => {
        calls.bindingCreateMany.push(args)
        return { count: args.data.length }
      },
    },
    contractTemplateVersion: {
      create: async (args: any) => {
        calls.versionCreate.push(args)
        return { id: 101, ...args.data }
      },
    },
  }

  const client = {
    contractTemplate: {
      findUnique: async (args: any) => (args.where.id === SOURCE.id ? SOURCE : null),
      update: async (args: any) => { calls.templateUpdate.push(args); return SOURCE },
      delete: async (args: any) => { calls.templateDelete.push(args); return SOURCE },
    },
    contractTemplateVersion: {
      findFirst: async (args: any) => {
        if (args.where.status === 'PUBLISHED') return published
        return options.draftOnly ?? null
      },
      update: async (args: any) => { calls.versionUpdate.push(args); return {} },
    },
    contractTemplateField: {
      findMany: async () => BINDINGS,
    },
    templateFieldDefinition: {
      findMany: async () => options.catalog ?? [{ key: 'employee.nik' }],
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      if (options.createError) throw options.createError
      return fn(tx)
    },
  }

  const prisma = {
    client,
    contractTemplate: client.contractTemplate,
    contractTemplateVersion: client.contractTemplateVersion,
    contractTemplateField: client.contractTemplateField,
    templateFieldDefinition: client.templateFieldDefinition,
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      if (options.createError) throw options.createError
      return fn(tx)
    },
  } as never

  const activityLog = { log: async (dto: Record<string, unknown>) => { logs.push(dto) } }
  const fieldsService = {} as never

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ContractTemplatesService } = require('./contract-templates.service')
  const service = new ContractTemplatesService(prisma, activityLog, fieldsService)

  return { service, calls, logs }
}

const PAYLOAD = {
  code: 'PKWT_KASIR_2',
  name: 'PKWT Kasir 2',
  contractTypeId: 2,
  jobRoleId: 4,
  description: 'Salinan',
  notes: 'catatan baru',
}

describe('ContractTemplatesService.duplicate', () => {
  it('menyalin contentDefinition & fieldDefinitions versi PUBLISHED apa adanya sebagai DRAFT v1', async () => {
    const { service, calls } = makeService()

    await service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' })

    expect(calls.versionCreate).toHaveLength(1)
    const version = calls.versionCreate[0].data
    expect(version).toMatchObject({
      templateId: 55,
      versionNumber: 1,
      status: 'DRAFT',
      createdByName: 'admin',
    })
    // Verbatim: tanpa normalisasi ulang, tanpa perubahan bentuk.
    expect(version.contentDefinition).toEqual(CONTENT)
    expect(version.fieldDefinitions).toEqual(FIELD_DEFINITIONS)
    expect(version.changeSummary).toContain('PKWT Kasir')
    expect(version.changeSummary).toContain('3')
  })

  it('mewarisi family & templateKey dari sumber, bukan dari payload', async () => {
    const { service, calls } = makeService()

    await service.duplicate(SOURCE.id, PAYLOAD as any, { name: 'admin', role: 'ADMIN' })

    const data = calls.templateCreate[0].data
    expect(data.family).toBe('PKWT')
    expect(data.templateKey).toBe('PKWT_KASIR')
    expect(data.code).toBe('PKWT_KASIR_2')
    expect(data.name).toBe('PKWT Kasir 2')
    expect(data.version).toBe(1)
    // Metadata template ikut disalin dari sumber.
    expect(data.requiredFields).toEqual(['employee.nik'])
  })

  it('menyalin baris binding field (required, sortOrder, config) ke template baru', async () => {
    const { service, calls } = makeService()

    await service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' })

    expect(calls.bindingCreateMany).toHaveLength(1)
    const rows = calls.bindingCreateMany[0].data
    expect(rows).toHaveLength(2)
    expect(rows).toEqual([
      { templateId: 55, fieldId: 3, required: true, sortOrder: 2, config: { hint: 'x' } },
      { templateId: 55, fieldId: 9, required: false, sortOrder: 1, config: undefined },
    ])
  })

  it('menolak bila sumber belum punya versi PUBLISHED, tanpa menulis apa pun', async () => {
    const { service, calls } = makeService({ published: null })

    await expect(service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' }))
      .rejects.toThrow(/belum punya versi terbit/)

    expect(calls.templateCreate).toHaveLength(0)
    expect(calls.versionCreate).toHaveLength(0)
    expect(calls.bindingCreateMany).toHaveLength(0)
  })

  it('mengabaikan draft WIP sumber: hanya versi PUBLISHED yang disalin', async () => {
    const draftWip = {
      id: 100,
      templateId: 7,
      versionNumber: 4,
      status: 'DRAFT',
      contentDefinition: { languages: { id: [{ id: 'wip', type: 'title', text: 'BELUM DISETUJUI' }] } },
      fieldDefinitions: [],
    }
    const { service, calls } = makeService({ draftOnly: draftWip })

    await service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' })

    expect(calls.versionCreate[0].data.contentDefinition).toEqual(CONTENT)
    expect(JSON.stringify(calls.versionCreate[0].data)).not.toContain('BELUM DISETUJUI')
  })

  it('menjalankan validasi konten SEBELUM menulis: konten rusak membatalkan seluruh duplikasi', async () => {
    const { service, calls } = makeService({
      contentDefinition: {
        languages: {
          id: [
            { id: 'body', type: 'paragraph', text: 'Nilai {{custom.tidak_terdaftar}}' },
          ],
          en: [
            { id: 'body', type: 'paragraph', text: 'Value {{custom.tidak_terdaftar}}' },
          ],
        },
      },
    })

    await expect(service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' }))
      .rejects.toThrow()

    expect(calls.templateCreate).toHaveLength(0)
    expect(calls.versionCreate).toHaveLength(0)
  })

  it('menerima placeholder custom. yang hanya terdaftar di fieldDefinitions versi sumber', async () => {
    const { service, calls } = makeService({
      catalog: [],
      contentDefinition: {
        languages: {
          id: [
            { id: 'body', type: 'paragraph', text: 'Tanggal KTP {{custom.ktp_issued_date}}' },
            { id: 'sig', type: 'signature' },
          ],
          en: [
            { id: 'body', type: 'paragraph', text: 'KTP date {{custom.ktp_issued_date}}' },
            { id: 'sig', type: 'signature' },
          ],
        },
      },
    })

    await service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' })

    expect(calls.versionCreate).toHaveLength(1)
  })

  it('menerjemahkan kode duplikat menjadi 409 dan tidak menyentuh template sumber', async () => {
    const conflict = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    const { service, calls } = makeService({ createError: conflict })

    await expect(service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' }))
      .rejects.toThrow(/sudah digunakan/)

    expect(calls.templateUpdate).toHaveLength(0)
    expect(calls.templateDelete).toHaveLength(0)
    expect(calls.versionUpdate).toHaveLength(0)
  })

  it('mencatat activity log dengan asal-usul salinan', async () => {
    const { service, logs } = makeService()

    await service.duplicate(SOURCE.id, PAYLOAD, { name: 'admin', role: 'ADMIN' })

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      action: 'CREATE',
      module: 'Template Kontrak',
      targetLabel: 'PKWT Kasir 2',
    })
    expect(String(logs[0].detail)).toContain('PKWT_KASIR')
  })
})
