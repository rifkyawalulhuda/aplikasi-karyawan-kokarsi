import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  IsString, IsInt, IsOptional, IsNotEmpty, IsBoolean, IsDateString, IsEnum,
} from 'class-validator'
import { deleteUploadedFile } from '../shared/file-cleanup.util'
import { VendorContractCategory, VendorContractStatus, VendorDocType } from '@prisma/client'
import { DAY_MS, startOfDay } from '../shared/date-utils'

export class CreateVendorContractDto {
  @IsEnum(VendorContractCategory) category: VendorContractCategory
  @IsInt() companyId: number
  @IsString() @IsNotEmpty() documentName: string
  @IsString() @IsNotEmpty() documentNumber: string
  @IsEnum(VendorDocType) documentType: VendorDocType
  @IsDateString() createdDate: string
  @IsBoolean() needsRenewal: boolean
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
  @IsOptional() @IsInt() motherAgreementId?: number
  @IsOptional() @IsString() location?: string
  @IsOptional() @IsString() notes?: string
}

@Injectable()
export class VendorContractsService {
  constructor(private prisma: PrismaService) {}

  private include = {
    company: { select: { id: true, name: true } },
    motherAgreement: {
      select: { id: true, documentName: true, documentNumber: true },
    },
    renewedFrom: {
      select: { id: true, documentName: true, documentNumber: true, fileUrl: true, createdDate: true },
    },
    renewedTo: {
      select: { id: true, documentName: true, documentNumber: true, status: true, createdDate: true },
    },
  }

  private computeStatus(
    needsRenewal: boolean,
    endDate: Date | null,
  ): VendorContractStatus {
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
    category?: string
    status?: string
    companyId?: number
  }) {
    const { page = 1, limit = 10, search, category, status, companyId } = params
    const where: any = {}
    if (companyId) where.companyId = companyId
    if (category) where.category = category
    if (status) where.status = status
    if (search) {
      where.OR = [
        { documentName: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.vendorContract.findMany({
        where,
        include: {
          ...this.include,
          renewals: {
            select: { id: true, documentName: true, documentNumber: true, status: true, fileUrl: true, endDate: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorContract.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const doc = await this.prisma.vendorContract.findUnique({
      where: { id },
      include: {
        ...this.include,
        renewals: {
          select: { id: true, documentName: true, documentNumber: true, status: true, fileUrl: true, endDate: true },
        },
      },
    })
    if (!doc) throw new NotFoundException('Kontrak tidak ditemukan')
    return doc
  }

  async create(dto: CreateVendorContractDto) {
    const status = this.computeStatus(
      dto.needsRenewal,
      dto.endDate ? new Date(dto.endDate) : null,
    )
    return this.prisma.vendorContract.create({
      data: {
        category: dto.category,
        companyId: dto.companyId,
        documentName: dto.documentName,
        documentNumber: dto.documentNumber,
        documentType: dto.documentType,
        createdDate: new Date(dto.createdDate),
        needsRenewal: dto.needsRenewal,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        motherAgreementId: dto.motherAgreementId ?? undefined,
        location: dto.location,
        notes: dto.notes,
        status,
      },
      include: this.include,
    })
  }

  async update(id: number, dto: CreateVendorContractDto) {
    await this.findOne(id)
    const status = this.computeStatus(
      dto.needsRenewal,
      dto.endDate ? new Date(dto.endDate) : null,
    )
    return this.prisma.vendorContract.update({
      where: { id },
      data: {
        category: dto.category,
        companyId: dto.companyId,
        documentName: dto.documentName,
        documentNumber: dto.documentNumber,
        documentType: dto.documentType,
        createdDate: new Date(dto.createdDate),
        needsRenewal: dto.needsRenewal,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        motherAgreementId: dto.motherAgreementId ?? null,
        location: dto.location ?? null,
        notes: dto.notes ?? null,
        status,
      },
      include: this.include,
    })
  }

  async remove(id: number) {
    const contract = await this.findOne(id)
    deleteUploadedFile(contract.fileUrl)
    return this.prisma.vendorContract.delete({ where: { id } })
  }

  async updateFileUrl(id: number, fileUrl: string) {
    await this.findOne(id)
    return this.prisma.vendorContract.update({
      where: { id },
      data: { fileUrl },
      include: this.include,
    })
  }

  async findMotherAgreements(
    companyId: number,
    category: VendorContractCategory,
    excludeId?: number,
  ) {
    const where: any = { companyId, category }
    if (excludeId) where.id = { not: excludeId }
    return this.prisma.vendorContract.findMany({
      where,
      select: {
        id: true,
        documentName: true,
        documentNumber: true,
        status: true,
        createdDate: true,
      },
      orderBy: { createdDate: 'desc' },
    })
  }

  async syncExpiredStatuses() {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * DAY_MS)

    const akanBerakhir = await this.prisma.vendorContract.findMany({
      where: {
        needsRenewal: true,
        endDate: { gte: now, lte: in30Days },
        status: { not: 'AKAN_BERAKHIR' },
      },
      include: { company: { select: { name: true } } },
    })

    const expired = await this.prisma.vendorContract.findMany({
      where: {
        needsRenewal: true,
        endDate: { lt: now },
        status: { not: 'EXPIRED' },
      },
      include: { company: { select: { name: true } } },
    })

    return { akanBerakhir, expired }
  }

  async commitStatuses(akanIds: number[], expiredIds: number[]): Promise<void> {
    if (akanIds.length > 0) {
      await this.prisma.vendorContract.updateMany({
        where: { id: { in: akanIds } },
        data: { status: 'AKAN_BERAKHIR' },
      })
    }
    if (expiredIds.length > 0) {
      await this.prisma.vendorContract.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'EXPIRED' },
      })
    }
  }

  async renewContract(id: number, dto: CreateVendorContractDto) {
    const existing = await this.findOne(id)

    // Check if already renewed (renewedTo means someone already renewed this contract)
    if ((existing as any).renewedTo) {
      throw new ConflictException('Kontrak ini sudah pernah diperpanjang')
    }

    const status = this.computeStatus(
      dto.needsRenewal,
      dto.endDate ? new Date(dto.endDate) : null,
    )

    return this.prisma.vendorContract.create({
      data: {
        category: dto.category,
        companyId: dto.companyId,
        documentName: dto.documentName,
        documentNumber: dto.documentNumber,
        documentType: dto.documentType,
        createdDate: new Date(dto.createdDate),
        needsRenewal: dto.needsRenewal,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        motherAgreementId: dto.motherAgreementId ?? undefined,
        renewedFromId: id,
        location: dto.location,
        notes: dto.notes,
        status,
      },
      include: this.include,
    })
  }
}
