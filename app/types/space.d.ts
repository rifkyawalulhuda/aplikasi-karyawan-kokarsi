// ── Space Types ──────────────────────────────────────────────────────────────
export type CardPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type AttachmentType = 'FILE' | 'LINK'
export type SpaceEventType =
  | 'CARD_CREATED' | 'CARD_UPDATED' | 'CARD_DELETED' | 'CARD_MOVED'
  | 'COLUMN_CREATED' | 'COLUMN_UPDATED' | 'COLUMN_DELETED' | 'COLUMNS_REORDERED'
  | 'COMMENT_ADDED' | 'COMMENT_UPDATED' | 'COMMENT_DELETED'
  | 'CHECKLIST_TOGGLED' | 'ATTACHMENT_ADDED' | 'ATTACHMENT_DELETED'
  | 'MEMBER_ADDED' | 'MEMBER_REMOVED'
  | 'ANNOUNCEMENT_CREATED' | 'ANNOUNCEMENT_UPDATED' | 'ANNOUNCEMENT_DELETED'

export interface SpaceEvent {
  type: SpaceEventType
  payload: any
  actorId: number
  actorName: string
}

export interface Space {
  id: number
  name: string
  description?: string | null
  icon?: string | null
  color: string
  createdById: number
  createdByType: string
  memberIds: number[]
  memberTypes: string[]
  columns?: SpaceColumn[]
  announcements?: SpaceAnnouncement[]
  documents?: SpaceDocument[]
  _count?: { columns: number }
  createdAt: string
  updatedAt: string
}

export interface SpaceAnnouncement {
  id: number
  spaceId: number
  content: string
  isPinned: boolean
  createdById: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface SpaceDocument {
  id: number
  spaceId: number
  title: string
  content?: string
  emoji?: string | null
  createdById: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface SpaceColumn {
  id: number
  spaceId: number
  name: string
  color: string
  position: number
  cards?: SpaceCard[]
  createdAt: string
  updatedAt: string
}

export interface SpaceCard {
  id: number
  columnId: number
  title: string
  description?: string | null
  position: number
  priority: CardPriority
  dueDate?: string | null
  assigneeIds: number[]
  labels: string[]
  coverColor?: string | null
  createdById: number
  createdByType: string
  checklists?: SpaceCardChecklist[]
  attachments?: SpaceCardAttachment[]
  comments?: SpaceCardComment[]
  _count?: { checklists: number; comments: number; attachments: number }
  createdAt: string
  updatedAt: string
}

export interface SpaceCardChecklist {
  id: number
  cardId: number
  title: string
  checked: boolean
  position: number
  createdAt: string
}

export interface SpaceCardAttachment {
  id: number
  cardId: number
  type: AttachmentType
  name: string
  url: string
  mimeType?: string | null
  size?: number | null
  createdAt: string
}

export interface SpaceCardComment {
  id: number
  cardId: number
  content: string
  authorId: number
  authorType: string
  authorName: string
  authorPhotoUrl?: string | null
  isEdited?: boolean
  editedAt?: string | null
  isDeleted?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface SpaceColumn {
  id: number
  spaceId: number
  name: string
  color: string
  position: number
  cards?: SpaceCard[]
  createdAt: string
  updatedAt: string
}

export interface SpaceCard {
  id: number
  columnId: number
  title: string
  description?: string | null
  position: number
  priority: CardPriority
  dueDate?: string | null
  assigneeIds: number[]
  labels: string[]
  coverColor?: string | null
  createdById: number
  createdByType: string
  checklists?: SpaceCardChecklist[]
  attachments?: SpaceCardAttachment[]
  comments?: SpaceCardComment[]
  _count?: { checklists: number; comments: number; attachments: number }
  createdAt: string
  updatedAt: string
}

export interface SpaceCardChecklist {
  id: number
  cardId: number
  title: string
  checked: boolean
  position: number
  createdAt: string
}

export interface SpaceCardAttachment {
  id: number
  cardId: number
  type: AttachmentType
  name: string
  url: string
  mimeType?: string | null
  size?: number | null
  createdAt: string
}

export interface SpaceCardComment {
  id: number
  cardId: number
  content: string
  authorId: number
  authorType: string
  authorName: string
  authorPhotoUrl?: string | null
  isEdited?: boolean
  editedAt?: string | null
  isDeleted?: boolean
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}
