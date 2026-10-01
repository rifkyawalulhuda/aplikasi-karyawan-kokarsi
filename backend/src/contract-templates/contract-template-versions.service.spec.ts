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
}

interface FindFirstArgs {
  where: { status?: string }
}

interface CreateArgs {
  data: Row
}

function makeService(opts: MockOptions) {
  const created: Row[] = []
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
        return rows[0] ?? null
      },
      create: async ({ data }: CreateArgs) => {
        created.push(data)
        return { id: 999, ...data }
      }
    }
  }
  return { client, created }
}

describe('ContractTemplateVersionsService.createDraft (legacy override merge)', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { CONTRACT_DOCUMENT_DEFINITIONS } = require('../contracts/contract-document-definitions')
  const { ContractTemplateVersionsService } = require('./contract-template-versions.service')
  /* eslint-enable @typescript-eslint/no-require-imports */

  interface TestService {
    createDraft: (templateId: number, dto: Row, actor: { name: string }) => Promise<Row>
  }

  function build(client: unknown): TestService {
    // Konstruktor asli: (prisma, fieldsService, activityLog).
    const noop = {} as never
    return new ContractTemplateVersionsService({ client } as never, noop, noop)
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
})
