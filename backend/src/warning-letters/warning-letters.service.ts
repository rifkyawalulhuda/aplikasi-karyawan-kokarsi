import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsInt, IsArray, IsDateString, IsNotEmpty } from 'class-validator'

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
  constructor(private prisma: PrismaService) {}

  private include = {
    employee: {
      include: {
        jobRole: { select: { id: true, name: true } },
      },
    },
  }

  async create(dto: CreateWarningLetterDto) {
    return this.prisma.warningLetter.create({
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

    return this.prisma.warningLetter.update({
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
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.warningLetter.delete({ where: { id } })
  }
}
