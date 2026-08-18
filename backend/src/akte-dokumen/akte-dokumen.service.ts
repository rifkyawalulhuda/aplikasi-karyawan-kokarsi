import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator'
import { deleteUploadedFile } from '../shared/file-cleanup.util'
import { ActivityLogService } from '../activity-log/activity-log.service'

export class CreateAkteDokumenDto {
  @IsDateString() tanggal: string
  @IsString() @IsNotEmpty() notaris: string
  @IsString() @IsNotEmpty() nomorAkte: string
  @IsString() @IsNotEmpty() judulAkte: string
  @IsOptional() @IsString() nomorSk?: string
  @IsOptional() @IsDateString() tanggalSk?: string
  @IsOptional() @IsString() keterangan?: string
}

export class UpdateAkteDokumenDto extends CreateAkteDokumenDto {}

@Injectable()
export class AkteDokumenService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 10, search } = params
    const where: any = {}
    if (search) {
      where.OR = [
        { judulAkte: { contains: search, mode: 'insensitive' } },
        { nomorAkte: { contains: search, mode: 'insensitive' } },
        { notaris: { contains: search, mode: 'insensitive' } },
        { nomorSk: { contains: search, mode: 'insensitive' } },
      ]
    }
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.akteDokumen.findMany({
        where,
        orderBy: { tanggal: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.akteDokumen.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async findOne(id: number) {
    const akte = await this.prisma.akteDokumen.findUnique({ where: { id } })
    if (!akte) throw new NotFoundException('Akte tidak ditemukan')
    return akte
  }

  async create(dto: CreateAkteDokumenDto, actor: { name: string; role: string }) {
    const akte = await this.prisma.akteDokumen.create({
      data: {
        ...dto,
        tanggal: new Date(dto.tanggal),
        tanggalSk: dto.tanggalSk ? new Date(dto.tanggalSk) : null,
      },
    })
    void this.activityLog.log({
      action: 'CREATE',
      module: 'Akte Dokumen',
      targetLabel: `${akte.judulAkte} (${akte.nomorAkte})`,
      performedBy: actor.name,
      performedByRole: actor.role,
    })
    return akte
  }

  async update(id: number, dto: UpdateAkteDokumenDto, actor: { name: string; role: string }) {
    await this.findOne(id)
    const akte = await this.prisma.akteDokumen.update({
      where: { id },
      data: {
        ...dto,
        tanggal: new Date(dto.tanggal),
        tanggalSk: dto.tanggalSk ? new Date(dto.tanggalSk) : null,
      },
    })
    void this.activityLog.log({
      action: 'UPDATE',
      module: 'Akte Dokumen',
      targetLabel: `${akte.judulAkte} (${akte.nomorAkte})`,
      performedBy: actor.name,
      performedByRole: actor.role,
    })
    return akte
  }

  async remove(id: number, actor: { name: string; role: string }) {
    const akte = await this.findOne(id)
    deleteUploadedFile(akte.fileUrl)
    const deleted = await this.prisma.akteDokumen.delete({ where: { id } })
    void this.activityLog.log({
      action: 'DELETE',
      module: 'Akte Dokumen',
      targetLabel: `${akte.judulAkte} (${akte.nomorAkte})`,
      performedBy: actor.name,
      performedByRole: actor.role,
    })
    return deleted
  }

  async updateFileUrl(id: number, fileUrl: string) {
    await this.findOne(id)
    return this.prisma.akteDokumen.update({ where: { id }, data: { fileUrl } })
  }
}
