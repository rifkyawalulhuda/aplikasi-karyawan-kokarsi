import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/create-card.dto'
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto'
import { SpaceSseService } from './space-sse.service'
import { SpacesService } from './spaces.service'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'

@Injectable()
export class SpaceCardsService {
  constructor(
    private prisma: PrismaService,
    private spacesService: SpacesService,
    private sse: SpaceSseService,
  ) {}

  async create(spaceId: number, columnId: number, dto: CreateCardDto, userId: number, userName: string) {
    const space = await this.spacesService.findOne(spaceId, userId)
    this.spacesService.checkAccess(space, userId)

    const column = await this.prisma.spaceColumn.findFirst({ where: { id: columnId, spaceId } })
    if (!column) throw new NotFoundException('Kolom tidak ditemukan')

    const maxPos = await this.prisma.spaceCard.aggregate({
      where: { columnId },
      _max: { position: true },
    })
    const position = dto.position ?? (maxPos._max.position ?? -1) + 1

    const card = await this.prisma.spaceCard.create({
      data: {
        columnId,
        title: dto.title,
        description: dto.description,
        priority: (dto.priority as any) ?? 'NONE',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeIds: dto.assigneeIds ?? [],
        labels: dto.labels ?? [],
        coverColor: dto.coverColor,
        position,
        createdById: userId,
        createdByType: 'user',
      },
    })

    this.sse.broadcastToSpace(spaceId, { type: 'CARD_CREATED', payload: { ...card, columnId }, actorId: userId, actorName: userName })
    return card
  }

  async findOne(spaceId: number, cardId: number, userId: number) {
    const space = await this.spacesService.findOne(spaceId, userId)
    this.spacesService.checkAccess(space, userId)

    const card = await this.prisma.spaceCard.findFirst({
      where: { id: cardId, column: { spaceId } },
      include: {
        checklists: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!card) throw new NotFoundException('Card tidak ditemukan')
    return card
  }

  async update(spaceId: number, cardId: number, dto: UpdateCardDto, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)

    const updated = await this.prisma.spaceCard.update({
      where: { id: cardId },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority as any,
        dueDate: dto.dueDate === null ? null : dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeIds: dto.assigneeIds,
        labels: dto.labels,
        coverColor: dto.coverColor,
      },
    })

    this.sse.broadcastToSpace(spaceId, { type: 'CARD_UPDATED', payload: updated, actorId: userId, actorName: userName })
    return updated
  }

  async remove(spaceId: number, cardId: number, userId: number, userName: string) {
    const card = await this.findOne(spaceId, cardId, userId)

    // Hapus file attachment fisik
    const attachments = await this.prisma.spaceCardAttachment.findMany({ where: { cardId, type: 'FILE' } })
    for (const att of attachments) {
      const filePath = join(process.cwd(), att.url)
      if (existsSync(filePath)) {
        try { unlinkSync(filePath) } catch { /* non-fatal */ }
      }
    }

    await this.prisma.spaceCard.delete({ where: { id: cardId } })
    this.sse.broadcastToSpace(spaceId, { type: 'CARD_DELETED', payload: { cardId, columnId: card.columnId }, actorId: userId, actorName: userName })
    return { deleted: true }
  }

  async move(spaceId: number, cardId: number, dto: MoveCardDto, userId: number, userName: string) {
    const space = await this.spacesService.findOne(spaceId, userId)
    this.spacesService.checkAccess(space, userId)

    const toColumn = await this.prisma.spaceColumn.findFirst({ where: { id: dto.toColumnId, spaceId } })
    if (!toColumn) throw new NotFoundException('Kolom tujuan tidak ditemukan')

    const card = await this.prisma.spaceCard.findFirst({ where: { id: cardId, column: { spaceId } } })
    if (!card) throw new NotFoundException('Card tidak ditemukan')

    const fromColumnId = card.columnId

    // Shift position cards lain di kolom tujuan
    await this.prisma.spaceCard.updateMany({
      where: { columnId: dto.toColumnId, position: { gte: dto.position }, id: { not: cardId } },
      data: { position: { increment: 1 } },
    })

    const updated = await this.prisma.spaceCard.update({
      where: { id: cardId },
      data: { columnId: dto.toColumnId, position: dto.position },
    })

    this.sse.broadcastToSpace(spaceId, {
      type: 'CARD_MOVED',
      payload: { cardId, fromColumnId, toColumnId: dto.toColumnId, position: dto.position },
      actorId: userId,
      actorName: userName,
    })
    return updated
  }

  // ── Checklist ──────────────────────────────────────────────────────────────

