import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SpacesService } from './spaces.service'
import { SpaceSseService } from './space-sse.service'
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/create-announcement.dto'

@Injectable()
export class SpaceAnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private spacesService: SpacesService,
    private sse: SpaceSseService,
  ) {}

  async findAll(spaceId: number, userId: number) {
    await this.spacesService.findOne(spaceId, userId)
    return this.prisma.spaceAnnouncement.findMany({
      where: { spaceId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async create(spaceId: number, dto: CreateAnnouncementDto, userId: number, userName: string) {
    await this.spacesService.findOne(spaceId, userId)

    const ann = await this.prisma.spaceAnnouncement.create({
      data: {
        spaceId,
        content: dto.content.trim(),
        isPinned: dto.isPinned ?? true,
        createdById: userId,
        createdByName: userName,
      },
    })

    this.sse.broadcastToSpace(spaceId, {
      type: 'ANNOUNCEMENT_CREATED',
      payload: ann,
      actorId: userId,
      actorName: userName,
    })

    return ann
  }

  async update(spaceId: number, annId: number, dto: UpdateAnnouncementDto, userId: number, userName: string) {
    await this.spacesService.findOne(spaceId, userId)
    const ann = await this.prisma.spaceAnnouncement.findFirst({ where: { id: annId, spaceId } })
    if (!ann) throw new NotFoundException('Pengumuman tidak ditemukan')

    const updated = await this.prisma.spaceAnnouncement.update({
      where: { id: annId },
      data: {
        content: dto.content !== undefined ? dto.content.trim() : undefined,
        isPinned: dto.isPinned,
      },
    })

    this.sse.broadcastToSpace(spaceId, {
      type: 'ANNOUNCEMENT_UPDATED',
      payload: updated,
      actorId: userId,
      actorName: userName,
    })

    return updated
  }

  async remove(spaceId: number, annId: number, userId: number, userName: string) {
    await this.spacesService.findOne(spaceId, userId)
    const ann = await this.prisma.spaceAnnouncement.findFirst({ where: { id: annId, spaceId } })
    if (!ann) throw new NotFoundException('Pengumuman tidak ditemukan')

    await this.prisma.spaceAnnouncement.delete({ where: { id: annId } })

    this.sse.broadcastToSpace(spaceId, {
      type: 'ANNOUNCEMENT_DELETED',
      payload: { annId },
      actorId: userId,
      actorName: userName,
    })

    return { deleted: true }
  }
}
