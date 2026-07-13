import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  IsString, IsInt, IsOptional, IsNotEmpty, IsBoolean, IsDateString, IsEnum,
} from 'class-validator'
import { deleteUploadedFile } from '../shared/file-cleanup.util'
import { LegalKoperasiCategory, LegalKoperasiStatus } from '@prisma/client'
import { DAY_MS, startOfDay } from '../shared/date-utils'

export class CreateLegalKoperasiDto {
  @IsEnum(LegalKoperasiCategory) category: LegalKoperasiCategory
  @IsString() @IsNotEmpty() documentName: string
  @IsString() @IsNotEmpty() documentNumber: string
  @IsString() @IsNotEmpty() publisher: string
  @IsDateString() documentDate: string
  @IsBoolean() needsRenewal: boolean
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
  @IsOptional() @IsString() location?: string
  @IsOptional() @IsString() notes?: string
}

@Injectable()
export class LegalKoperasiService {
  constructor(private prisma: PrismaService) {}

  private include = {
    renewedFrom: {
      select: { id: true, documentName: true, documentNumber: true, fileUrl: true, documentDate: true },
    },
    renewedTo: {
      select: { id: true, documentName: true, documentNumber: true, status: true, documentDate: true },
    },
  }

  private computeStatus(
    needsRenewal: boolean,
    endDate: Date | null,
  ): LegalKoperasiStatus {
    if (!needsRenewal || !endDate) return 'TIDAK_AKTIF'
    const today = startOfDay(new Date()).getTime()
    const end = startOfDay(endDate).getTime()
    const daysLeft = Math.ceil((end - today) / DAY_MS)
    if (daysLeft < 0) return 'EXPIRED'
    if (daysLeft <= 30) return 'AKAN_BERAKHIR'
    return 'AKTIF'
  }

  async findAll(params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    category?: string
  }) {
    const { page = 1, limit = 10, search, status, category } = params
    const where: any = {}
    if (category) where.category = category
    if (status) where.status = status
    if (search) {
      where.OR = [
        { documentName: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { publisher: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.legalKoperasi.findMany({
        where,
        include: this.include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.legalKoperasi.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const doc = await this.prisma.legalKoperasi.findUnique({
      where: { id },
      include: this.include,
    })
    if (!doc) throw new NotFoundException('Dokumen legal tidak ditemukan')
    return doc
  }

  async create(dto: CreateLegalKoperasiDto) {
    const status = this.computeStatus(
      dto.needsRenewal,
      dto.endDate ? new Date(dto.endDate) : null,
    )
    return this.prisma.legalKoperasi.create({
      data: {
        category: dto.category,
        documentName: dto.documentName,
        documentNumber: dto.documentNumber,
        publisher: dto.publisher,
        documentDate: new Date(dto.documentDate),
        needsRenewal: dto.needsRenewal,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        location: dto.location,
        notes: dto.notes,
        status,
      },
      include: this.include,
    })
  }

  async update(id: number, dto: CreateLegalKoperasiDto) {
    await this.findOne(id)
    const status = this.computeStatus(
      dto.needsRenewal,
      dto.endDate ? new Date(dto.endDate) : null,
    )
    return this.prisma.legalKoperasi.update({
      where: { id },
      data: {
        category: dto.category,
        documentName: dto.documentName,
        documentNumber: dto.documentNumber,
        publisher: dto.publisher,
        documentDate: new Date(dto.documentDate),
        needsRenewal: dto.needsRenewal,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        location: dto.location ?? null,
        notes: dto.notes ?? null,
        status,
      },
      include: this.include,
    })
  }

  async remove(id: number) {
    const doc = await this.findOne(id)
    deleteUploadedFile(doc.fileUrl)
    return this.prisma.legalKoperasi.delete({ where: { id } })
  }

  async updateFileUrl(id: number, fileUrl: string) {
    await this.findOne(id)
    return this.prisma.legalKoperasi.update({
      where: { id },
      data: { fileUrl },
      include: this.include,
    })
  }

  async renewLegal(id: number, dto: CreateLegalKoperasiDto) {
    const existing = await this.findOne(id)

    if ((existing as any).renewedTo) {
      throw new ConflictException('Dokumen ini sudah pernah diperpanjang')
    }

    const status = this.computeStatus(
      dto.needsRenewal,
      dto.endDate ? new Date(dto.endDate) : null,
    )

    return this.prisma.legalKoperasi.create({
      data: {
        category: dto.category,
        documentName: dto.documentName,
        documentNumber: dto.documentNumber,
        publisher: dto.publisher,
        documentDate: new Date(dto.documentDate),
        needsRenewal: dto.needsRenewal,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        renewedFromId: id,
        location: dto.location,
        notes: dto.notes,
        status,
      },
      include: this.include,
    })
  }

  async syncExpiredStatuses() {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * DAY_MS)

    const akanBerakhir = await this.prisma.legalKoperasi.findMany({
      where: {
        needsRenewal: true,
        endDate: { gte: now, lte: in30Days },
        status: { not: 'AKAN_BERAKHIR' },
      },
      select: { id: true, documentName: true, publisher: true, endDate: true },
    })

    if (akanBerakhir.length > 0) {
      await this.prisma.legalKoperasi.updateMany({
        where: { id: { in: akanBerakhir.map(d => d.id) } },
        data: { status: 'AKAN_BERAKHIR' },
      })
    }

    const expired = await this.prisma.legalKoperasi.findMany({
      where: {
        needsRenewal: true,
        endDate: { lt: now },
        status: { not: 'EXPIRED' },
      },
      select: { id: true, documentName: true, publisher: true, endDate: true },
    })

    if (expired.length > 0) {
      await this.prisma.legalKoperasi.updateMany({
        where: { id: { in: expired.map(d => d.id) } },
        data: { status: 'EXPIRED' },
      })
    }

    return {
      akanBerakhir: akanBerakhir.map(d => ({ ...d, newStatus: 'AKAN_BERAKHIR' as LegalKoperasiStatus })),
      expired: expired.map(d => ({ ...d, newStatus: 'EXPIRED' as LegalKoperasiStatus })),
    }
  }
}
