import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateColumnDto, ReorderColumnsDto, UpdateColumnDto } from './dto/create-column.dto'
import { SpaceSseService } from './space-sse.service'
import { SpacesService } from './spaces.service'

@Injectable()
export class SpaceColumnsService {
  constructor(
    private prisma: PrismaService,
    private spacesService: SpacesService,
    private sse: SpaceSseService,
  ) {}

  async create(spaceId: number, dto: CreateColumnDto, userId: number, userName: string) {
    const space = await this.spacesService.findOne(spaceId, userId)
    this.spacesService.checkAccess(space, userId)

    const maxPos = await this.prisma.spaceColumn.aggregate({
      where: { spaceId },
      _max: { position: true },
    })
    const position = dto.position ?? (maxPos._max.position ?? -1) + 1

    const column = await this.prisma.spaceColumn.create({
      data: {
        spaceId,
        name: dto.name,
        color: dto.color ?? 'gray',
        position,
      },
    })

    this.sse.broadcastToSpace(spaceId, {
      type: 'COLUMN_CREATED',
      payload: column,
      actorId: userId,
      actorName: userName,
    })
    return column
  }

  async update(spaceId: number, columnId: number, dto: UpdateColumnDto, userId: number, userName: string) {
    await this.spacesService.findOne(spaceId, userId)
    const column = await this.prisma.spaceColumn.findFirst({ where: { id: columnId, spaceId } })
    if (!column) throw new NotFoundException('Kolom tidak ditemukan')

    const updated = await this.prisma.spaceColumn.update({
      where: { id: columnId },
      data: { name: dto.name, color: dto.color },
    })

    this.sse.broadcastToSpace(spaceId, {
      type: 'COLUMN_UPDATED',
      payload: updated,
      actorId: userId,
      actorName: userName,
    })
    return updated
  }

  async remove(spaceId: number, columnId: number, userId: number, userName: string) {
    await this.spacesService.findOne(spaceId, userId)
    const column = await this.prisma.spaceColumn.findFirst({ where: { id: columnId, spaceId } })
    if (!column) throw new NotFoundException('Kolom tidak ditemukan')

    const cardCount = await this.prisma.spaceCard.count({ where: { columnId } })
    if (cardCount > 0) throw new BadRequestException('Hapus semua card dalam kolom ini terlebih dahulu')

    await this.prisma.spaceColumn.delete({ where: { id: columnId } })

    this.sse.broadcastToSpace(spaceId, {
      type: 'COLUMN_DELETED',
      payload: { columnId },
      actorId: userId,
      actorName: userName,
    })
    return { deleted: true }
  }

  async reorder(spaceId: number, dto: ReorderColumnsDto, userId: number, userName: string) {
    await this.spacesService.findOne(spaceId, userId)

    await Promise.all(
      dto.columnIds.map((colId, idx) =>
        this.prisma.spaceColumn.update({
          where: { id: colId },
          data: { position: idx },
        }),
      ),
    )

    this.sse.broadcastToSpace(spaceId, {
      type: 'COLUMNS_REORDERED',
      payload: { columnIds: dto.columnIds },
      actorId: userId,
      actorName: userName,
    })
    return { reordered: true }
  }
}
