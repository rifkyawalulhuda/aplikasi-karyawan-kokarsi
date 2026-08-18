import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ContractFamily } from '@prisma/client'
import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../contracts/contract-document-definitions'
import { ActivityLogService } from '../activity-log/activity-log.service'

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
  ) {}

  private readonly defaultTemplateSeeds = [
    { code: 'MITRA_DRIVER', name: 'Mitra Driver', family: 'MITRA' as const, templateKey: 'MITRA_DRIVER', contractTypeName: 'MITRA', jobRoleName: 'Driver' },
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

      await this.prisma.contractTemplate.upsert({
        where: { code: seed.code },
        update: {
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
          isActive: payload.isActive ?? true,
          version: payload.version ?? 1,
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

    const deleted = await this.prisma.contractTemplate.delete({ where: { id } })
    void this.activityLog.log({
      action: 'DELETE',
      module: 'Template Kontrak',
      targetLabel: template.name,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Nama: ${template.name}`,
    })
    return deleted
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
    return this.prisma.contractTemplate.update({
      where: { id },
      data: { contentOverrides: overrides },
      include: this.include,
    })
  }
}
