import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SpacesService } from './spaces.service'
import { CreateDocumentDto, UpdateDocumentDto } from './dto/create-document.dto'

@Injectable()
export class SpaceDocumentsService {
  constructor(
    private prisma: PrismaService,
    private spacesService: SpacesService,
  ) {}

  async findAll(spaceId: number, userId: number) {
    await this.spacesService.findOne(spaceId, userId)
    // List tanpa content untuk efisiensi
    return this.prisma.spaceDocument.findMany({
      where: { spaceId },
      select: {
        id: true,
        spaceId: true,
        title: true,
        emoji: true,
        createdById: true,
        createdByName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findOne(spaceId: number, docId: number, userId: number) {
    await this.spacesService.findOne(spaceId, userId)
    const doc = await this.prisma.spaceDocument.findFirst({
      where: { id: docId, spaceId },
    })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan')
    return doc
  }

  async create(spaceId: number, dto: CreateDocumentDto, userId: number, userName: string) {
    await this.spacesService.findOne(spaceId, userId)
    return this.prisma.spaceDocument.create({
      data: {
        spaceId,
        title: dto.title.trim(),
        content: dto.content,
        emoji: dto.emoji ?? '📄',
        createdById: userId,
        createdByName: userName,
      },
    })
  }

  async update(spaceId: number, docId: number, dto: UpdateDocumentDto, userId: number) {
    await this.spacesService.findOne(spaceId, userId)
    const doc = await this.prisma.spaceDocument.findFirst({ where: { id: docId, spaceId } })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan')

    return this.prisma.spaceDocument.update({
      where: { id: docId },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        content: dto.content,
        emoji: dto.emoji,
      },
    })
  }

  async remove(spaceId: number, docId: number, userId: number) {
    await this.spacesService.findOne(spaceId, userId)
    const doc = await this.prisma.spaceDocument.findFirst({ where: { id: docId, spaceId } })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan')

    await this.prisma.spaceDocument.delete({ where: { id: docId } })
    return { deleted: true }
  }
}
