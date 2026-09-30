import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { validateContentDefinition, collectAllPlaceholders } from './template-schema.validator'
import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../contracts/contract-document-definitions'
import { definitionToContentDefinition, definitionToFieldDefinitions } from './default-template-definition'
import { TemplateFieldsService } from './template-fields.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { isValidMasterField, isValidMasterSource } from './master-reference.registry'

interface CreateDraftDto {
  changeSummary?: string
  contentDefinition?: any
  fieldDefinitions?: any
  overrides?: Record<string, unknown>
}

interface UpdateDraftDto {
  contentDefinition?: any
  fieldDefinitions?: any
  changeSummary?: string
}

@Injectable()
export class ContractTemplateVersionsService {
  constructor(
    private prisma: PrismaService,
    private fieldsService: TemplateFieldsService,
    private activityLog: ActivityLogService,
  ) {}

  /** Daftar versi untuk satu template master. */
  async listVersions(templateId: number) {
    await this.ensureTemplate(templateId)
    return this.prisma.client.contractTemplateVersion.findMany({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
    })
  }

  async findOne(versionId: number) {
    const version = await this.prisma.client.contractTemplateVersion.findUnique({
      where: { id: versionId },
      include: { template: { select: { id: true, code: true, name: true, family: true } } },
    })
    if (!version) throw new NotFoundException('Versi template tidak ditemukan')
    return version
  }