  async addChecklist(spaceId: number, cardId: number, title: string, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const maxPos = await this.prisma.spaceCardChecklist.aggregate({ where: { cardId }, _max: { position: true } })
    const item = await this.prisma.spaceCardChecklist.create({
      data: { cardId, title, checked: false, position: (maxPos._max.position ?? -1) + 1 },
    })
    this.sse.broadcastToSpace(spaceId, { type: 'CHECKLIST_TOGGLED', payload: { cardId, item }, actorId: userId, actorName: userName })
    return item
  }

  async toggleChecklist(spaceId: number, cardId: number, itemId: number, checked: boolean, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const item = await this.prisma.spaceCardChecklist.update({ where: { id: itemId }, data: { checked } })
    this.sse.broadcastToSpace(spaceId, { type: 'CHECKLIST_TOGGLED', payload: { cardId, item }, actorId: userId, actorName: userName })
    return item
  }

  async removeChecklist(spaceId: number, cardId: number, itemId: number, userId: number) {
    await this.findOne(spaceId, cardId, userId)
    return this.prisma.spaceCardChecklist.delete({ where: { id: itemId } })
  }

  // ── Attachments ────────────────────────────────────────────────────────────

  async addAttachmentFile(spaceId: number, cardId: number, file: Express.Multer.File, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const url = `uploads/spaces/${file.filename}`
    const att = await this.prisma.spaceCardAttachment.create({
      data: { cardId, type: 'FILE', name: file.originalname, url, mimeType: file.mimetype, size: file.size },
    })
    this.sse.broadcastToSpace(spaceId, { type: 'ATTACHMENT_ADDED', payload: { cardId, att }, actorId: userId, actorName: userName })
    return att
  }

  async addAttachmentLink(spaceId: number, cardId: number, name: string, url: string, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const att = await this.prisma.spaceCardAttachment.create({
      data: { cardId, type: 'LINK', name, url },
    })
    this.sse.broadcastToSpace(spaceId, { type: 'ATTACHMENT_ADDED', payload: { cardId, att }, actorId: userId, actorName: userName })
    return att
  }

  async removeAttachment(spaceId: number, cardId: number, attId: number, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const att = await this.prisma.spaceCardAttachment.findFirst({ where: { id: attId, cardId } })
    if (!att) throw new NotFoundException('Attachment tidak ditemukan')

    if (att.type === 'FILE') {
      const filePath = join(process.cwd(), att.url)
      if (existsSync(filePath)) {
        try { unlinkSync(filePath) } catch { /* non-fatal */ }
      }
    }
    await this.prisma.spaceCardAttachment.delete({ where: { id: attId } })
    this.sse.broadcastToSpace(spaceId, { type: 'ATTACHMENT_DELETED', payload: { cardId, attId }, actorId: userId, actorName: userName })
    return { deleted: true }
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  async addComment(spaceId: number, cardId: number, dto: CreateCommentDto, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const comment = await this.prisma.spaceCardComment.create({
      data: { cardId, content: dto.content, authorId: userId, authorType: 'user', authorName: userName },
    })
    this.sse.broadcastToSpace(spaceId, { type: 'COMMENT_ADDED', payload: { cardId, comment }, actorId: userId, actorName: userName })
    return comment
  }

  async updateComment(spaceId: number, cardId: number, commentId: number, dto: UpdateCommentDto, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const comment = await this.prisma.spaceCardComment.findFirst({ where: { id: commentId, cardId } })
    if (!comment) throw new NotFoundException('Komentar tidak ditemukan')
    if (comment.authorId !== userId) throw new ForbiddenException('Hanya penulis yang dapat mengedit komentar')

    const updated = await this.prisma.spaceCardComment.update({ where: { id: commentId }, data: { content: dto.content } })
    this.sse.broadcastToSpace(spaceId, { type: 'COMMENT_UPDATED', payload: { cardId, comment: updated }, actorId: userId, actorName: userName })
    return updated
  }

  async removeComment(spaceId: number, cardId: number, commentId: number, userId: number, userName: string) {
    await this.findOne(spaceId, cardId, userId)
    const comment = await this.prisma.spaceCardComment.findFirst({ where: { id: commentId, cardId } })
    if (!comment) throw new NotFoundException('Komentar tidak ditemukan')
    if (comment.authorId !== userId) throw new ForbiddenException('Hanya penulis yang dapat menghapus komentar')

    await this.prisma.spaceCardComment.delete({ where: { id: commentId } })
    this.sse.broadcastToSpace(spaceId, { type: 'COMMENT_DELETED', payload: { cardId, commentId }, actorId: userId, actorName: userName })
    return { deleted: true }
  }
}
