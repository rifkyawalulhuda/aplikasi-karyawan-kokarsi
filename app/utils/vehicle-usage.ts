export interface OperationalVehicleUsage {
  id: number
  usedAt: string
  vehicleNumber: string
  driver: string
  destination: string
  user: string
  requester: string
  status: 'BATAL' | null
  cancelledAt?: string | null
  cancelledByName?: string | null
  cancelledByRole?: string | null
  createdByName?: string | null
  createdByRole?: string | null
}

export interface VehicleMeta {
  /** Nama pendek kendaraan, mis. "Xenia". */
  name: string
  /** Nomor polisi tanpa kode wilayah, mis. "2845 FON". */
  plate: string
  icon: string
  /** Kelas chip (latar + teks + ring). */
  chipClass: string
  /** Kelas titik/aksen. */
  dotClass: string
}

const FALLBACK_META: VehicleMeta = {
  name: 'Kendaraan',
  plate: '',
  icon: 'i-lucide-car-front',
  chipClass: 'bg-elevated text-toned ring-default',
  dotClass: 'bg-muted'
}

const VEHICLE_META: Record<string, VehicleMeta> = {
  'Xenia B 2845 FON': {
    name: 'Xenia',
    plate: 'B 2845 FON',
    icon: 'i-lucide-car-front',
    chipClass: 'bg-primary/10 text-primary ring-primary/20',
    dotClass: 'bg-primary'
  },
  'Grand max B 9043 FCM': {
    name: 'Grand Max',
    plate: 'B 9043 FCM',
    icon: 'i-lucide-truck',
    chipClass: 'bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-400',
    dotClass: 'bg-teal-500'
  }
}

/** Metadata tampilan untuk sebuah nomor polisi (chip/ikon/warna). */
export function vehicleMeta(vehicleNumber?: string | null): VehicleMeta {
  if (!vehicleNumber) return FALLBACK_META
  return VEHICLE_META[vehicleNumber] ?? {
    ...FALLBACK_META,
    name: vehicleNumber,
    plate: ''
  }
}

const TZ = 'Asia/Jakarta'

function jakartaParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value))
  return Object.fromEntries(parts.map(part => [part.type, part.value])) as Record<string, string>
}

/** Kunci tanggal (YYYY-MM-DD) menurut zona Asia/Jakarta. */
export function jakartaDateKey(value: string | Date): string {
  const parts = jakartaParts(value)
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Tambah/kurangi hari pada kunci tanggal (YYYY-MM-DD). */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Jam:menit WIB. */
export function formatTimeWib(value?: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(value))
}

/** Tanggal + jam WIB, mis. "08/10/2026 09:30". */
export function formatDateTimeWib(value?: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(value)).replace(',', '')
}

export interface UsageDayGroup {
  key: string
  label: string
  isToday: boolean
  items: OperationalVehicleUsage[]
  cancelled: number
}

/** Label hari manusiawi: "Hari Ini", "Kemarin", atau "Sabtu, 8 Okt 2026". */
function dayLabel(key: string, todayKey: string): { label: string, isToday: boolean } {
  if (key === todayKey) return { label: 'Hari Ini', isToday: true }
  if (key === addDaysToKey(todayKey, -1)) return { label: 'Kemarin', isToday: false }

  const [year, month, day] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(Date.UTC(year!, month! - 1, day!)))
  return { label, isToday: false }
}

/**
 * Kelompokkan catatan per hari (WIB). Urutan grup mengikuti urutan input,
 * sehingga pemanggil tinggal mengirim daftar yang sudah terurut.
 */
export function groupUsagesByDay(
  items: OperationalVehicleUsage[],
  now: Date = new Date()
): UsageDayGroup[] {
  const todayKey = jakartaDateKey(now)
  const groups: UsageDayGroup[] = []

  for (const item of items) {
    const key = jakartaDateKey(item.usedAt)
    let group = groups.find(existing => existing.key === key)
    if (!group) {
      const { label, isToday } = dayLabel(key, todayKey)
      group = { key, label, isToday, items: [], cancelled: 0 }
      groups.push(group)
    }
    group.items.push(item)
    if (item.status === 'BATAL') group.cancelled += 1
  }

  return groups
}

export interface UsageStats {
  total: number
  scheduled: number
  cancelled: number
  vehicles: number
}

/** Ringkasan KPI dari daftar (biasanya yang sudah terfilter). */
export function usageStats(items: OperationalVehicleUsage[]): UsageStats {
  let cancelled = 0
  const vehicles = new Set<string>()
  for (const item of items) {
    if (item.status === 'BATAL') cancelled += 1
    vehicles.add(item.vehicleNumber)
  }
  return {
    total: items.length,
    scheduled: items.length - cancelled,
    cancelled,
    vehicles: vehicles.size
  }
}

export type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom'

export interface DateRange {
  start: string
  end: string
}

/** Rentang tanggal (kunci WIB) untuk sebuah preset. `null` = tanpa batas. */
export function presetRange(preset: DatePreset, now: Date = new Date()): DateRange | null {
  const todayKey = jakartaDateKey(now)
  switch (preset) {
    case 'today':
      return { start: todayKey, end: todayKey }
    case '7d':
      return { start: addDaysToKey(todayKey, -6), end: todayKey }
    case '30d':
      return { start: addDaysToKey(todayKey, -29), end: todayKey }
    default:
      return null
  }
}
