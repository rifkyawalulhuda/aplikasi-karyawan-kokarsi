import { BadRequestException } from '@nestjs/common'

// `template-fields.service.ts` meng-import `PrismaService`, yang membuat Prisma
// client saat modul dimuat. Beri URL dummy agar tidak melempar saat import;
// koneksi nyata tidak pernah dibuka karena test menyuntikkan client tiruan.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

/**
 * Unit test panel binding field template (`TemplateFieldsService`).
 *
 * Menguji kontrak API yang dipakai editor template:
 *  - `listTemplateBindings` menyusun katalog + status pakai/wajib per template;
 *  - `setTemplateBinding` menambah/menyelaraskan/menghapus baris binding;
 *  - guard: SYSTEM & MASTER_REFERENCE tidak dapat diubah dari panel.
 */
interface FieldRow {
  id: number
  key: string
  label: string
  dataType: string
  sourceType: string
  isActive: boolean
  isSystem?: boolean
}

interface BindingRow {
  id: number
  templateId: number
  fieldId: number
  required: boolean
  sortOrder: number
}

function makeService(opts: {
  template?: unknown
  fields?: FieldRow[]
  bindings?: BindingRow[]
  version?: unknown
}) {
  const fields = opts.fields ?? []
  let bindings = [...(opts.bindings ?? [])]
  let nextId = 100

  const client = {
    contractTemplate: { findUnique: async () => opts.template ?? { id: 1, templateKey: 'MITRA_KOMART' } },
    contractTemplateVersion: {
      findFirst: async () => opts.version ?? null,
    },
    templateFieldDefinition: {
      findMany: async (args?: { where?: { sourceType?: string } }) => {
        if (args?.where?.sourceType === 'CONTRACT_INPUT') {
          return fields.filter(f => f.sourceType === 'CONTRACT_INPUT').map(f => ({ key: f.key }))
        }
        return fields
      },
      findUnique: async ({ where }: { where: { id?: number, key?: string } }) =>
        fields.find(f => f.id === where.id || f.key === where.key) ?? null,
    },
    contractTemplateField: {
      findMany: async () => bindings,
      findUnique: async ({ where }: { where: { templateId_fieldId: { templateId: number, fieldId: number } } }) =>
        bindings.find(b => b.templateId === where.templateId_fieldId.templateId && b.fieldId === where.templateId_fieldId.fieldId) ?? null,
      aggregate: async () => ({ _max: { sortOrder: bindings.length ? Math.max(...bindings.map(b => b.sortOrder)) : null } }),
      create: async ({ data }: { data: BindingRow }) => {
        const row = { id: nextId++, ...data }
        bindings.push(row)
        return row
      },
      update: async ({ where, data }: { where: { id: number }, data: Partial<BindingRow> }) => {
        const row = bindings.find(b => b.id === where.id)!
        Object.assign(row, data)
        return row
      },
      delete: async ({ where }: { where: { id: number } }) => {
        bindings = bindings.filter(b => b.id !== where.id)
        return { id: where.id }
      },
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TemplateFieldsService } = require('./template-fields.service')
  return { service: new TemplateFieldsService({ client } as never), getBindings: () => bindings }
}

const KTP: FieldRow = { id: 10, key: 'ktp_issued_date', label: 'Tanggal Terbit KTP Mitra', dataType: 'DATE', sourceType: 'CONTRACT_INPUT', isActive: true }
const NIK: FieldRow = { id: 20, key: 'employee.nik', label: 'NIK Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM', isActive: true, isSystem: true }
const MASTER: FieldRow = { id: 30, key: 'vendor.name', label: 'Vendor', dataType: 'MASTER_REFERENCE', sourceType: 'MASTER_REFERENCE', isActive: true }

const CONTENT = {
  languages: {
    id: [
      { id: 'p1', type: 'paragraph', text: 'NIK {{employee.nik}} tertanggal {{custom.ktp_issued_date}}.' },
      { id: 'sig', type: 'signature' },
    ],
  },
}

describe('TemplateFieldsService — panel binding', () => {
  it('listTemplateBindings menandai bound/required/locked/usedInContent', async () => {
    const { service } = makeService({
      fields: [KTP, NIK],
      bindings: [{ id: 1, templateId: 1, fieldId: 10, required: true, sortOrder: 0 }],
      version: { contentDefinition: CONTENT },
    })

    const res = await service.listTemplateBindings(1)
    const ktp = res.fields.find(f => f.key === 'ktp_issued_date')!
    const nik = res.fields.find(f => f.key === 'employee.nik')!

    expect(ktp).toMatchObject({ bound: true, required: true, locked: false, usedInContent: true })
    // SYSTEM selalu dipakai + wajib + terkunci, terlepas dari tabel binding.
    expect(nik).toMatchObject({ bound: true, required: true, locked: true, usedInContent: true })
  })

  it('field CONTRACT_INPUT tanpa binding: bound=false, required=false', async () => {
    const { service } = makeService({ fields: [KTP], bindings: [], version: { contentDefinition: CONTENT } })
    const res = await service.listTemplateBindings(1)
    expect(res.fields[0]).toMatchObject({ bound: false, required: false, locked: false })
  })

  it('setTemplateBinding(bound=true) menambah baris binding', async () => {
    const { service, getBindings } = makeService({ fields: [KTP], bindings: [] })
    await service.setTemplateBinding(1, 10, { bound: true, required: false })
    expect(getBindings()).toHaveLength(1)
    expect(getBindings()[0]).toMatchObject({ templateId: 1, fieldId: 10, required: false })
  })

  it('setTemplateBinding menyelaraskan required pada baris yang sudah ada', async () => {
    const { service, getBindings } = makeService({
      fields: [KTP],
      bindings: [{ id: 1, templateId: 1, fieldId: 10, required: true, sortOrder: 0 }],
    })
    await service.setTemplateBinding(1, 10, { bound: true, required: false })
    expect(getBindings()[0].required).toBe(false)
  })

  it('setTemplateBinding(bound=false) menghapus baris binding', async () => {
    const { service, getBindings } = makeService({
      fields: [KTP],
      bindings: [{ id: 1, templateId: 1, fieldId: 10, required: true, sortOrder: 0 }],
    })
    await service.setTemplateBinding(1, 10, { bound: false })
    expect(getBindings()).toHaveLength(0)
  })

  it('menolak perubahan field SYSTEM', async () => {
    const { service } = makeService({ fields: [NIK], bindings: [] })
    await expect(service.setTemplateBinding(1, 20, { bound: false })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('menolak field MASTER_REFERENCE', async () => {
    const { service } = makeService({ fields: [MASTER], bindings: [] })
    await expect(service.setTemplateBinding(1, 30, { bound: true })).rejects.toBeInstanceOf(BadRequestException)
  })
})
