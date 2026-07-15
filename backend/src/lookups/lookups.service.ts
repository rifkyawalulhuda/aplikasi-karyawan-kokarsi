import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsNotEmpty, IsOptional, IsString, IsEmail } from 'class-validator'
import * as XLSX from 'xlsx'

export class CreateDocumentTypeDto {
  @IsString() @IsNotEmpty() name: string
  @IsString() @IsNotEmpty() documentType: string
  @IsString() @IsNotEmpty() issuer: string
}

export class CreateCompanyDto {
  @IsString() @IsNotEmpty() name: string
  @IsString() @IsOptional() address?: string
  @IsEmail() @IsOptional() email?: string
  @IsString() @IsOptional() phone?: string
}

@Injectable()
export class LookupsService {
  constructor(private prisma: PrismaService) {}

  private readonly defaultContractTypes = ['MITRA', 'PKWT', 'PKWTT', 'Magang'] as const

  private isMissingContractTypesTable(error: any) {
    return error?.code === 'P2021' || error?.meta?.modelName === 'ContractType'
  }

  private contractTypesMigrationError() {
    return new BadRequestException('Tabel contract_types belum tersedia. Jalankan migrasi database terlebih dahulu.')
  }

  private isMissingDepartmentsTable(error: any) {
    return error?.code === 'P2021' || error?.meta?.modelName === 'Department'
  }

  private departmentsMigrationError() {
    return new BadRequestException('Tabel departments belum tersedia. Jalankan migrasi database terlebih dahulu.')
  }

  private isMissingCompaniesTable(error: any) {
    return error?.code === 'P2021' || error?.meta?.modelName === 'Company'
  }

  private companiesMigrationError() {
    return new BadRequestException('Tabel companies belum tersedia. Jalankan migrasi database terlebih dahulu.')
  }

  private isForeignKeyViolation(error: any) {
    return error?.code === 'P2003' || error?.meta?.cause?.originalCode === '23503'
  }

  private foreignKeyError(label: string) {
    return new ConflictException(`Data ${label} sedang dipakai oleh karyawan dan tidak bisa dihapus. Ubah referensi karyawan terlebih dahulu.`)
  }

  private async ensureDefaultContractTypes() {
    const existing = await this.prisma.contractType.findMany({
      select: { name: true },
      where: { name: { in: [...this.defaultContractTypes] } },
    })

    const existingNames = new Set(existing.map(item => item.name))

    const missing = this.defaultContractTypes.filter(name => !existingNames.has(name))
    if (missing.length > 0) {
      await this.prisma.contractType.createMany({
        data: missing.map(name => ({ name })),
        skipDuplicates: true,
      })
    }
  }

