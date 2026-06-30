import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsEnum, IsEmail, IsOptional, IsInt, IsDateString } from 'class-validator'
import { EmploymentStatus, Gender, EducationLevel } from '@prisma/client'

export class CreateEmployeeDto {
  @IsString() employeeNo: string
  @IsString() fullName: string
  @IsEnum(EmploymentStatus) employmentStatus: EmploymentStatus
  @IsEnum(Gender) gender: Gender
  @IsDateString() birthDate: string
  @IsDateString() joinDate: string
  @IsEmail() email: string
  @IsOptional() @IsString() phoneNumber?: string
  @IsEnum(EducationLevel) educationLevel: EducationLevel
  @IsInt() workLocationId: number
  @IsInt() jobRoleId: number
  @IsInt() jobLevelId: number
  @IsInt() taxStatusId: number
  @IsOptional() @IsString() fotoKaryawan?: string
}

export class UpdateEmployeeDto extends CreateEmployeeDto {}

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private include = {
    workLocation: true,
    jobRole: true,
    jobLevel: true,
    taxStatus: true,
  }

  async findAll(params: {
    page?: number
    limit?: number
    search?: string
    employmentStatus?: string
  }) {
    const { page = 1, limit = 10, search, employmentStatus } = params
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (employmentStatus) where.employmentStatus = employmentStatus

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: this.include,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: { ...this.include, contracts: { orderBy: { startDate: 'desc' } } },
    })
    if (!emp) throw new NotFoundException('Karyawan tidak ditemukan')
    return emp
  }

  async create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        ...dto,
        birthDate: new Date(dto.birthDate),
        joinDate: new Date(dto.joinDate),
      },
      include: this.include,
    })
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id)
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        birthDate: new Date(dto.birthDate),
        joinDate: new Date(dto.joinDate),
      },
      include: this.include,
    })
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.employee.delete({ where: { id } })
  }

  async getDashboardStats() {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [total, mitra, kontrak, expiringContracts, locations, levels] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { employmentStatus: 'MITRA' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'KONTRAK' } }),
      this.prisma.contract.count({
        where: { endDate: { gte: now, lte: in30Days } }
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

    return { total, mitra, kontrak, expiringContracts, byLocation, byLevel }
  }
}
