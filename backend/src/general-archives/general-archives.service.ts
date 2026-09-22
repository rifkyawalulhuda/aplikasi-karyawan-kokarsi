import { Injectable, NotFoundException } from '@nestjs/common'
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { DashboardCacheService } from '../shared/dashboard-cache.service'
import { deleteUploadedFile } from '../shared/file-cleanup.util'
import { PrismaService } from '../prisma/prisma.service'

export class CreateGeneralArchiveDto {
  @IsString() @IsNotEmpty() @MaxLength(255) documentName: string
  @IsOptional() @IsString() @MaxLength(100) documentNumber?: string
  @IsOptional() @IsDateString() createdDate?: string
  @IsOptional() @IsDateString() expiryDate?: string
  @IsOptional() @IsString() notes?: string
}

@Injectable()
export class GeneralArchivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly dashboardCache: DashboardCacheService,
  ) {}

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 15, search } = params
    const where: any = {}
    if (search) {
      where.OR = [
        { documentName: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.generalArchive.findMany({ where, orderBy: [{ createdDate: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.generalArchive.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const archive = await this.prisma.generalArchive.findUnique({ where: { id } })
    if (!archive) throw new NotFoundException('Arsip umum tidak ditemukan')
    return archive
  }

  async create(dto: CreateGeneralArchiveDto, actor: { name: string; role: string }) {
    const archive = await this.prisma.generalArchive.create({
      data: {
        documentName: dto.documentName.trim(),
        documentNumber: dto.documentNumber?.trim() || null,
        createdDate: dto.createdDate ? new Date(dto.createdDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        notes: dto.notes?.trim() || null,
      },
    })
    void this.activityLog.log({ action: 'CREATE', module: 'Arsip Umum', targetLabel: archive.documentName, performedBy: actor.name, performedByRole: actor.role, detail: `Nomor: ${archive.documentNumber ?? '-'}` })
    return archive
  }

  async update(id: number, dto: CreateGeneralArchiveDto, actor: { name: string; role: string }) {
    await this.findOne(id)
    const archive = await this.prisma.generalArchive.update({
      where: { id },
      data: {
        documentName: dto.documentName.trim(),
        documentNumber: dto.documentNumber?.trim() || null,
        createdDate: dto.createdDate ? new Date(dto.createdDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        notes: dto.notes?.trim() || null,
      },
    })
    void this.activityLog.log({ action: 'UPDATE', module: 'Arsip Umum', targetLabel: archive.documentName, performedBy: actor.name, performedByRole: actor.role, detail: `Nomor: ${archive.documentNumber ?? '-'}` })
    return archive
  }

  async remove(id: number, actor: { name: string; role: string }) {
    const archive = await this.findOne(id)
    deleteUploadedFile(archive.fileUrl)
    const deleted = await this.prisma.generalArchive.delete({ where: { id } })
    void this.activityLog.log({ action: 'DELETE', module: 'Arsip Umum', targetLabel: archive.documentName, performedBy: actor.name, performedByRole: actor.role, detail: `Nomor: ${archive.documentNumber ?? '-'}` })
    return deleted
  }

  async updateFileUrl(id: number, fileUrl: string) {
    const existing = await this.findOne(id)
    const updated = await this.prisma.generalArchive.update({ where: { id }, data: { fileUrl } })
    if (existing.fileUrl && existing.fileUrl !== fileUrl) deleteUploadedFile(existing.fileUrl)
    this.dashboardCache.invalidate()
    return updated
  }
}
