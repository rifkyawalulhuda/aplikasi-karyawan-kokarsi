import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsInt, IsDateString, IsOptional, IsEnum } from 'class-validator'
import { ContractStatus } from '@prisma/client'

export class CreateContractDto {
  @IsInt() employeeId: number
  @IsString() contractNo: string
  @IsDateString() startDate: string
  @IsDateString() endDate: string
  @IsOptional() @IsString() contractType?: string
  @IsOptional() @IsEnum(ContractStatus) status?: ContractStatus
  @IsOptional() @IsString() documentUrl?: string
}

export class UpdateContractDto extends CreateContractDto {}

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  private static readonly DAY_MS = 24 * 60 * 60 * 1000

  private include = {
    employee: { select: { id: true, employeeNo: true, fullName: true } },
  }

  private startOfDay(date: Date) {
    const value = new Date(date)
    value.setHours(0, 0, 0, 0)
    return value
  }

  private resolveStatus(contract: { endDate: Date; status?: ContractStatus }, now = new Date()): ContractStatus {
    if (contract.status === 'DIBATALKAN') return 'DIBATALKAN'

    const today = this.startOfDay(now).getTime()
    const end = this.startOfDay(contract.endDate).getTime()

    if (end < today) return 'EXPIRED'

    const daysLeft = Math.ceil((end - today) / ContractsService.DAY_MS)
    return daysLeft <= 30 ? 'AKAN_HABIS' : 'AKTIF'
  }

  private withComputedStatus<T extends { endDate: Date; status: ContractStatus }>(contract: T) {
    return {
      ...contract,
      status: this.resolveStatus(contract),
    }
  }

  private withComputedStatuses<T extends { endDate: Date; status: ContractStatus }>(contracts: T[]) {
    return contracts.map(contract => this.withComputedStatus(contract))
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
    const contract = await this.prisma.contract.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
      include: this.include,
    })
    return this.withComputedStatus(contract)
  }

  async update(id: number, dto: UpdateContractDto) {
    await this.findOne(id)
    const contract = await this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
      include: this.include,
    })
    return this.withComputedStatus(contract)
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.contract.delete({ where: { id } })
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
}
