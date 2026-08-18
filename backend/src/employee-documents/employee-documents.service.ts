import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsInt, IsDateString, IsOptional, IsNotEmpty } from 'class-validator'
import { DAY_MS, startOfDay } from '../shared/date-utils'
import { deleteUploadedFile } from '../shared/file-cleanup.util'
import { ActivityLogService } from '../activity-log/activity-log.service'

export class CreateEmployeeDocumentDto {
  @IsInt()
  employeeId: number

  @IsInt()
  documentTypeId: number

  @IsString()
  @IsNotEmpty()
  documentNumber: string

  @IsOptional()
  @IsDateString()
  expiryDate?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class UpdateEmployeeDocumentDto {
  @IsOptional()
  @IsInt()
  employeeId?: number

  @IsOptional()
  @IsInt()
  documentTypeId?: number

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  documentNumber?: string

  @IsOptional()
  @IsDateString()
  expiryDate?: string

  @IsOptional()
  @IsString()
  notes?: string
}

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

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
   * - AKTIF        : lebih dari 30 hari lagi (atau tidak ada tanggal)
   */
  private computeStatus(expiryDate: Date | null): 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED' {
    if (!expiryDate) return 'AKTIF'
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
    documentTypeCategory,
  }: {
    page?: number
    limit?: number
    search?: string
    status?: string
    employeeId?: number
    documentTypeCategory?: string
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

    if (documentTypeCategory) {
      where.documentType = { category: documentTypeCategory }
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

  async create(dto: CreateEmployeeDocumentDto, actor: { name: string; role: string }) {
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null
    const status = this.computeStatus(expiryDate)

    const doc = await this.prisma.employeeDocument.create({
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

    void this.activityLog.log({
      module: 'Sertifikasi & Ijin',
      action: 'CREATE',
      targetLabel: `${doc.documentType?.name ?? 'Dokumen'} (${doc.employee?.fullName ?? '-'})`,
      performedBy: actor.name,
      performedByRole: actor.role,
    })

    return doc
  }

  async update(id: number, dto: UpdateEmployeeDocumentDto, actor: { name: string; role: string }) {
    await this.findOne(id)

    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null
    const status = this.computeStatus(expiryDate)

    const doc = await this.prisma.employeeDocument.update({
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

    void this.activityLog.log({
      module: 'Sertifikasi & Ijin',
      action: 'UPDATE',
      targetLabel: `${doc.documentType?.name ?? 'Dokumen'} (${doc.employee?.fullName ?? '-'})`,
      performedBy: actor.name,
      performedByRole: actor.role,
    })

    return doc
  }

  async remove(id: number, actor: { name: string; role: string }) {
    const doc = await this.findOne(id)
    const targetLabel = `${doc.documentType?.name ?? 'Dokumen'} (${doc.employee?.fullName ?? '-'})`
    deleteUploadedFile(doc.fileUrl)
    const deleted = await this.prisma.employeeDocument.delete({ where: { id } })
    void this.activityLog.log({
      module: 'Sertifikasi & Ijin',
      action: 'DELETE',
      targetLabel,
      performedBy: actor.name,
      performedByRole: actor.role,
    })
    return deleted
  }

  async updateFileUrl(id: number, fileUrl: string) {
    await this.findOne(id)
    return this.prisma.employeeDocument.update({
      where: { id },
      data: { fileUrl },
      include: this.include,
    })
  }

  async findEmployeeSummary({
    page = 1,
    limit = 10,
    search,
  }: {
    page?: number
    limit?: number
    search?: string
  }) {
    const where: any = {}
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { employeeNo: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          ...where,
          employeeDocuments: { some: {} },
        },
        include: {
          employeeDocuments: {
            include: { documentType: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.employee.count({
        where: {
          ...where,
          employeeDocuments: { some: {} },
        },
      }),
    ])

    const data = employees.map(emp => {
      const docs = emp.employeeDocuments
      const worstStatus = docs.some(d => d.status === 'EXPIRED')
        ? 'EXPIRED'
        : docs.some(d => d.status === 'AKAN_EXPIRED')
          ? 'AKAN_EXPIRED'
          : 'AKTIF'
      return {
        employee: {
          id: emp.id,
          employeeNo: emp.employeeNo,
          fullName: emp.fullName,
          fotoKaryawan: emp.fotoKaryawan,
        },
        totalDocs: docs.length,
        worstStatus,
        documents: docs,
      }
    })

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}
