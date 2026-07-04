import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsEnum, IsEmail, IsOptional, IsInt, IsDateString } from 'class-validator'
import { EmploymentStatus, Gender, EducationLevel, TerminationType } from '@prisma/client'
import { resolveContractStatus, resolveEmploymentStatus } from './employment-status'

export class CreateEmployeeDto {
  @IsString() employeeNo: string
  @IsString() fullName: string
  @IsOptional() @IsString() nik?: string
  @IsOptional() @IsString() birthPlace?: string
  @IsEnum(Gender) gender: Gender
  @IsDateString() birthDate: string
  @IsDateString() joinDate: string
  @IsEmail() email: string
  @IsOptional() @IsString() phoneNumber?: string
  @IsOptional() @IsString() address?: string
  @IsEnum(EducationLevel) educationLevel: EducationLevel
  @IsInt() workLocationId: number
  @IsInt() jobRoleId: number
  @IsInt() jobLevelId: number
  @IsInt() taxStatusId: number
  @IsInt() departmentId: number
  @IsOptional() @IsString() fotoKaryawan?: string
}

export class UpdateEmployeeDto extends CreateEmployeeDto {}

export class OffboardingDto {
  @IsEnum(TerminationType) terminationType: TerminationType
  @IsDateString() terminationDate: string
  @IsOptional() @IsString() reason?: string
}

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private include = {
    workLocation: true,
    jobRole: true,
    jobLevel: true,
    taxStatus: true,
    department: true,
    offboarding: true,
  }

  private mapContractsWithComputedStatus<T extends { status: any; startDate: Date; endDate: Date }>(
    employeeStatus: EmploymentStatus,
    contracts: T[],
  ) {
    return contracts.map(contract => ({
      ...contract,
      status: resolveContractStatus(contract, employeeStatus),
    }))
  }

  private mapEmployee<T extends { contracts?: any[]; offboarding?: any | null; employmentStatus: EmploymentStatus }>(employee: T) {
    const contracts = Array.isArray(employee.contracts) ? employee.contracts : []
    const employmentStatus = Array.isArray(employee.contracts)
      ? resolveEmploymentStatus(contracts, employee.offboarding)
      : employee.employmentStatus

    return {
      ...employee,
      employmentStatus,
      contracts: contracts.length ? this.mapContractsWithComputedStatus(employmentStatus, contracts) : undefined,
    }
  }

  private async recomputeEmployeeStatus(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        contracts: true,
        offboarding: true,
      },
    })

    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan')

    const nextStatus = resolveEmploymentStatus(employee.contracts, employee.offboarding)

    if (employee.employmentStatus !== nextStatus) {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: nextStatus },
      })
    }

    return nextStatus
  }

  async findAll(params: {
    page?: number
    limit?: number
    search?: string
    employmentStatus?: string
    includeContracts?: boolean
  }) {
    const { page = 1, limit = 10, search, employmentStatus, includeContracts = false } = params
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeNo: { contains: search, mode: 'insensitive' } },
        { nik: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (employmentStatus) where.employmentStatus = employmentStatus

    const [rawData, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: includeContracts
          ? {
              ...this.include,
              contracts: {
                orderBy: { startDate: 'desc' },
                include: { contractType: true },
              },
            }
          : this.include,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ])

    const data = rawData.map(employee => this.mapEmployee(employee))

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        ...this.include,
        contracts: {
          orderBy: { startDate: 'desc' },
          include: {
            contractType: true,
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
        },
      },
    })
    if (!emp) throw new NotFoundException('Karyawan tidak ditemukan')
    return this.mapEmployee(emp)
  }

  async create(dto: CreateEmployeeDto) {
    const employee = await this.prisma.employee.create({
      data: {
        ...dto,
        employmentStatus: 'KONTRAK_EXPIRED',
        birthDate: new Date(dto.birthDate),
        joinDate: new Date(dto.joinDate),
      },
      include: this.include,
    })
    return this.findOne(employee.id)
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id)
    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        birthDate: new Date(dto.birthDate),
        joinDate: new Date(dto.joinDate),
      },
      include: this.include,
    })
    await this.recomputeEmployeeStatus(id)
    return this.findOne(employee.id)
  }

  async updatePhoto(id: number, fotoKaryawan: string) {
    await this.findOne(id)
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { fotoKaryawan },
      include: this.include,
    })
    return this.mapEmployee(employee)
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.employee.delete({ where: { id } })
  }

  async offboard(id: number, dto: OffboardingDto, actor: { sub: number; fullName?: string; role?: string; kind?: string }) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        contracts: true,
        offboarding: true,
      },
    })

    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan')

    const oldStatus = resolveEmploymentStatus(employee.contracts, employee.offboarding)
    const nextStatus: EmploymentStatus = dto.terminationType

    await this.prisma.client.$transaction(async (tx) => {
      await tx.employeeOffboarding.upsert({
        where: { employeeId: id },
        update: {
          terminationType: dto.terminationType,
          terminationDate: new Date(dto.terminationDate),
          reason: dto.reason,
          processedById: actor.sub,
          processedByName: actor.fullName ?? 'System',
          processedByRole: actor.role ?? 'UNKNOWN',
          processedByKind: actor.kind ?? 'unknown',
        },
        create: {
          employeeId: id,
          terminationType: dto.terminationType,
          terminationDate: new Date(dto.terminationDate),
          reason: dto.reason,
          processedById: actor.sub,
          processedByName: actor.fullName ?? 'System',
          processedByRole: actor.role ?? 'UNKNOWN',
          processedByKind: actor.kind ?? 'unknown',
        },
      })

      await tx.employee.update({
        where: { id },
        data: { employmentStatus: nextStatus },
      })

      await tx.contract.updateMany({
        where: {
          employeeId: id,
          status: { in: ['AKTIF', 'AKAN_HABIS'] },
        },
        data: {
          status: 'SELESAI',
          endDate: new Date(dto.terminationDate),
        },
      })

      await tx.employeeStatusHistory.create({
        data: {
          employeeId: id,
          oldStatus,
          newStatus: nextStatus,
          changedById: actor.sub,
          changedByName: actor.fullName ?? 'System',
          changedByRole: actor.role ?? 'UNKNOWN',
          notes: dto.reason,
        },
      })
    })

    return this.findOne(id)
  }

  async getDashboardStats() {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [total, aktif, kontrakExpired, resign, phk, expiringContracts, locations, levels] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { employmentStatus: 'AKTIF' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'KONTRAK_EXPIRED' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'RESIGN' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'PHK' } }),
      this.prisma.contract.count({
        where: {
          endDate: { gte: now, lte: in30Days },
          status: { notIn: ['DIBATALKAN', 'SELESAI'] },
        }
      }),
      this.prisma.workLocation.findMany({
        select: {
          name: true,
          _count: { select: { employees: true } }
        }
      }),
      this.prisma.jobLevel.findMany({
        select: {
          name: true,
          _count: { select: { employees: true } }
        }
      }),
    ])

    const byLocation = locations
      .map(l => ({ name: l.name, count: l._count.employees }))
      .filter(l => l.count > 0)

    const byLevel = levels
      .map(l => ({ name: l.name, count: l._count.employees }))
      .filter(l => l.count > 0)

    return { total, aktif, kontrakExpired, resign, phk, expiringContracts, byLocation, byLevel }
  }
}
