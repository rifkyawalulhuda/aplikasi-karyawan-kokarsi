import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TemplateFieldDefinition } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CONTRACT_INPUT_FIELD_SEEDS, SYSTEM_FIELD_SEEDS } from './template-field-seeds'
import { CONTRACT_DOCUMENT_DEFINITIONS } from '../contracts/contract-document-definitions'
import { definitionToContentDefinition } from './default-template-definition'
import { collectAllPlaceholders } from './template-schema.validator'

class CreateTemplateFieldDto {
  key!: string
  label!: string
  dataType!: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'MASTER_REFERENCE'
  sourceType!: 'SYSTEM' | 'CONTRACT_INPUT' | 'MASTER_REFERENCE'
  sourceConfig?: any
  options?: any
  isSystem?: boolean
}

/** Satu baris panel binding: field katalog + status pemakaiannya di template. */
export interface TemplateBindingView {
  fieldId: number
  key: string
  label: string
  dataType: string
  sourceType: string
  isSystem: boolean
  /** Dipakai template ini (punya baris binding untuk CONTRACT_INPUT; direferensikan konten untuk SYSTEM). */
  bound: boolean
  /** Wajib diisi petugas saat membuat kontrak. */
  required: boolean
  /** SYSTEM tidak dapat diubah dari panel (selalu dipakai + wajib). */
  locked: boolean
  /** Placeholder-nya masih muncul di konten template — melepasnya akan menggagalkan publish. */
  usedInContent: boolean
  sortOrder: number | null
}

class UpdateTemplateFieldDto {
  label?: string
  options?: any
  sourceConfig?: any
}

const KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

@Injectable()
export class TemplateFieldsService {
  constructor(private prisma: PrismaService) {}

  /** Idempotent seed — dipanggil onModuleInit dan manual. */
  async ensureSystemFields(): Promise<{ created: number }> {
    let created = 0
    for (const seed of SYSTEM_FIELD_SEEDS) {
      const exists = await this.prisma.client.templateFieldDefinition.findUnique({
        where: { key: seed.key },
      })
      if (!exists) {
        await this.prisma.client.templateFieldDefinition.create({
          data: {
            key: seed.key,
            label: seed.label,
            dataType: seed.dataType,
            sourceType: seed.sourceType,
            isSystem: true,
            isActive: true,
          },
        })
        created += 1
      }
    }
    // Field dinamis (CONTRACT_INPUT) bawaan — mis. dari sample MITRA.
    for (const seed of CONTRACT_INPUT_FIELD_SEEDS) {
      const exists = await this.prisma.client.templateFieldDefinition.findUnique({
        where: { key: seed.key },
      })
      if (!exists) {
        await this.prisma.client.templateFieldDefinition.create({
          data: {
            key: seed.key,
            label: seed.label,
            dataType: seed.dataType,
            sourceType: seed.sourceType,
            isSystem: false,
            isActive: true,
            options: (seed.options ?? undefined) as any,
          },
        })
        created += 1
      }
    }
    return { created }
  }

  async findAll(params: { includeInactive?: boolean } = {}): Promise<TemplateFieldDefinition[]> {
    return this.prisma.client.templateFieldDefinition.findMany({
      where: params.includeInactive ? {} : { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { key: 'asc' }],
    })
  }

