import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TemplateFieldDefinition } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

class CreateTemplateFieldDto {
  key!: string
  label!: string
  dataType!: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'MASTER_REFERENCE'
  sourceType!: 'SYSTEM' | 'CONTRACT_INPUT' | 'MASTER_REFERENCE'
  sourceConfig?: any
  options?: any
  isSystem?: boolean
}

class UpdateTemplateFieldDto {
  label?: string
  options?: any
  sourceConfig?: any
}

const KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

/** Seed katalog field system — idempotent, dijalankan saat service start. */
const SYSTEM_FIELD_SEEDS: Array<{
  key: string
  label: string
  dataType: 'TEXT' | 'NUMBER' | 'DATE'
  sourceType: 'SYSTEM'
}> = [
  // Contract
  { key: 'contract.contractNo', label: 'Nomor Kontrak', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'contract.startDate', label: 'Tanggal Mulai', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'contract.endDate', label: 'Tanggal Selesai', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'contract.signedDate', label: 'Tanggal Tanda Tangan', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'contract.baseCompensation', label: 'Kompensasi Dasar', dataType: 'NUMBER', sourceType: 'SYSTEM' },
  { key: 'contract.termRange', label: 'Rentang Periode (auto)', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'contract.duration', label: 'Durasi Kontrak (auto)', dataType: 'TEXT', sourceType: 'SYSTEM' },
  // Employee
  { key: 'employee.fullName', label: 'Nama Lengkap Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.employeeNo', label: 'Nomor Induk Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.nik', label: 'NIK Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.birthPlace', label: 'Tempat Lahir', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.birthDate', label: 'Tanggal Lahir', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'employee.address', label: 'Alamat Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.jobRole', label: 'Jabatan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  // Doc & settings
  { key: 'doc.docDate', label: 'Tanggal Dokumen', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'doc.hariTanggal', label: 'Hari & Tanggal Tanda Tangan (auto)', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'settings.cooperativeChairmanName', label: 'Nama Ketua Koperasi', dataType: 'TEXT', sourceType: 'SYSTEM' },
]

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
    // Custom field dari sample MITRA
    const ktp = await this.prisma.client.templateFieldDefinition.findUnique({
      where: { key: 'ktp_issued_date' },
    })
    if (!ktp) {
      await this.prisma.client.templateFieldDefinition.create({
        data: {
          key: 'ktp_issued_date',
          label: 'Tanggal Terbit KTP Mitra',
          dataType: 'DATE',
          sourceType: 'CONTRACT_INPUT',
          isSystem: false,
          isActive: true,
        },
      })
      created += 1
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
