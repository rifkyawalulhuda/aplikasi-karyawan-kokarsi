import type { InjectionKey, Ref } from 'vue'
import type { OrgNode } from '~/types/org-structure'

export interface OrgChartContext {
  canManage: boolean
  collapsed: Set<number>
  dragId: Ref<number | null>
  dropTargetId: Ref<number | null>
  /** Seluruh node periode aktif — dipakai untuk pencarian drop target (touch). */
  allNodes: OrgNode[]
  /** Timestamp drop terakhir — untuk mencegah klik ikut terpicu setelah drag (touch). */
  lastDragAt: number
  canDrop: (dragId: number, targetId: number) => boolean
  onDragStart: (node: OrgNode) => void
  onDragEnd: () => void
  onDropOn: (target: OrgNode) => void
  toggle: (id: number) => void
  select: (node: OrgNode) => void
  addChild: (node: OrgNode) => void
  edit: (node: OrgNode) => void
  remove: (node: OrgNode) => void
}

export const orgChartKey: InjectionKey<OrgChartContext> = Symbol('orgChart')