  /**
   * Binding katalog field untuk sebuah template — sumber kebenaran field
   * dinamis yang dipakai template beserta flag wajibnya. Dipakai oleh
   * `ContractTemplateVersionsService` saat membuat/mengubah draft versi
   * (lihat template-field-bindings.helpers.ts).
   */
  async findTemplateBindings(templateId: number) {
    return this.prisma.client.contractTemplateField.findMany({
      where: { templateId, field: { is: { isActive: true } } },
      include: { field: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
  }

  /**
   * Key semua field CONTRACT_INPUT di katalog (tanpa prefix `custom.`).
   *
   * Dipakai `applyTemplateBindings()` untuk membedakan field yang dikelola
   * katalog template (boleh di-"uncheck Pakai") dari placeholder lepasan yang
   * ditulis langsung di teks. Lihat `ApplyTemplateBindingsOptions`.
   */
  async findContractInputCatalogKeys(): Promise<Set<string>> {
    const rows = await this.prisma.client.templateFieldDefinition.findMany({
      where: { isActive: true, sourceType: 'CONTRACT_INPUT' },
      select: { key: true },
    })
    return new Set(rows.map(row => String(row.key).replace(/^custom\./, '')))
  }

  /**
   * Panel binding editor template: seluruh field katalog aktif + status
   * pemakaiannya di template ini.
   *
   *  - `bound`         : CONTRACT_INPUT punya baris binding; SYSTEM direferensikan konten.
   *  - `locked`        : SYSTEM tidak dapat diubah dari panel (selalu dipakai & wajib).
   *  - `usedInContent` : placeholder masih ada di konten template — melepasnya
   *    membuat `publish()` gagal ("Placeholder ... tidak terdaftar di katalog").
   */
  async listTemplateBindings(templateId: number): Promise<{ templateId: number; fields: TemplateBindingView[] }> {
    await this.ensureTemplate(templateId)
    const [catalog, bindings, referenced] = await Promise.all([
      this.prisma.client.templateFieldDefinition.findMany({
        where: { isActive: true },
        orderBy: [{ isSystem: 'desc' }, { key: 'asc' }],
      }),
      this.prisma.client.contractTemplateField.findMany({
        where: { templateId },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.referencedFieldKeys(templateId),
    ])

    const byFieldId = new Map(bindings.map(b => [b.fieldId, b]))
    const fields: TemplateBindingView[] = catalog.map(field => {
      const binding = byFieldId.get(field.id)
      const isSystem = field.sourceType === 'SYSTEM'
      const usedInContent = referenced.has(field.key) || referenced.has(`custom.${field.key}`)
      return {
        fieldId: field.id,
        key: field.key,
        label: field.label,
        dataType: field.dataType,
        sourceType: field.sourceType,
        isSystem,
        bound: isSystem ? usedInContent : Boolean(binding),
        required: isSystem ? true : Boolean(binding?.required),
        locked: isSystem,
        usedInContent,
        sortOrder: binding?.sortOrder ?? null,
      }
    })
    return { templateId, fields }
  }

  /**
   * Set/pakai (bind) atau lepas (unbind) sebuah field katalog pada template.
   *
   * `required` hanya bermakna saat `bound`. Melepas field CONTRACT_INPUT yang
   * masih direferensikan konten DIIZINKAN (keputusan produk), tetapi `publish()`
   * akan menolaknya sampai placeholder `{{...}}` dihapus dari teks — panel
   * menampilkan peringatan `usedInContent` untuk itu.
   */
  async setTemplateBinding(
    templateId: number,
    fieldId: number,
    dto: { bound: boolean; required?: boolean },
  ): Promise<{ templateId: number; fields: TemplateBindingView[] }> {
    await this.ensureTemplate(templateId)
    const field = await this.prisma.client.templateFieldDefinition.findUnique({ where: { id: fieldId } })
    if (!field) throw new NotFoundException('Field tidak ditemukan')
    if (field.sourceType === 'SYSTEM') {
      throw new BadRequestException('Field system selalu dipakai dan wajib — tidak dapat diubah dari panel.')
    }
    if (field.sourceType === 'MASTER_REFERENCE') {
      throw new BadRequestException('Field master reference belum didukung pada dokumen kontrak.')
    }

    const existing = await this.prisma.client.contractTemplateField.findUnique({
      where: { templateId_fieldId: { templateId, fieldId } },
    })

    if (dto.bound) {
      const required = dto.required === true
      if (existing) {
        await this.prisma.client.contractTemplateField.update({
          where: { id: existing.id },
          data: { required },
        })
      } else {
        const max = await this.prisma.client.contractTemplateField.aggregate({
          where: { templateId },
          _max: { sortOrder: true },
        })
        await this.prisma.client.contractTemplateField.create({
          data: { templateId, fieldId, required, sortOrder: (max._max.sortOrder ?? -1) + 1 },
        })
      }
    } else if (existing) {
      await this.prisma.client.contractTemplateField.delete({ where: { id: existing.id } })
    }

    return this.listTemplateBindings(templateId)
  }

  /** Placeholder key yang muncul di konten efektif template (PUBLISHED → draft → definisi kode). */
  private async referencedFieldKeys(templateId: number): Promise<Set<string>> {
    const version = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    }) ?? await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
    })

    let content: any = version?.contentDefinition
    if (!content) {
      const template = await this.prisma.client.contractTemplate.findUnique({ where: { id: templateId } })
      const definition = template ? CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey] : undefined
      if (definition) content = definitionToContentDefinition(definition)
    }

    const keys = new Set<string>()
    for (const placeholder of collectAllPlaceholders(content)) {
      keys.add(placeholder)
      keys.add(placeholder.replace(/^custom\./, ''))
    }
    return keys
  }

