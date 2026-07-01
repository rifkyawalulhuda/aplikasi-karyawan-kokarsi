import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class LookupsService {
  constructor(private prisma: PrismaService) {}

  private isMissingContractTypesTable(error: any) {
    return error?.code === 'P2021' || error?.meta?.modelName === 'ContractType'
  }

  private contractTypesMigrationError() {
    return new BadRequestException('Tabel contract_types belum tersedia. Jalankan migrasi database terlebih dahulu.')
  }

  async getAll() {
    const [workLocations, jobRoles, jobLevels, taxStatus, contractTypes] = await Promise.all([
      this.prisma.workLocation.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.jobRole.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.jobLevel.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.taxStatus.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.contractType.findMany({ orderBy: { name: 'asc' } }).catch((error) => {
        if (this.isMissingContractTypesTable(error)) return []
        throw error
      }),
    ])
    return { workLocations, jobRoles, jobLevels, taxStatus, contractTypes }
  }

  getWorkLocations() { return this.prisma.workLocation.findMany({ orderBy: { name: 'asc' } }) }
  createWorkLocation(name: string) { return this.prisma.workLocation.create({ data: { name } }) }
  updateWorkLocation(id: number, name: string) { return this.prisma.workLocation.update({ where: { id }, data: { name } }) }
  deleteWorkLocation(id: number) { return this.prisma.workLocation.delete({ where: { id } }) }

  getJobRoles() { return this.prisma.jobRole.findMany({ orderBy: { name: 'asc' } }) }
  createJobRole(name: string) { return this.prisma.jobRole.create({ data: { name } }) }
  updateJobRole(id: number, name: string) { return this.prisma.jobRole.update({ where: { id }, data: { name } }) }
  deleteJobRole(id: number) { return this.prisma.jobRole.delete({ where: { id } }) }

  getJobLevels() { return this.prisma.jobLevel.findMany({ orderBy: { name: 'asc' } }) }
  createJobLevel(name: string) { return this.prisma.jobLevel.create({ data: { name } }) }
  updateJobLevel(id: number, name: string) { return this.prisma.jobLevel.update({ where: { id }, data: { name } }) }
  deleteJobLevel(id: number) { return this.prisma.jobLevel.delete({ where: { id } }) }

  getTaxStatus() { return this.prisma.taxStatus.findMany({ orderBy: { name: 'asc' } }) }
  createTaxStatus(name: string) { return this.prisma.taxStatus.create({ data: { name } }) }
  updateTaxStatus(id: number, name: string) { return this.prisma.taxStatus.update({ where: { id }, data: { name } }) }
  deleteTaxStatus(id: number) { return this.prisma.taxStatus.delete({ where: { id } }) }

  getContractTypes() {
    return this.prisma.contractType.findMany({ orderBy: { name: 'asc' } }).catch((error) => {
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
      throw error
    })
  }
}
