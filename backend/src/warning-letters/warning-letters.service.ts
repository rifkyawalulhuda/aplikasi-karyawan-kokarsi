import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsInt, IsArray, IsDateString, IsNotEmpty } from 'class-validator'
import { DashboardCacheService } from '../shared/dashboard-cache.service'

export class CreateWarningLetterDto {
  @IsString()
  @IsNotEmpty()
  letterNumber: string

  @IsInt()
  employeeId: number

  @IsArray()
  @IsString({ each: true })
  violationType: string[]

  @IsInt()
  warningLevel: number

  @IsDateString()
  letterDate: string

  @IsDateString()
  validUntil: string

  @IsInt()
  processedById: number

  @IsString()
  processedByName: string
}

export class UpdateWarningLetterDto {
  @IsString()
  @IsNotEmpty()
  letterNumber?: string

  @IsInt()
  employeeId?: number

  @IsArray()
  @IsString({ each: true })
  violationType?: string[]

  @IsInt()
  warningLevel?: number

  @IsDateString()
  letterDate?: string

  @IsDateString()
  validUntil?: string

  @IsInt()
  processedById?: number

  @IsString()
  processedByName?: string
}

@Injectable()
export class WarningLettersService {
  constructor(
    private prisma: PrismaService,
    private dashboardCache: DashboardCacheService,
  ) {}

  private include = {
    employee: {
      include: {
        jobRole: { select: { id: true, name: true } },
      },
    },
  }

  /**
   * Menentukan status eskalasi Surat Peringatan untuk seorang karyawan.
   * Rule final:
   * - Tidak ada SP aktif        -> boleh SP1, SP2, atau SP3 (admin bebas memilih)
   * - Masih ada SP1 aktif       -> default SP2, SP1 dinonaktifkan, SP3 tetap boleh
   * - Masih ada SP2 aktif       -> hanya boleh SP3
   * - Masih ada SP3 aktif       -> pembuatan SP baru diblokir sampai masa SP selesai
   *
   * "Aktif" = validUntil masih >= hari ini.
   */
  async getEscalationStatus(employeeId: number) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activeLetters = await this.prisma.warningLetter.findMany({
      where: {
        employeeId,
        validUntil: { gte: today },
      },
      orderBy: { warningLevel: 'desc' },
    })

    const highestActiveLevel = activeLetters.length
      ? Math.max(...activeLetters.map(l => l.warningLevel))
      : 0

    let allowedLevels: number[] = []
    let defaultLevel: number | null = null
    let blocked = false
    let message = ''

    if (highestActiveLevel === 0) {
      allowedLevels = [1, 2, 3]
      defaultLevel = null
    } else if (highestActiveLevel === 1) {
      allowedLevels = [2, 3]
      defaultLevel = 2
    } else if (highestActiveLevel === 2) {
      allowedLevels = [3]
      defaultLevel = 3
    } else {
      allowedLevels = []
      defaultLevel = null
      blocked = true
      message = 'Karyawan masih memiliki SP3 aktif. Pembuatan surat peringatan baru diblokir sampai masa SP selesai.'
    }

    return {
      employeeId,
      highestActiveLevel,
      allowedLevels,
      defaultLevel,
      blocked,
      message,
      activeLetters: activeLetters.map(l => ({
        id: l.id,
        letterNumber: l.letterNumber,
        warningLevel: l.warningLevel,
        letterDate: l.letterDate,
        validUntil: l.validUntil,
      })),
    }
  }

  async create(dto: CreateWarningLetterDto) {
    // Enforce escalation rules server-side (source of truth)
    const status = await this.getEscalationStatus(dto.employeeId)
    if (status.blocked) {
      throw new BadRequestException(status.message)
    }
    if (!status.allowedLevels.includes(dto.warningLevel)) {
      const allowedLabel = status.allowedLevels.map(l => `SP${l}`).join(', ')
      throw new BadRequestException(
        `Level SP${dto.warningLevel} tidak diizinkan untuk karyawan ini. Level yang diizinkan: ${allowedLabel}.`,
      )
    }

    const result = await this.prisma.warningLetter.create({
      data: {
        letterNumber: dto.letterNumber,
        employeeId: dto.employeeId,
        violationType: dto.violationType,
        warningLevel: dto.warningLevel,
        letterDate: new Date(dto.letterDate),
        validUntil: new Date(dto.validUntil),
        processedById: dto.processedById,
        processedByName: dto.processedByName,
      },
      include: this.include,
    })
    this.dashboardCache.invalidate()
    return result
  }

  async findAll(page = 1, limit = 10, search?: string) {
    const where: any = search
      ? {
          OR: [
            { letterNumber: { contains: search, mode: 'insensitive' as const } },
            { employee: { fullName: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}

    const [data, total] = await Promise.all([
      this.prisma.warningLetter.findMany({
        where,
        include: this.include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warningLetter.count({ where }),
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
    const letter = await this.prisma.warningLetter.findUnique({
      where: { id },
      include: this.include,
    })

    if (!letter) throw new NotFoundException('Surat peringatan tidak ditemukan')
    return letter
  }

  async update(id: number, dto: UpdateWarningLetterDto) {
    await this.findOne(id)

    const result = await this.prisma.warningLetter.update({
      where: { id },
      data: {
        letterNumber: dto.letterNumber,
        employeeId: dto.employeeId,
        violationType: dto.violationType,
        warningLevel: dto.warningLevel,
        letterDate: dto.letterDate ? new Date(dto.letterDate) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        processedById: dto.processedById,
        processedByName: dto.processedByName,
      },
      include: this.include,
    })
    this.dashboardCache.invalidate()
    return result
  }

  async remove(id: number) {
    await this.findOne(id)
    const result = await this.prisma.warningLetter.delete({ where: { id } })
    this.dashboardCache.invalidate()
    return result
  }
}