  private async ensureTemplate(templateId: number) {
    const template = await this.prisma.client.contractTemplate.findUnique({ where: { id: templateId } })
    if (!template) throw new NotFoundException('Template kontrak tidak ditemukan')
    return template
  }

  async findOne(id: number): Promise<TemplateFieldDefinition> {
    const field = await this.prisma.client.templateFieldDefinition.findUnique({ where: { id } })
    if (!field) throw new NotFoundException('Field tidak ditemukan')
    return field
  }

  async create(dto: CreateTemplateFieldDto): Promise<TemplateFieldDefinition> {
    if (!KEY_PATTERN.test(dto.key)) {
      throw new BadRequestException('Key hanya boleh huruf kecil, angka, underscore, dan titik (maks 2 level)')
    }
    if (dto.isSystem) {
      throw new BadRequestException('Field system tidak dapat dibuat dari API')
    }
    if (dto.sourceType === 'MASTER_REFERENCE' && dto.dataType !== 'MASTER_REFERENCE') {
      throw new BadRequestException('Source MASTER_REFERENCE harus memakai tipe MASTER_REFERENCE')
    }
    if (dto.dataType === 'MASTER_REFERENCE' || dto.sourceType === 'MASTER_REFERENCE') {
      if (dto.sourceType !== 'MASTER_REFERENCE') {
        throw new BadRequestException('Tipe MASTER_REFERENCE harus memakai source MASTER_REFERENCE')
      }
      const source = (dto.sourceConfig as any)?.master
      const { isValidMasterSource, isValidMasterField } = await import('./master-reference.registry')
      if (!isValidMasterSource(source)) {
        throw new BadRequestException(`Master source "${source}" tidak terdaftar`)
      }
      const field = (dto.sourceConfig as any)?.field
      if (!isValidMasterField(source, field)) {
        throw new BadRequestException(`Field "${field}" tidak diizinkan untuk master ${source}`)
      }
    } else if (dto.sourceType === 'SYSTEM' && !dto.isSystem) {
      throw new BadRequestException('Field source SYSTEM hanya boleh berasal dari field system')
    }
    if (dto.dataType === 'DROPDOWN' && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('Field DROPDOWN memerlukan minimal satu opsi')
    }
    try {
      return await this.prisma.client.templateFieldDefinition.create({
        data: {
          key: dto.key,
          label: dto.label,
          dataType: dto.dataType,
          sourceType: dto.sourceType,
          sourceConfig: dto.sourceConfig ?? undefined,
          options: dto.options ?? undefined,
          isSystem: false,
          isActive: true,
        },
      })
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('Key field sudah digunakan')
      throw e
    }
  }

  async update(id: number, dto: UpdateTemplateFieldDto): Promise<TemplateFieldDefinition> {
    const field = await this.findOne(id)
    // Field system: hanya label boleh diubah
    if (field.isSystem) {
      if (dto.options !== undefined || dto.sourceConfig !== undefined) {
        throw new BadRequestException('Field system tidak dapat diubah source/options-nya')
      }
      return this.prisma.client.templateFieldDefinition.update({
        where: { id },
        data: { label: dto.label ?? field.label },
      })
    }
    // Field yang sudah dipakai versi published: tipe & key tidak boleh berubah (key memang immutable di DB)
    return this.prisma.client.templateFieldDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        options: dto.options === undefined ? undefined : dto.options,
        sourceConfig: dto.sourceConfig === undefined ? undefined : dto.sourceConfig,
      },
    })
  }

  async archive(id: number): Promise<TemplateFieldDefinition> {
    const field = await this.findOne(id)
    if (field.isSystem) {
      throw new BadRequestException('Field system tidak dapat diarsipkan')
    }
    const usedCount = await this.prisma.client.contractTemplateField.count({ where: { fieldId: id } })
    if (usedCount > 0) {
      // Arsip, bukan delete — versi published tetap valid
      return this.prisma.client.templateFieldDefinition.update({
        where: { id },
        data: { isActive: false },
      })
    }
    return this.prisma.client.templateFieldDefinition.update({
      where: { id },
      data: { isActive: false },
    })
  }
}
