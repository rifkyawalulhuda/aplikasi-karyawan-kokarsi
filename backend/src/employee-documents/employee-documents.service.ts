import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsInt, IsDateString, IsOptional, IsNotEmpty } from 'class-validator'
import { DAY_MS, startOfDay } from '../shared/date-utils'

export class CreateEmployeeDocumentDto {
  @IsInt()
  employeeId: number

  @IsInt()
  documentTypeId: number

  @IsString()
  @IsNotEmpty()
  documentNumber: string

  @IsDateString()
  expiryDate: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class UpdateEmployeeDocumentDto extends CreateEmployeeDocumentDto {}

@Injectable()
export class EmployeeDocumentsService {
  constructor(private prisma: PrismaService) {}

  private include = {
    employee: {
      select: { id: true, employeeNo: true, fullName: true },
    },
    documentType: true,
  }

  /**
   * Hitung status dokumen berdasarkan tanggal kedaluwarsa.
   * - EXPIRED      : expiryDate sudah lewat hari ini
   * - AKAN_EXPIRED : sisa ≤ 30 hari
   * - AKTIF        : lebih dari 30 hari lagi
   */
  private computeStatus(expiryDate: Date): 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED' {
    const today = startOfDay(new Date())
    const expiry = startOfDay(expiryDate)
    const diffMs = expiry.getTime() - today.getTime()
    const diffDays = Math.floor(diffMs / DAY_MS)

    if (diffDays < 0) return 'EXPIRED'
    if (diffDays <= 30) return 'AKAN_EXPIRED'
    return 'AKTIF'
  }

  async findAll({
    page = 1,
    limit = 10,
    search,
    status,
    employeeId,
  }: {
    page?: number
    limit?: number
    search?: string
    status?: string
    employeeId?: number
  }) {
    const where: any = {}

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (search) {
      where.OR = [
        { documentNumber: { contains: search, mode: 'insensitive' as const } },
        { employee: { employeeNo: { contains: search, mode: 'insensitive' as const } } },
        { employee: { fullName: { contains: search, mode: 'insensitive' as const } } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [data, total] = await Promise.all([
      this.prisma.employeeDocument.findMany({
        where,
        include: this.include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeDocument.count({ where }),
    ])

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: number) {
    const doc = await this.prisma.employeeDocument.findUnique({
      where: { id },
      include: this.include,
    })

    if (!doc) throw new NotFoundException('Dokumen karyawan tidak ditemukan')
    return doc
  }

  async create(dto: CreateEmployeeDocumentDto) {
    const expiryDate = new Date(dto.expiryDate)
    const status = this.computeStatus(expiryDate)

    return this.prisma.employeeDocument.create({
      data: {
        employeeId: dto.employeeId,
        documentTypeId: dto.documentTypeId,
        documentNumber: dto.documentNumber,
        expiryDate,
        notes: dto.notes,
        status,
      },
      include: this.include,
    })
  }

  async update(id: number, dto: UpdateEmployeeDocumentDto) {
    await this.findOne(id)

    const expiryDate = new Date(dto.expiryDate)
    const status = this.computeStatus(expiryDate)

    return this.prisma.employeeDocument.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        documentTypeId: dto.documentTypeId,
        documentNumber: dto.documentNumber,
        expiryDate,
        notes: dto.notes,
        status,
      },
      include: this.include,
    })
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.employeeDocument.delete({ where: { id } })
  }

  async updateFileUrl(id: number, fileUrl: string) {
    await this.findOne(id)
    return this.prisma.employeeDocument.update({
      where: { id },
      data: { fileUrl },
      include: this.include,
    })
  }
}
