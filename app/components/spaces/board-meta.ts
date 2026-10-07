import type { CardPriority, SpaceCard } from '~/types/space'

/** Kelas Tailwind untuk titik warna kolom/Space. */
export const COLOR_CLASS: Record<string, string> = {
  gray: 'bg-gray-400', blue: 'bg-blue-500', sky: 'bg-sky-500', teal: 'bg-teal-500',
  green: 'bg-green-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-red-500', pink: 'bg-pink-500', purple: 'bg-purple-500',
  indigo: 'bg-indigo-500', slate: 'bg-slate-500'
}

/** Nilai hex untuk warna solid (cover card / aksen). */
export const COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6', sky: '#0ea5e9', teal: '#14b8a6', green: '#22c55e',
  yellow: '#f59e0b', orange: '#f97316', red: '#ef4444', pink: '#ec4899',
  purple: '#a855f7', indigo: '#6366f1', gray: '#9ca3af', slate: '#64748b'
}

export function colorClass(color: string): string {
  return COLOR_CLASS[color] ?? 'bg-gray-400'
}

export function colorHex(color: string): string {
  return COLOR_HEX[color] ?? COLOR_HEX.blue!
}

export const PRIORITY_CONFIG: Record<CardPriority, {
  label: string
  icon: string
  pillClass: string
  rank: number
}> = {
  NONE: { label: '—', icon: 'i-lucide-minus', pillClass: '', rank: 4 },
  LOW: {
    label: 'Low',
    icon: 'i-lucide-arrow-down',
    pillClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    rank: 3
  },
  MEDIUM: {
    label: 'Medium',
    icon: 'i-lucide-minus',
    pillClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
    rank: 2
  },
  HIGH: {
    label: 'High',
    icon: 'i-lucide-arrow-up',
    pillClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    rank: 1
  },
  URGENT: {
    label: 'Urgent',
    icon: 'i-lucide-alert-circle',
    pillClass: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    rank: 0
  }
}

export function priorityConfig(priority: string) {
  return PRIORITY_CONFIG[priority as CardPriority] ?? PRIORITY_CONFIG.NONE!
}

const LABEL_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200'
]

export function labelColor(label: string): string {
  const idx = label.charCodeAt(0) % LABEL_COLORS.length
  return LABEL_COLORS[idx] ?? LABEL_COLORS[0]!
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/25 dark:text-orange-200',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/25 dark:text-pink-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/25 dark:text-teal-200'
]

export function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!
}

/** Inisial dua kata pertama untuk avatar. */
export function initials(name: string | undefined, fallbackId: number): string {
  if (!name) return `U${fallbackId}`
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const DAY = 86_400_000

export function isOverdue(card: Pick<SpaceCard, 'dueDate'>): boolean {
  return !!card.dueDate && new Date(card.dueDate).getTime() < Date.now()
}

/** Due dalam 2 hari ke depan (belum lewat). */
export function isDueSoon(card: Pick<SpaceCard, 'dueDate'>): boolean {
  if (!card.dueDate) return false
  const diff = (new Date(card.dueDate).getTime() - Date.now()) / DAY
  return diff >= 0 && diff <= 2
}

export function formatDateShort(date: string): string {
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

export function formatDateLong(date: string): string {
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Ambil pesan error dari respons $fetch tanpa `any`. */
export function errorMessage(err: unknown): string {
  const e = err as { data?: { message?: string }, message?: string } | null
  return e?.data?.message ?? e?.message ?? 'Terjadi kesalahan'
}
