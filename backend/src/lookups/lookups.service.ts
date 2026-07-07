import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

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

    const [workLocations, jobRoles, jobLevels, taxStatus, contractTypes, departments] = await Promise.all([
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
    ])
    return { workLocations, jobRoles, jobLevels, taxStatus, contractTypes, departments }
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
}
