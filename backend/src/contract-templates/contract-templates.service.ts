import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ContractFamily } from '@prisma/client'
import { CONTRACT_DOCUMENT_DEFINITIONS } from '../contracts/contract-document-definitions'

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
  constructor(private prisma: PrismaService) {}

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
    const existingTemplates = await this.prisma.contractTemplate.findMany({
      select: { code: true },
    })

    const existingCodes = new Set(existingTemplates.map(template => template.code))
    const missingSeeds = this.defaultTemplateSeeds.filter(seed => !existingCodes.has(seed.code))

    if (!missingSeeds.length) return

    const [contractTypes, jobRoles] = await Promise.all([
      this.prisma.contractType.findMany({
        where: { name: { in: [...new Set(missingSeeds.map(seed => seed.contractTypeName))] } },
        select: { id: true, name: true },
      }),
      this.prisma.jobRole.findMany({
        where: { name: { in: [...new Set(missingSeeds.map(seed => seed.jobRoleName))] } },
        select: { id: true, name: true },
      }),
    ])

    const contractTypeMap = new Map(contractTypes.map(item => [item.name, item.id]))
    const jobRoleMap = new Map(jobRoles.map(item => [item.name, item.id]))

    for (const seed of missingSeeds) {
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

  async create(payload: ContractTemplatePayload) {
    try {
      return await this.prisma.contractTemplate.create({
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
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Kode template kontrak sudah digunakan')
      }
      throw error
    }
  }

  async update(id: number, payload: ContractTemplatePayload) {
    await this.findOne(id)

    try {
      return await this.prisma.contractTemplate.update({
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
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Kode template kontrak sudah digunakan')
      }
      throw error
    }
  }

  async remove(id: number) {
    const template = await this.findOne(id)
    const usageCount = await this.prisma.contract.count({ where: { templateId: id } })

    if (usageCount > 0) {
      throw new BadRequestException(`Template ${template.name} sedang dipakai oleh ${usageCount} kontrak`)
    }

    return this.prisma.contractTemplate.delete({ where: { id } })
  }
}
