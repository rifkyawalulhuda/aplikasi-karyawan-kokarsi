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

  private include = {
    employee: { select: { id: true, employeeNo: true, fullName: true } },
  }

  async findAll(params: { page?: number; limit?: number; status?: string; employeeId?: number }) {
    const { page = 1, limit = 10, status, employeeId } = params
    const skip = (page - 1) * limit
    const where: any = {}
    if (status) where.status = status
    if (employeeId) where.employeeId = employeeId

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: this.include,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.contract.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { ...this.include, documents: true },
    })
    if (!contract) throw new NotFoundException('Kontrak tidak ditemukan')
    return contract
  }

  async create(dto: CreateContractDto) {
    return this.prisma.contract.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
      include: this.include,
    })
  }

  async update(id: number, dto: UpdateContractDto) {
    await this.findOne(id)
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
      include: this.include,
    })
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.contract.delete({ where: { id } })
  }

  async getExpiring(days: number) {
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + days)
    return this.prisma.contract.findMany({
      where: {
        status: 'AKTIF',
        endDate: { gte: now, lte: future },
      },
      include: this.include,
      orderBy: { endDate: 'asc' },
    })
  }
}
