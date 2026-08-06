import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { startOfDay } from '../shared/date-utils'

@Injectable()
export class SpaceNotificationService {
  private readonly logger = new Logger(SpaceNotificationService.name)

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private getExpiryDate(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }

  // Dipanggil saat card di-assign ke user baru
  async notifyAssigned(spaceId: number, cardId: number, cardTitle: string, newAssigneeIds: number[], actorName: string) {
    for (const userId of newAssigneeIds) {
      try {
        await (this.notificationsService as any).prisma.notification.create({
          data: {
            category: 'SPACE',
            severity: 'WARNING',
            title: 'Card Ditugaskan',
            message: `${actorName} menugaskan card "${cardTitle}" kepada kamu`,
            sourceType: 'space_card_assign',
            sourceId: cardId,
            triggerDay: 0,
            deeplink: `/spaces/${spaceId}`,
            expiryDate: this.getExpiryDate(),
          },
        })
      } catch (e: any) {
        if (e.code !== 'P2002') this.logger.error(`notifyAssigned failed for user ${userId}: ${e.message}`)
      }
    }
    try {
      const count = await (this.notificationsService as any).prisma.notification.count({
        where: { isRead: false, resolvedAt: null },
      })
      this.notificationsService.broadcast(count)
    } catch { /* non-fatal */ }
  }

  // Dipanggil saat komentar mengandung @mention (extracted dari Tiptap JSON)
  async notifyMentions(spaceId: number, cardId: number, cardTitle: string, mentionedUserIds: number[], actorName: string, commentPreview: string) {
    for (const userId of mentionedUserIds) {
      try {
        await (this.notificationsService as any).prisma.notification.create({
          data: {
            category: 'SPACE',
            severity: 'WARNING',
            title: `${actorName} menyebut kamu`,
            message: `Di card "${cardTitle}": ${commentPreview.slice(0, 100)}`,
            sourceType: 'space_card_mention',
            sourceId: cardId,
            triggerDay: 0,
            deeplink: `/spaces/${spaceId}`,
            expiryDate: this.getExpiryDate(),
          },
        })
      } catch (e: any) {
        if (e.code !== 'P2002') this.logger.error(`notifyMentions failed for user ${userId}: ${e.message}`)
      }
    }
    try {
      const count = await (this.notificationsService as any).prisma.notification.count({
        where: { isRead: false, resolvedAt: null },
      })
      this.notificationsService.broadcast(count)
    } catch { /* non-fatal */ }
  }

  // Dipanggil saat card pindah kolom
  async notifyCardMoved(spaceId: number, cardId: number, cardTitle: string, assigneeIds: number[], toColumnName: string, actorName: string) {
    for (const userId of assigneeIds) {
      try {
        await (this.notificationsService as any).prisma.notification.create({
          data: {
            category: 'SPACE',
            severity: 'WARNING',
            title: 'Card Dipindahkan',
            message: `${actorName} memindahkan card "${cardTitle}" ke kolom "${toColumnName}"`,
            sourceType: 'space_card_moved',
            sourceId: cardId,
            triggerDay: 0,
            deeplink: `/spaces/${spaceId}`,
            expiryDate: this.getExpiryDate(),
          },
        })
      } catch (e: any) {
        if (e.code !== 'P2002') this.logger.error(`notifyCardMoved failed for user ${userId}: ${e.message}`)
      }
    }
    try {
      const count = await (this.notificationsService as any).prisma.notification.count({
        where: { isRead: false, resolvedAt: null },
      })
      this.notificationsService.broadcast(count)
    } catch { /* non-fatal */ }
  }

  // Cron harian: notifikasi due date H-1
  async notifyDueTomorrow() {
    const today = startOfDay(new Date())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const dayAfter = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)

    const cards = await this.prisma.spaceCard.findMany({
      where: {
        dueDate: { gte: tomorrow, lt: dayAfter },
        assigneeIds: { isEmpty: false },
      },
      include: {
        column: { include: { space: true } },
      },
    })

    let created = 0
    for (const card of cards) {
      for (const userId of card.assigneeIds) {
        try {
          await (this.notificationsService as any).prisma.notification.create({
            data: {
              category: 'SPACE',
              severity: 'CRITICAL',
              title: 'Card Jatuh Tempo Besok',
              message: `Card "${card.title}" di Space "${(card.column as any).space.name}" jatuh tempo besok`,
              sourceType: 'space_card_due',
              sourceId: card.id,
              triggerDay: 1,
              deeplink: `/spaces/${(card.column as any).space.id}`,
              expiryDate: card.dueDate!,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') this.logger.error(`notifyDueTomorrow failed: ${e.message}`)
        }
      }
    }

    if (created > 0) {
      try {
        const count = await (this.notificationsService as any).prisma.notification.count({
          where: { isRead: false, resolvedAt: null },
        })
        this.notificationsService.broadcast(count)
      } catch { /* non-fatal */ }
      this.logger.log(`Space due-tomorrow notifications: ${created} created`)
    }
  }

  // Helper: extract mention user IDs dari Tiptap JSON content
  static extractMentionIds(content: string): number[] {
    try {
      const json = JSON.parse(content)
      const ids: number[] = []
      function walk(node: any) {
        if (node.type === 'mention' && node.attrs?.id) {
          ids.push(Number(node.attrs.id))
        }
        if (node.content) node.content.forEach(walk)
      }
      if (json.content) json.content.forEach(walk)
      return [...new Set(ids)]
    } catch {
      return []
    }
  }

  // Helper: extract plain text preview dari Tiptap JSON
  static extractTextPreview(content: string): string {
    try {
      const json = JSON.parse(content)
      const parts: string[] = []
      function walk(node: any) {
        if (node.type === 'text') parts.push(node.text ?? '')
        if (node.type === 'mention') parts.push(`@${node.attrs?.label ?? node.attrs?.id ?? ''}`)
        if (node.content) node.content.forEach(walk)
      }
      if (json.content) json.content.forEach(walk)
      return parts.join(' ').slice(0, 150)
    } catch {
      return content.slice(0, 150)
    }
  }
}
