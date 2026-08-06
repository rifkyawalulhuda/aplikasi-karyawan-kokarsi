import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateSpaceDto } from './dto/create-space.dto'
import { SpaceSseService } from './space-sse.service'

const COLUMN_TEMPLATES: Record<string, { name: string; color: string }[]> = {
  simple: [
    { name: 'Todo', color: 'gray' },
    { name: 'In Progress', color: 'blue' },
    { name: 'Done', color: 'green' },
  ],
  dev: [
    { name: 'Backlog', color: 'gray' },
    { name: 'Todo', color: 'slate' },
    { name: 'In Progress', color: 'blue' },
    { name: 'Review', color: 'yellow' },
    { name: 'Done', color: 'green' },
  ],
  bug: [
    { name: 'Reported', color: 'red' },
    { name: 'Confirmed', color: 'orange' },
    { name: 'In Fix', color: 'blue' },
    { name: 'Testing', color: 'purple' },
    { name: 'Closed', color: 'green' },
  ],
  hr: [
    { name: 'Diajukan', color: 'gray' },
    { name: 'Ditinjau', color: 'blue' },
    { name: 'Disetujui', color: 'teal' },
    { name: 'Selesai', color: 'green' },
  ],
  custom: [],
}

@Injectable()
export class SpacesService {
  constructor(
    private prisma: PrismaService,
    private sse: SpaceSseService,
  ) {}

  async findAll(userId: number) {
    const spaces = await this.prisma.space.findMany({
      where: {
        OR: [
          { createdById: userId },
          { memberIds: { has: userId } },
        ],
      } as any,
      include: {
        _count: { select: { columns: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return spaces
  }

  async findOne(id: number, userId: number) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                _count: { select: { checklists: true, comments: true, attachments: true } },
              },
            },
          },
        },
      },
    })
    if (!space) throw new NotFoundException('Space tidak ditemukan')
    this.checkAccess(space, userId)
    return space
  }

  async create(dto: CreateSpaceDto, userId: number, userName: string) {
    const template = dto.template ?? 'simple'
    const columns = COLUMN_TEMPLATES[template] ?? []

    const space = await this.prisma.space.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon ?? '📋',
        color: dto.color ?? 'blue',
        createdById: userId,
        createdByType: 'user',
        memberIds: dto.memberIds ?? [],
        memberTypes: dto.memberIds?.map(() => 'user') ?? [],
        columns: {
          create: columns.map((col, idx) => ({
            name: col.name,
            color: col.color,
            position: idx,
          })),
        },
      },
      include: { columns: { orderBy: { position: 'asc' } } },
    })
    return space
  }

  async update(id: number, data: Partial<CreateSpaceDto>, userId: number) {
    const space = await this.findOne(id, userId)
    this.checkOwner(space, userId)
    return this.prisma.space.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
      },
    })
  }

  async remove(id: number, userId: number) {
    const space = await this.findOne(id, userId)
    this.checkOwner(space, userId)
    return this.prisma.space.delete({ where: { id } })
  }

  async addMember(spaceId: number, memberId: number, userId: number) {
    const space = await this.findOne(spaceId, userId)
    this.checkOwner(space, userId)
    const memberIdInt = Number(memberId)
    if (isNaN(memberIdInt) || memberIdInt <= 0) {
      throw new Error('memberId tidak valid')
    }
    if (space.memberIds.includes(memberIdInt)) {
      throw new BadRequestException('User sudah menjadi member')
    }
    const newIds = [...space.memberIds, memberIdInt]
    const newTypes = [...space.memberTypes, 'user']
    const updated = await this.prisma.space.update({
      where: { id: spaceId },
      data: { memberIds: newIds, memberTypes: newTypes },
    })
    this.sse.broadcastToSpace(spaceId, {
      type: 'MEMBER_ADDED',
      payload: { memberId: memberIdInt },
      actorId: userId,
      actorName: '',
    })
    return updated
  }

  async removeMember(spaceId: number, memberId: number, userId: number) {
    const space = await this.findOne(spaceId, userId)
    this.checkOwner(space, userId)
    const idx = space.memberIds.indexOf(memberId)
    if (idx === -1) throw new NotFoundException('Member tidak ditemukan')
    const newIds = space.memberIds.filter(id => id !== memberId)
    const newTypes = space.memberTypes.filter((_, i) => i !== idx)
    const updated = await this.prisma.space.update({
      where: { id: spaceId },
      data: { memberIds: newIds, memberTypes: newTypes },
    })
    this.sse.broadcastToSpace(spaceId, {
      type: 'MEMBER_REMOVED',
      payload: { memberId },
      actorId: userId,
      actorName: '',
    })
    return updated
  }

  checkAccess(space: any, userId: number) {
    if (space.createdById !== userId && !space.memberIds.includes(userId)) {
      throw new ForbiddenException('Anda tidak memiliki akses ke Space ini')
    }
  }

  checkOwner(space: any, userId: number) {
    if (space.createdById !== userId) {
      throw new ForbiddenException('Hanya pembuat Space yang dapat melakukan aksi ini')
    }
  }
}
