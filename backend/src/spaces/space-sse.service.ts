import { Injectable } from '@nestjs/common'
import { Subject, Observable } from 'rxjs'
import { finalize } from 'rxjs/operators'

export interface SpaceEvent {
  type:
    | 'CARD_CREATED' | 'CARD_UPDATED' | 'CARD_DELETED' | 'CARD_MOVED'
    | 'COLUMN_CREATED' | 'COLUMN_UPDATED' | 'COLUMN_DELETED' | 'COLUMNS_REORDERED'
    | 'COMMENT_ADDED' | 'COMMENT_UPDATED' | 'COMMENT_DELETED'
    | 'CHECKLIST_TOGGLED' | 'ATTACHMENT_ADDED' | 'ATTACHMENT_DELETED'
    | 'MEMBER_ADDED' | 'MEMBER_REMOVED'
  payload: any
  actorId: number
  actorName: string
}

@Injectable()
export class SpaceSseService {
  // Map<spaceId, Set<Subject>> — per-Space client registry
  private readonly rooms = new Map<number, Set<Subject<MessageEvent>>>()

  subscribeToSpace(spaceId: number): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>()
    if (!this.rooms.has(spaceId)) {
      this.rooms.set(spaceId, new Set())
    }
    this.rooms.get(spaceId)!.add(subject)
    return subject.asObservable().pipe(
      finalize(() => {
        const room = this.rooms.get(spaceId)
        if (room) {
          room.delete(subject)
          if (room.size === 0) this.rooms.delete(spaceId)
        }
      }),
    )
  }

  broadcastToSpace(spaceId: number, event: SpaceEvent): void {
    const room = this.rooms.get(spaceId)
    if (!room || room.size === 0) return
    const msg: MessageEvent = { data: JSON.stringify(event) } as MessageEvent
    room.forEach(s => s.next(msg))
  }

  getRoomSize(spaceId: number): number {
    return this.rooms.get(spaceId)?.size ?? 0
  }
}
