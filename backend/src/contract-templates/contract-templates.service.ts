import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ContractFamily } from '@prisma/client'
import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../contracts/contract-document-definitions'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { definitionToContentDefinition, definitionToFieldDefinitions } from './default-template-definition'
import { validateContentDefinition } from './template-schema.validator'
import { TemplateFieldsService } from './template-fields.service'
import { addPlaceholderKeysFromDefinitions, applyTemplateBindings } from './template-field-bindings.helpers'

export interface ContractTemplatePayload {
  code: string
  name: string
  family: ContractFamily
  templateKey: string
  contractTypeId?: number | null
  jobRoleId?: number | null
  description?: string | null
  requiredFields?: unknown
  isActive?: boolean
  version?: number
  notes?: string | null
}

@Injectable()
export class ContractTemplatesService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private fieldsService: TemplateFieldsService,
  ) {}

  private readonly defaultTemplateSeeds = [
    { code: 'MITRA_DRIVER', name: 'Mitra Driver', family: 'MITRA' as const, templateKey: 'MITRA_DRIVER', contractTypeName: 'MITRA', jobRoleName: 'Driver' },
    { code: 'MITRA_DRIVER_TRUCK_B3', name: 'Mitra Driver Truck B3', family: 'MITRA' as const, templateKey: 'MITRA_DRIVER_TRUCK_B3', contractTypeName: 'MITRA', jobRoleName: 'Driver Truck B3' },
    { code: 'MITRA_KOMART', name: 'Mitra Kasir Komart', family: 'MITRA' as const, templateKey: 'MITRA_KOMART', contractTypeName: 'MITRA', jobRoleName: 'Kasir' },
    { code: 'MITRA_STAFF', name: 'Mitra Staff Admin', family: 'MITRA' as const, templateKey: 'MITRA_STAFF', contractTypeName: 'MITRA', jobRoleName: 'Staff Admin' },
    { code: 'MITRA_WAREHOUSE', name: 'Mitra Warehouse', family: 'MITRA' as const, templateKey: 'MITRA_WAREHOUSE', contractTypeName: 'MITRA', jobRoleName: 'Karyawan Gudang' },
    { code: 'PKWT_DRIVER', name: 'PKWT Driver', family: 'PKWT' as const, templateKey: 'PKWT_DRIVER', contractTypeName: 'PKWT', jobRoleName: 'Driver' },
    { code: 'PKWT_KASIR', name: 'PKWT Kasir', family: 'PKWT' as const, templateKey: 'PKWT_KASIR', contractTypeName: 'PKWT', jobRoleName: 'Kasir' },
    { code: 'PKWT_STAFF', name: 'PKWT Staff Admin', family: 'PKWT' as const, templateKey: 'PKWT_STAFF', contractTypeName: 'PKWT', jobRoleName: 'Staff Admin' },
    { code: 'PKWT_WAREHOUSE', name: 'PKWT Warehouse', family: 'PKWT' as const, templateKey: 'PKWT_WAREHOUSE', contractTypeName: 'PKWT', jobRoleName: 'Karyawan Gudang' },
  ]

  private include = {
    contractType: { select: { id: true, name: true } },
    jobRole: { select: { id: true, name: true } },
    // Daftar template perlu menunjukkan status dokumen yang sebenarnya:
    // berapa kontrak memakainya (menentukan boleh/tidaknya dihapus dan
    // risikonya saat mengubah konten) dan versi mana yang sedang aktif.
    // `contracts` sengaja TIDAK di-select penuh — hanya jumlahnya.
    _count: {
      select: {
        contracts: true,
        // Draft = ada perubahan yang belum diterbitkan (lihat
        // docs/superpowers/plans/2026-09-29-dynamic-contract-template-versioning.md,
        // "Draft menampilkan badge DRAFT").
        versions: { where: { status: 'DRAFT' as const } },
      },
    },
    versions: {
      where: { status: 'PUBLISHED' as const },
      orderBy: { versionNumber: 'desc' as const },
      take: 1,
      select: { id: true, versionNumber: true, publishedAt: true, publishedByName: true },
    },
  }

  private async ensureDefaultTemplates() {
    await Promise.all([
      this.prisma.contractType.upsert({ where: { name: 'MITRA' }, update: {}, create: { name: 'MITRA' } }),
      this.prisma.contractType.upsert({ where: { name: 'PKWT' }, update: {}, create: { name: 'PKWT' } }),
    ])

    const [contractTypes, jobRoles] = await Promise.all([
      this.prisma.contractType.findMany({
        where: { name: { in: [...new Set(this.defaultTemplateSeeds.map(seed => seed.contractTypeName))] } },
        select: { id: true, name: true },
      }),
      this.prisma.jobRole.findMany({
        where: { name: { in: [...new Set(this.defaultTemplateSeeds.map(seed => seed.jobRoleName))] } },
        select: { id: true, name: true },
      }),
    ])

    const contractTypeMap = new Map(contractTypes.map(item => [item.name, item.id]))
    const jobRoleMap = new Map(jobRoles.map(item => [item.name, item.id]))

    for (const seed of this.defaultTemplateSeeds) {
      const definition = CONTRACT_DOCUMENT_DEFINITIONS[seed.templateKey]

      // Seed ini HANYA membuat template yang belum ada (`update: {}`).
      //
      // Sebelumnya blok `update` mengembalikan `isActive: true` dan `version: 1`
      // pada setiap pemuatan halaman (`findAll()` → `ensureDefaultTemplates()`),
      // sehingga admin TIDAK PERNAH bisa menonaktifkan template bawaan: PUT
      // berhasil, tetapi GET berikutnya langsung mengaktifkannya kembali.
      // Efek samping yang sama juga mengembalikan nama/deskripsi/jabatan/tipe
      // kontrak yang sudah disunting admin ke nilai seed. Karena itu perubahan
      // admin tidak boleh ditimpa; template key default yang benar-benar baru
      // tetap dibuat lewat blok `create` di bawah.
      await this.prisma.contractTemplate.upsert({
        where: { code: seed.code },
        update: {},
        create: {
          code: seed.code,
          name: seed.name,
          family: seed.family,
          templateKey: seed.templateKey,
          description: definition?.fidelityNote ?? null,
          requiredFields: definition?.requiredFields ?? null,
          contractTypeId: contractTypeMap.get(seed.contractTypeName) ?? null,
          jobRoleId: jobRoleMap.get(seed.jobRoleName) ?? null,
          isActive: true,
          version: 1,
        },
      })

      const template = await this.prisma.contractTemplate.findUnique({ where: { code: seed.code } })
      if (!template || !definition) continue

      // Bootstrap only: never overwrite an existing draft/published/archived version.
      // This keeps the operation idempotent and preserves administrator changes.
      const versionCount = await this.prisma.client.contractTemplateVersion.count({ where: { templateId: template.id } })
      if (versionCount === 0) {
        const contentDefinition = definitionToContentDefinition(definition)
        // Binding katalog (checkbox "wajib diisi" per template) ikut di-overlay di
        // sini. Jalur bootstrap ini adalah jalur KETIGA yang membuat versi
        // PUBLISHED langsung (selain createDraft/publish dan seed) dan dulu
        // melewatkan binding, sehingga template bawaan yang belum pernah punya
        // versi bisa terbit tanpa field dinamisnya. Untuk DB baru binding memang
        // belum ada (overlay = no-op), tetapi begitu seed mengisi binding, jalur
        // ini tetap menghasilkan snapshot yang konsisten dengan createDraft().
        const fieldDefinitions = applyTemplateBindings(
          definitionToFieldDefinitions(definition),
          await this.fieldsService.findTemplateBindings(template.id),
        )
        // `applyTemplateBindings()` membuang prefix `custom.` dari key
        // CONTRACT_INPUT, sedangkan blok konten menulis `{{custom.xxx}}`.
        // Tanpa jembatan ini validasi menolak `{{custom.ktp_issued_date}}` dan
        // bootstrap versi gagal — akibatnya `GET /contract-templates` selalu 400
        // dan halaman Template Kontrak tampil kosong.
        const validKeys = new Set(fieldDefinitions.map(field => field.key))
        addPlaceholderKeysFromDefinitions(contentDefinition, fieldDefinitions, validKeys)
        validateContentDefinition(contentDefinition, [...validKeys], seed.family)
        await this.prisma.client.contractTemplateVersion.create({
          data: {
            templateId: template.id,
            versionNumber: 1,
            status: 'PUBLISHED',
            contentDefinition: contentDefinition as any,
            fieldDefinitions: fieldDefinitions as any,
            changeSummary: 'Versi awal dari definisi template bawaan aplikasi',
            createdByName: 'System seed',
            publishedByName: 'System seed',
            publishedAt: new Date(),
          },
        })
      }
    }
  }

  ensureAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Role Pengelola Koperasi tidak dapat mengubah Master Template Kontrak')
    }
  }

  async findAll(params: { activeOnly?: boolean } = {}) {
    await this.ensureDefaultTemplates()
    const where = params.activeOnly ? { isActive: true } : undefined
    return this.prisma.contractTemplate.findMany({
      where,
      include: this.include,
      orderBy: [{ family: 'asc' }, { name: 'asc' }],
    })
  }

  async findOne(id: number) {
    const template = await this.prisma.contractTemplate.findUnique({
      where: { id },
      include: this.include,
    })

    if (!template) throw new NotFoundException('Template kontrak tidak ditemukan')
    return template
  }

  async create(payload: ContractTemplatePayload, actor: { name: string; role: string }) {
    try {
      const template = await this.prisma.contractTemplate.create({
        data: {
          ...payload,
          contractTypeId: payload.contractTypeId ?? null,
          jobRoleId: payload.jobRoleId ?? null,
          description: payload.description ?? null,
          notes: payload.notes ?? null,
          requiredFields: (payload.requiredFields as any) ?? null,
          isActive: payload.isActive ?? true,
          version: payload.version ?? 1,
        },
        include: this.include,
      })
      void this.activityLog.log({
        action: 'CREATE',
        module: 'Template Kontrak',
        targetLabel: template.name,
        performedBy: actor.name,
        performedByRole: actor.role,
        detail: `Tipe kontrak: ${(template as any).contractType?.name ?? '-'}`,
      })
      return template
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Kode template kontrak sudah digunakan')
      }
      throw error
    }
  }

  async update(id: number, payload: ContractTemplatePayload, actor: { name: string; role: string }) {
    await this.findOne(id)

    try {
      const template = await this.prisma.contractTemplate.update({
        where: { id },
        data: {
          ...payload,
          contractTypeId: payload.contractTypeId ?? null,
          jobRoleId: payload.jobRoleId ?? null,
          description: payload.description ?? null,
          notes: payload.notes ?? null,
          requiredFields: (payload.requiredFields as any) ?? null,
          // `undefined` = jangan sentuh kolom `isActive`. Sebelumnya `?? true`
          // membuat setiap PUT yang tidak menyertakan `isActive` (mis. hanya
          // mengubah deskripsi) mengaktifkan kembali template yang sengaja
          // dinonaktifkan admin.
          isActive: payload.isActive ?? undefined,
          // `undefined` = jangan sentuh kolom `version`. Sebelumnya `?? 1`
          // membuat setiap PUT yang tidak menyertakan `version` (mis. form
          // edit template di halaman Master Template Kontrak) menurunkan
          // kembali counter `version` ke 1.
          version: payload.version ?? undefined,
        },
        include: this.include,
      })
      void this.activityLog.log({
        action: 'UPDATE',
        module: 'Template Kontrak',
        targetLabel: template.name,
        performedBy: actor.name,
        performedByRole: actor.role,
        detail: `Tipe kontrak: ${(template as any).contractType?.name ?? '-'}`,
      })
      return template
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Kode template kontrak sudah digunakan')
      }
      throw error
    }
  }

  async remove(id: number, actor: { name: string; role: string }) {
    const template = await this.findOne(id)
    const usageCount = await this.prisma.contract.count({ where: { templateId: id } })

    if (usageCount > 0) {
      throw new BadRequestException(`Template ${template.name} sedang dipakai oleh ${usageCount} kontrak`)
    }

    const versionIds = (
      await this.prisma.client.contractTemplateVersion.findMany({
        where: { templateId: id },
        select: { id: true },
      })
    ).map(version => version.id)

    // Kontrak yang masih menunjuk salah satu versi template ini lewat
    // `templateVersionId` harus ditolak. FK-nya `SET NULL`, jadi menghapus
    // versinya akan menghilangkan jejak audit "kontrak ini dulu memakai versi
    // berapa". Sejalan dengan aturan di
    // `ContractTemplateVersionsService.deleteVersion`.
    if (versionIds.length > 0) {
      const versionUsage = await this.prisma.contract.count({
        where: { templateVersionId: { in: versionIds } },
      })
      if (versionUsage > 0) {
        throw new BadRequestException(
          `Template ${template.name} masih dirujuk oleh ${versionUsage} kontrak melalui versi template-nya`,
        )
      }
    }

    try {
      // Versi template & binding field adalah anak template dengan FK
      // `ON DELETE RESTRICT`. Memanggil `delete()` pada template secara langsung
      // SELALU gagal (P2003) selama baris-baris itu ada — dulu berujung 500
      // "Internal server error" tanpa keterangan. Keduanya dihapus lebih dulu
      // dalam satu transaksi agar template tidak pernah terhapus setengah jalan.
      const deleted = await this.prisma.client.$transaction(async (tx) => {
        await tx.contractTemplateField.deleteMany({ where: { templateId: id } })
        await tx.contractTemplateVersion.deleteMany({ where: { templateId: id } })
        return tx.contractTemplate.delete({ where: { id } })
      })
      void this.activityLog.log({
        action: 'DELETE',
        module: 'Template Kontrak',
        targetLabel: template.name,
        performedBy: actor.name,
        performedByRole: actor.role,
        detail: `Nama: ${template.name}`,
      })
      return deleted
    } catch (error: any) {
      // Jaring pengaman: bila masih ada referensi yang belum tertangkap guard di
      // atas (mis. ditulis bersamaan oleh permintaan lain), balas 409 dengan
      // pesan yang bisa ditindaklanjuti alih-alih 500 tanpa keterangan.
      if (error?.code === 'P2003' || error?.meta?.cause?.originalCode === '23503') {
        throw new ConflictException(
          `Template ${template.name} masih direferensikan data lain dan tidak bisa dihapus`,
        )
      }
      throw error
    }
  }

  async getContentPreview(id: number) {
    const template = await this.findOne(id)
    const hardcoded = CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey]
    if (!hardcoded) {
      throw new BadRequestException(`Template key ${template.templateKey} tidak terdaftar di generator dokumen`)
    }
    const merged = mergeDefinition(hardcoded, template.contentOverrides as Record<string, any> | null)
    return {
      template: { id: template.id, name: template.name, templateKey: template.templateKey, family: template.family },
      hardcoded,
      merged,
      hasOverrides: !!(template.contentOverrides && Object.keys(template.contentOverrides as object).length > 0),
    }
  }

  async updateContentOverrides(id: number, overrides: Record<string, any>) {
    await this.findOne(id) // throws if not found
    // DoD #10: jalur runtime `contentOverrides` sudah dinonaktifkan. Kontrak
    // dirender dari versi template (immutable snapshot) yang dikelola lewat
    // endpoint versi template, jadi menulis override di sini tidak lagi punya
    // efek apa pun pada PDF. Ditolak eksplisit supaya admin tidak mengira
    // perubahannya tersimpan.
    void overrides
    throw new ForbiddenException(
      'Pengaturan konten langsung sudah tidak digunakan. Kelola konten lewat versi template (Master Template Kontrak → Versi).',
    )
  }
}
