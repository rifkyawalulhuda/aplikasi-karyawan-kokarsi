export type NotificationCategoryKey
  = | 'KONTRAK_KARYAWAN'
    | 'SERTIFIKASI_IJIN'
    | 'KONTRAK_VENDOR'
    | 'LEGAL_KOPERASI'
    | 'AGENDA'
    | 'SPACE'
    | 'ARSIP_UMUM'

export type NotificationSeverityKey = 'WARNING' | 'CRITICAL'

export interface CategoryMeta {
  label: string
  short: string
  icon: string
  color: 'primary' | 'info' | 'warning' | 'error' | 'success' | 'neutral'
}

export const NOTIFICATION_CATEGORY_ORDER: NotificationCategoryKey[] = [
  'KONTRAK_KARYAWAN',
  'SERTIFIKASI_IJIN',
  'KONTRAK_VENDOR',
  'LEGAL_KOPERASI',
  'AGENDA',
  'SPACE',
  'ARSIP_UMUM'
]

export const NOTIFICATION_CATEGORY_META: Record<NotificationCategoryKey, CategoryMeta> = {
  KONTRAK_KARYAWAN: {
    label: 'Kontrak Karyawan',
    short: 'Karyawan',
    icon: 'i-lucide-file-text',
    color: 'primary'
  },
  SERTIFIKASI_IJIN: {
    label: 'Sertifikasi & Ijin',
    short: 'Sertifikasi',
    icon: 'i-lucide-file-badge',
    color: 'info'
  },
  KONTRAK_VENDOR: {
    label: 'Kontrak Vendor',
    short: 'Vendor',
    icon: 'i-lucide-building-2',
    color: 'success'
  },
  LEGAL_KOPERASI: {
    label: 'Legal Koperasi',
    short: 'Legal',
    icon: 'i-lucide-file-signature',
    color: 'warning'
  },
  AGENDA: {
    label: 'Agenda',
    short: 'Agenda',
    icon: 'i-lucide-calendar-days',
    color: 'primary'
  },
  SPACE: {
    label: 'Space',
    short: 'Space',
    icon: 'i-lucide-kanban',
    color: 'info'
  },
  ARSIP_UMUM: {
    label: 'Arsip Umum',
    short: 'Arsip',
    icon: 'i-lucide-archive',
    color: 'neutral'
  }
}

export const NOTIFICATION_SEVERITY_META: Record<
  NotificationSeverityKey,
  { label: string, color: 'warning' | 'error', icon: string }
> = {
  WARNING: { label: 'Peringatan', color: 'warning', icon: 'i-lucide-triangle-alert' },
  CRITICAL: { label: 'Kritis', color: 'error', icon: 'i-lucide-circle-alert' }
}

export function notificationCategoryMeta(category: string): CategoryMeta {
  return (
    NOTIFICATION_CATEGORY_META[category as NotificationCategoryKey] ?? {
      label: category,
      short: category,
      icon: 'i-lucide-bell',
      color: 'neutral'
    }
  )
}

export function notificationSeverityMeta(severity: string) {
  return (
    NOTIFICATION_SEVERITY_META[severity as NotificationSeverityKey] ?? {
      label: severity,
      color: 'warning' as const,
      icon: 'i-lucide-bell'
    }
  )
}

/** Waktu relatif singkat dalam Bahasa Indonesia. */
export function notificationRelativeTime(dateStr: string, now = Date.now()): string {
  if (!dateStr) return '-'
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} bulan lalu`
  return `${Math.floor(months / 12)} tahun lalu`
}

/** Selisih hari menuju tanggal kedaluwarsa (negatif = sudah lewat). */
export function notificationDaysUntil(expiryDate: string, now = Date.now()): number | null {
  if (!expiryDate) return null
  const target = new Date(expiryDate)
  if (Number.isNaN(target.getTime())) return null
  const start = new Date(now)
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((b - a) / 86400000)
}

/** Label countdown yang ramah, mis. "5 hari lagi" / "Lewat 3 hari". */
export function notificationCountdown(expiryDate: string, now = Date.now()): string | null {
  const days = notificationDaysUntil(expiryDate, now)
  if (days === null) return null
  if (days === 0) return 'Kadaluarsa hari ini'
  if (days > 0) return `Kadaluarsa ${days} hari lagi`
  const late = Math.abs(days)
  return late === 1 ? 'Lewat 1 hari' : `Lewat ${late} hari`
}

export function notificationCountdownColor(expiryDate: string, now = Date.now()) {
  const days = notificationDaysUntil(expiryDate, now)
  if (days === null) return 'neutral' as const
  if (days <= 0) return 'error' as const
  if (days <= 7) return 'error' as const
  if (days <= 30) return 'warning' as const
  return 'neutral' as const
}

export type NotificationTimeGroup = 'Hari ini' | 'Kemarin' | '7 hari terakhir' | 'Lebih lama'

export const NOTIFICATION_TIME_GROUPS: NotificationTimeGroup[] = [
  'Hari ini',
  'Kemarin',
  '7 hari terakhir',
  'Lebih lama'
]

export function notificationTimeGroup(dateStr: string, now = new Date()): NotificationTimeGroup {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Lebih lama'

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000)

  if (date >= startOfToday) return 'Hari ini'
  if (date >= startOfYesterday) return 'Kemarin'
  if (date >= startOfWeek) return '7 hari terakhir'
  return 'Lebih lama'
}

export function notificationAbsoluteTime(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function notificationExpiryDate(expiryDate: string): string {
  if (!expiryDate) return '-'
  return new Date(expiryDate).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}