  /** Buat draft baru dari versi PUBLISHED terakhir (atau dari definisi hard-code via migrasi). */
  async createDraft(
    templateId: number,
    dto: CreateDraftDto,
    actor: { name: string },
  ) {
    await this.ensureTemplate(templateId)
    await this.ensureNoOpenDraft(templateId)

    const lastVersion = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    const latestVersion = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId }, orderBy: { versionNumber: 'desc' },
    })
    const nextNumber = (latestVersion?.versionNumber ?? 0) + 1
    if (!dto.contentDefinition && !lastVersion) {
      throw new BadRequestException('contentDefinition wajib diisi untuk template tanpa versi published')
    }

    let contentDefinition = dto.contentDefinition ?? lastVersion?.contentDefinition
    let fieldDefinitions = dto.fieldDefinitions ?? lastVersion?.fieldDefinitions
    if (dto.overrides && !dto.contentDefinition) {
      const template = await this.prisma.client.contractTemplate.findUnique({ where: { id: templateId } })
      const base = template && CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey]
      if (!base) throw new BadRequestException('Definisi bawaan template tidak ditemukan')
      const merged = mergeDefinition(base, dto.overrides as any)
      contentDefinition = definitionToContentDefinition(merged)
      fieldDefinitions = definitionToFieldDefinitions(merged)
    }

    return this.prisma.client.contractTemplateVersion.create({
      data: {
        templateId,
        versionNumber: nextNumber,
        status: 'DRAFT',
        contentDefinition: contentDefinition as any,
        fieldDefinitions: fieldDefinitions as any,
        changeSummary: dto.changeSummary,
        createdByName: actor.name,
      },
    })
  }

  /** Update draft — hanya boleh saat masih DRAFT. */
  async updateDraft(versionId: number, dto: UpdateDraftDto, actor: { name: string }) {
    const version = await this.findOne(versionId)
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Hanya versi DRAFT yang dapat diubah')
    }
    return this.prisma.client.contractTemplateVersion.update({
      where: { id: versionId },
      data: {
        contentDefinition: dto.contentDefinition !== undefined ? (dto.contentDefinition as any) : undefined,
        fieldDefinitions: dto.fieldDefinitions !== undefined ? (dto.fieldDefinitions as any) : undefined,
        changeSummary: dto.changeSummary,
      },
    })
  }

  /**
   * Publish atomic:
   * 1. validasi schema + placeholder
   * 2. archive versi PUBLISHED lama
   * 3. set versi ini PUBLISHED
   * Semua dalam satu transaction.
   */
  async publish(versionId: number, actor: { name: string }) {
    const version = await this.findOne(versionId)
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Hanya versi DRAFT yang dapat dipublish')
    }

    const template = await this.prisma.client.contractTemplate.findUnique({
      where: { id: version.templateId },
    })
    if (!template) throw new NotFoundException('Template tidak ditemukan')

    // Kumpulkan field keys valid: system + custom yang direferensikan fieldDefinitions
    const catalog = await this.prisma.client.templateFieldDefinition.findMany({
      where: { isActive: true },
      select: { key: true },
    })
    const validKeys = new Set(catalog.map(f => f.key))

    this.validateFieldDefinitions(version.fieldDefinitions, validKeys)
    const placeholders = collectAllPlaceholders(version.contentDefinition)
    for (const ph of placeholders) {
      // placeholder {{custom.xxx}} juga valid jika ada di fieldDefinitions snapshot
      const defs = Array.isArray(version.fieldDefinitions)
        ? version.fieldDefinitions
        : (version.fieldDefinitions as any)?.fields
      if (Array.isArray(defs)) {
        const inDefs = defs.some((d: any) => ph === d.key || ph === `custom.${d.key}`)
        if (inDefs) validKeys.add(ph)
      }
    }

    validateContentDefinition(version.contentDefinition, [...validKeys], template.family as any)

    const now = new Date()
    const published = await this.prisma.client.$transaction(async tx => {
      // Archive versi published lama
      await tx.contractTemplateVersion.updateMany({
        where: { templateId: version.templateId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      })
      return tx.contractTemplateVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: now, publishedByName: actor.name },
      })
    })
    await this.activityLog.log({ action: 'UPDATE', module: 'Template Kontrak', targetLabel: `Versi ${version.versionNumber}`, performedBy: actor.name, performedByRole: 'ADMIN', detail: `Publish template ${template.code}` })
    return published
  }

  /** Validasi draft tanpa mengubah status atau data database. */
  async preview(versionId: number) {
    const version = await this.findOne(versionId)
    const catalog = await this.prisma.client.templateFieldDefinition.findMany({ where: { isActive: true }, select: { key: true } })
    const validKeys = new Set(catalog.map(field => field.key))
    this.validateFieldDefinitions(version.fieldDefinitions, validKeys)
    for (const placeholder of collectAllPlaceholders(version.contentDefinition)) {
      const definitions = this.definitionArray(version.fieldDefinitions)
      if (definitions.some((field: any) => placeholder === field.key || placeholder === `custom.${field.key}`)) validKeys.add(placeholder)
    }
    const result = validateContentDefinition(version.contentDefinition, [...validKeys], version.template.family as any)
    return { versionId: version.id, templateId: version.templateId, valid: true, ...result }
  }

  /** Rollback: aktifkan kembali versi ARCHIVED tertentu sebagai PUBLISHED. */
  async rollback(versionId: number, actor: { name: string }) {
    const version = await this.findOne(versionId)
    if (version.status !== 'ARCHIVED') {
      throw new BadRequestException('Rollback hanya dapat dilakukan pada versi ARCHIVED')
    }
    const catalog = await this.prisma.client.templateFieldDefinition.findMany({ where: { isActive: true }, select: { key: true } })
    const validKeys = new Set(catalog.map(field => field.key))
    this.validateFieldDefinitions(version.fieldDefinitions, validKeys)
    for (const placeholder of collectAllPlaceholders(version.contentDefinition)) {
      const definitions = this.definitionArray(version.fieldDefinitions)
      if (definitions.some((field: any) => placeholder === field.key || placeholder === `custom.${field.key}`)) validKeys.add(placeholder)
    }
    validateContentDefinition(version.contentDefinition, [...validKeys], version.template.family as any)
    const published = await this.prisma.client.$transaction(async tx => {
      await tx.contractTemplateVersion.updateMany({
        where: { templateId: version.templateId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      })
      return tx.contractTemplateVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: new Date(), publishedByName: actor.name },
      })
    })
    await this.activityLog.log({ action: 'UPDATE', module: 'Template Kontrak', targetLabel: `Versi ${version.versionNumber}`, performedBy: actor.name, performedByRole: 'ADMIN', detail: `Rollback template ${version.template.code}` })
    return published
  }

  /** Versi PUBLISHED aktif untuk sebuah template. */
  async getPublished(templateId: number) {
    return this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
  }

  private async ensureTemplate(templateId: number) {
    const t = await this.prisma.client.contractTemplate.findUnique({ where: { id: templateId } })
    if (!t) throw new NotFoundException('Template tidak ditemukan')
  }

  private async ensureNoOpenDraft(templateId: number) {
    const draft = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId, status: 'DRAFT' },
    })
    if (draft) {
      throw new BadRequestException(
        `Masih ada draft terbuka (v${draft.versionNumber}). Selesaikan atau hapus terlebih dahulu.`,
      )
    }
  }

  private definitionArray(value: any): any[] {
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.fields)) return value.fields
    throw new BadRequestException('fieldDefinitions harus berupa array atau object { fields: [] }')
  }

  private validateFieldDefinitions(value: any, catalog: Set<string>) {
    const definitions = this.definitionArray(value)
    const keys = new Set<string>()
    for (const definition of definitions) {
      if (!definition || typeof definition.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(definition.key)) {
        throw new BadRequestException('Setiap field definition harus memiliki key yang valid')
      }
      if (keys.has(definition.key)) throw new BadRequestException(`Duplicate field key: ${definition.key}`)
      keys.add(definition.key)
      if (definition.sourceType === 'SYSTEM' && !catalog.has(definition.key)) {
        throw new BadRequestException(`Field system "${definition.key}" tidak terdaftar di katalog`)
      }
      if (definition.sourceType === 'CONTRACT_INPUT' && definition.key.includes('.')) {
        throw new BadRequestException(`Field CONTRACT_INPUT "${definition.key}" tidak boleh memakai namespace system`)
      }
      if (!['SYSTEM', 'CONTRACT_INPUT', 'MASTER_REFERENCE'].includes(definition.sourceType)) {
        throw new BadRequestException(`Source field tidak valid untuk "${definition.key}"`)
      }
      if (!['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MASTER_REFERENCE'].includes(definition.dataType)) {
        throw new BadRequestException(`Tipe field tidak valid untuk "${definition.key}"`)
      }
      if (definition.sourceType === 'MASTER_REFERENCE' || definition.dataType === 'MASTER_REFERENCE') {
        const config = definition.sourceConfig ?? {}
        const master = config.master
        const field = config.field ?? config.labelField
        if (!isValidMasterSource(master) || !isValidMasterField(master, field)) {
          throw new BadRequestException(`Master reference tidak valid untuk "${definition.key}"`)
        }
        if (definition.dataType !== 'MASTER_REFERENCE') {
          throw new BadRequestException(`Field master "${definition.key}" harus bertipe MASTER_REFERENCE`)
        }
      }
      if (definition.dataType === 'DROPDOWN' && (!Array.isArray(definition.options) || definition.options.length === 0)) {
        throw new BadRequestException(`Field DROPDOWN "${definition.key}" memerlukan opsi`)
      }
    }
  }
}