  async getAll() {
    await this.ensureDefaultContractTypes().catch((error) => {
      if (this.isMissingContractTypesTable(error)) return
      throw error
    })

    const [workLocations, jobRoles, jobLevels, taxStatus, contractTypes, departments, documentTypes, companies] = await Promise.all([
      this.prisma.workLocation.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.jobRole.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.jobLevel.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.taxStatus.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.contractType.findMany({ orderBy: { name: 'asc' } }).catch((error) => {
        if (this.isMissingContractTypesTable(error)) return []
        throw error
      }),
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }).catch((error) => {
        if (this.isMissingDepartmentsTable(error)) return []
        throw error
      }),
      this.prisma.documentType.findMany({ orderBy: { name: 'asc' } }).catch(() => []),
      this.prisma.company.findMany({ orderBy: { name: 'asc' } }).catch((error) => {
        if (this.isMissingCompaniesTable(error)) return []
        throw error
      }),
    ])
    return { workLocations, jobRoles, jobLevels, taxStatus, contractTypes, departments, documentTypes, companies }
  }

  getWorkLocations() { return this.prisma.workLocation.findMany({ orderBy: { name: 'asc' } }) }
  createWorkLocation(name: string) { return this.prisma.workLocation.create({ data: { name } }) }
  updateWorkLocation(id: number, name: string) { return this.prisma.workLocation.update({ where: { id }, data: { name } }) }
  deleteWorkLocation(id: number) {
    return this.prisma.workLocation.delete({ where: { id } }).catch((e) => {
      if (this.isForeignKeyViolation(e)) throw this.foreignKeyError('lokasi kerja')
      throw e
    })
  }

  getJobRoles() { return this.prisma.jobRole.findMany({ orderBy: { name: 'asc' } }) }
  createJobRole(name: string) { return this.prisma.jobRole.create({ data: { name } }) }
  updateJobRole(id: number, name: string) { return this.prisma.jobRole.update({ where: { id }, data: { name } }) }
  deleteJobRole(id: number) {
    return this.prisma.jobRole.delete({ where: { id } }).catch((e) => {
      if (this.isForeignKeyViolation(e)) throw this.foreignKeyError('jabatan')
      throw e
    })
  }

  getJobLevels() { return this.prisma.jobLevel.findMany({ orderBy: { name: 'asc' } }) }
  createJobLevel(name: string) { return this.prisma.jobLevel.create({ data: { name } }) }
  updateJobLevel(id: number, name: string) { return this.prisma.jobLevel.update({ where: { id }, data: { name } }) }
  deleteJobLevel(id: number) {
    return this.prisma.jobLevel.delete({ where: { id } }).catch((e) => {
      if (this.isForeignKeyViolation(e)) throw this.foreignKeyError('level jabatan')
      throw e
    })
  }

  getTaxStatus() { return this.prisma.taxStatus.findMany({ orderBy: { name: 'asc' } }) }
  createTaxStatus(name: string) { return this.prisma.taxStatus.create({ data: { name } }) }
  updateTaxStatus(id: number, name: string) { return this.prisma.taxStatus.update({ where: { id }, data: { name } }) }
  deleteTaxStatus(id: number) {
    return this.prisma.taxStatus.delete({ where: { id } }).catch((e) => {
      if (this.isForeignKeyViolation(e)) throw this.foreignKeyError('status pajak')
      throw e
    })
  }

  getContractTypes() {
    return this.ensureDefaultContractTypes()
      .catch((error) => {
        if (this.isMissingContractTypesTable(error)) return
        throw error
      })
      .then(() => this.prisma.contractType.findMany({ orderBy: { name: 'asc' } }))
      .catch((error) => {
      if (this.isMissingContractTypesTable(error)) return []
      throw error
      })
  }

  createContractType(name: string) {
    return this.prisma.contractType.create({ data: { name } }).catch((error) => {
      if (this.isMissingContractTypesTable(error)) throw this.contractTypesMigrationError()
      throw error
    })
  }

  updateContractType(id: number, name: string) {
    return this.prisma.contractType.update({ where: { id }, data: { name } }).catch((error) => {
      if (this.isMissingContractTypesTable(error)) throw this.contractTypesMigrationError()
      throw error
    })
  }

  deleteContractType(id: number) {
    return this.prisma.contractType.delete({ where: { id } }).catch((error) => {
      if (this.isMissingContractTypesTable(error)) throw this.contractTypesMigrationError()
      if (this.isForeignKeyViolation(error)) throw this.foreignKeyError('tipe kontrak')
      throw error
    })
  }

  getDepartments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } }).catch((error) => {
      if (this.isMissingDepartmentsTable(error)) throw this.departmentsMigrationError()
      throw error
    })
  }

  createDepartment(name: string) {
    return this.prisma.department.create({ data: { name } }).catch((error) => {
      if (this.isMissingDepartmentsTable(error)) throw this.departmentsMigrationError()
      throw error
    })
  }

  updateDepartment(id: number, name: string) {
    return this.prisma.department.update({ where: { id }, data: { name } }).catch((error) => {
      if (this.isMissingDepartmentsTable(error)) throw this.departmentsMigrationError()
      throw error
    })
  }

  deleteDepartment(id: number) {
    return this.prisma.department.delete({ where: { id } }).catch((error) => {
      if (this.isMissingDepartmentsTable(error)) throw this.departmentsMigrationError()
      if (this.isForeignKeyViolation(error)) throw this.foreignKeyError('departemen')
      throw error
    })
  }

  async getDocumentTypes(category?: string) {
    const where: any = {}
    if (category) where.category = category
    return this.prisma.documentType.findMany({ where, orderBy: { name: 'asc' } })
  }

  async createDocumentType(dto: CreateDocumentTypeDto) {
    return this.prisma.documentType.create({ data: dto })
  }

  async updateDocumentType(id: number, dto: CreateDocumentTypeDto) {
    const existing = await this.prisma.documentType.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Tipe dokumen tidak ditemukan')
    return this.prisma.documentType.update({ where: { id }, data: dto })
  }

  async deleteDocumentType(id: number) {
    const existing = await this.prisma.documentType.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Tipe dokumen tidak ditemukan')
    return this.prisma.documentType.delete({ where: { id } })
  }

  getCompanies() {
    return this.prisma.company.findMany({ orderBy: { name: 'asc' } }).catch((error) => {
      if (this.isMissingCompaniesTable(error)) throw this.companiesMigrationError()
      throw error
    })
  }

  createCompany(dto: CreateCompanyDto) {
    return this.prisma.company.create({ data: dto }).catch((error) => {
      if (this.isMissingCompaniesTable(error)) throw this.companiesMigrationError()
      throw error
    })
  }

  updateCompany(id: number, dto: CreateCompanyDto) {
    return this.prisma.company.update({ where: { id }, data: dto }).catch((error) => {
      if (this.isMissingCompaniesTable(error)) throw this.companiesMigrationError()
      throw error
    })
  }

  deleteCompany(id: number) {
    return this.prisma.company.delete({ where: { id } }).catch((error) => {
      if (this.isMissingCompaniesTable(error)) throw this.companiesMigrationError()
      if (this.isForeignKeyViolation(error)) throw this.foreignKeyError('perusahaan')
      throw error
    })
  }

  async generateCompanyImportTemplate(): Promise<Buffer> {
    const data = [
      { 'Nama Perusahaan': 'PT Contoh Sejahtera', 'Alamat': 'Jl. Merdeka No. 1, Jakarta', 'Email': 'info@contoh.co.id', 'No. Kontak': '021-1234567' },
      { 'Nama Perusahaan': 'CV Mitra Jaya', 'Alamat': 'Jl. Sudirman No. 2, Bandung', 'Email': 'admin@mitrajaya.com', 'No. Kontak': '022-7654321' },
    ]
    const worksheet = XLSX.utils.json_to_sheet(data)
    worksheet['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 20 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Perusahaan')
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  }

  async bulkCreateCompanies(companies: CreateCompanyDto[]) {
    const created: any[] = []
    const errors: { row: number; name: string; error: string }[] = []
    for (let i = 0; i < companies.length; i++) {
      const c = companies[i]
      try {
        const result = await this.prisma.company.create({ data: c })
        created.push(result)
      } catch (error: any) {
        const msg = error?.code === 'P2002'
          ? `Nama perusahaan "${c.name}" sudah ada`
          : (error?.message ?? 'Gagal membuat perusahaan')
        errors.push({ row: i + 2, name: c.name, error: msg })
      }
    }
    return {
      total: companies.length,
      created: created.length,
      failed: errors.length,
      errors,
      data: created,
    }
  }
}
