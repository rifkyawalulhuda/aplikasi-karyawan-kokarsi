import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsInt, IsDateString, IsOptional, IsEnum, IsNumber } from 'class-validator'
import { ContractStatus } from '@prisma/client'
import { resolveContractStatus, resolveEmploymentStatus } from '../employees/employment-status'

export class CreateContractDto {
  @IsInt() employeeId: number
  @IsString() contractNo: string
  @IsDateString() startDate: string
  @IsDateString() endDate: string
  @IsOptional() @IsInt() contractTypeId?: number
  @IsOptional() @IsInt() templateId?: number
  @IsOptional() @IsEnum(ContractStatus) status?: ContractStatus
  @IsOptional() @IsDateString() signedDate?: string
  @IsOptional() @IsString() positionLabel?: string
  @IsOptional() @IsString() workLocationLabel?: string
  @IsOptional() @IsNumber() baseCompensation?: number
  @IsOptional() templateData?: Record<string, any>
  @IsOptional() @IsString() documentUrl?: string
  @IsOptional() @IsInt() parentContractId?: number
}

export class UpdateContractDto extends CreateContractDto {}

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  private include = {
    employee: {
      select: {
        id: true,
        employeeNo: true,
        fullName: true,
        employmentStatus: true,
        nik: true,
        birthPlace: true,
        address: true,
      },
    },
    contractType: { select: { id: true, name: true } },
    template: {
      select: {
        id: true,
        code: true,
        name: true,
        family: true,
        templateKey: true,
        isActive: true,
      },
    },
    parentContract: {
      select: {
        id: true,
        contractNo: true,
        status: true,
      },
    },
  }

  private withComputedStatus<T extends { startDate: Date; endDate: Date; status: ContractStatus }>(contract: T) {
    const employeeStatus = (contract as any).employee?.employmentStatus
    return {
      ...contract,
      status: resolveContractStatus(contract, employeeStatus),
    }
  }

  private withComputedStatuses<T extends { startDate: Date; endDate: Date; status: ContractStatus }>(contracts: T[]) {
    return contracts.map(contract => this.withComputedStatus(contract))
  }

  private async syncEmployeeStatus(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        contracts: true,
        offboarding: true,
      },
    })

    if (!employee) return

    const employmentStatus = resolveEmploymentStatus(employee.contracts, employee.offboarding)
    if (employmentStatus !== employee.employmentStatus) {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus },
      })
    }
  }

  async findAll(params: { page?: number; limit?: number; status?: string; employeeId?: number }) {
    const { page = 1, limit = 10, status, employeeId } = params
    const where: any = {}
    if (employeeId) where.employeeId = employeeId

    const data = this.withComputedStatuses(await this.prisma.contract.findMany({
      where,
      include: this.include,
      orderBy: { startDate: 'desc' },
    }))

    const filtered = status ? data.filter(contract => contract.status === status) : data
    const total = filtered.length
    const skip = (page - 1) * limit
    const paged = filtered.slice(skip, skip + limit)

    return { data: paged, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { ...this.include, documents: true },
    })
    if (!contract) throw new NotFoundException('Kontrak tidak ditemukan')
    return this.withComputedStatus(contract)
  }

  async create(dto: CreateContractDto) {
    // Guard 1: Anti-Overlap Rule — blokir jika karyawan punya kontrak AKTIF/AKAN_HABIS
    const activeContract = await this.prisma.contract.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: ['AKTIF', 'AKAN_HABIS'] },
      },
    })
    if (activeContract) {
      throw new ConflictException('Karyawan masih memiliki kontrak aktif berjalan.')
    }

    // Guard 2: SP3 Lockout — blokir jika karyawan punya SP3 aktif
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sp3 = await this.prisma.warningLetter.findFirst({
      where: {
        employeeId: dto.employeeId,
        warningLevel: 3,
        validUntil: { gte: today },
      },
    })
    if (sp3) {
      throw new ForbiddenException(
        'Pembuatan atau perpanjangan kontrak diblokir karena status eskalasi SP3 karyawan masih aktif.',
      )
    }

    const contract = await this.prisma.contract.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
      },
      include: this.include,
    })
    await this.syncEmployeeStatus(dto.employeeId)
    return this.withComputedStatus(contract)
  }

  async update(id: number, dto: UpdateContractDto) {
    const existing = await this.findOne(id)

    // Guard 3: State Lock — blokir perubahan field kritis jika dokumen sudah ditandatangani
    if (existing.documentUrl) {
      const lockedFields = ['baseCompensation', 'startDate', 'endDate', 'employeeId'] as const
      for (const field of lockedFields) {
        const newValue = dto[field]
        const oldValue = existing[field]
        if (newValue !== undefined && newValue !== oldValue) {
          throw new BadRequestException(
            'Kontrak yang sudah ditandatangani tidak dapat diubah pada field baseCompensation, startDate, endDate, dan employeeId.',
          )
        }
      }
    }

    const contract = await this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        signedDate: dto.signedDate ? new Date(dto.signedDate) : null,
      },
      include: this.include,
    })
    await this.syncEmployeeStatus(existing.employeeId)
    if (dto.employeeId !== existing.employeeId) {
      await this.syncEmployeeStatus(dto.employeeId)
    }
    return this.withComputedStatus(contract)
  }

  async remove(id: number) {
    const contract = await this.findOne(id)
    const removed = await this.prisma.contract.delete({ where: { id } })
    await this.syncEmployeeStatus(contract.employeeId)
    return removed
  }

  async getExpiring(days: number) {
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + days)
    const contracts = await this.prisma.contract.findMany({
      where: {
        endDate: { gte: now, lte: future },
      },
      include: this.include,
      orderBy: { endDate: 'asc' },
    })
    return this.withComputedStatuses(contracts).filter(contract => contract.status === 'AKAN_HABIS')
  }

  async updateDocumentUrl(id: number, documentUrl: string) {
    await this.findOne(id)
    const contract = await this.prisma.contract.update({
      where: { id },
      data: { documentUrl },
      include: this.include,
    })
    return this.withComputedStatus(contract)
  }
}
