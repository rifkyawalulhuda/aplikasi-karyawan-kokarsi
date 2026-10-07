import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const MONTH_LABELS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

/** Kunci bulan UTC: "2026-07". */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Label bulan singkat: "Jul 2026". */
function monthLabel(d: Date): string {
  return `${MONTH_LABELS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export interface EngagementPerson {
  id: number
  fullName: string
  day: number
  month: number
  date: string
  jobRole: string | null
  workLocation: string | null
  years?: number
}

export interface EngagementActivity {
  id: number
  action: string
  module: string
  targetLabel: string
  performedBy: string
  timestamp: string
}

export interface EngagementTask {
  id: number
  title: string
  priority: string
  dueDate: string | null
  columnName: string
  spaceId: number
  spaceName: string
  spaceIcon: string | null
  spaceColor: string
}

export interface EngagementAnnouncement {
  id: number
  content: string
  createdByName: string
  createdAt: string
  spaceId: number
  spaceName: string
  spaceIcon: string | null
  spaceColor: string
}

export interface DashboardEngagement {
  month: number
  birthdays: EngagementPerson[]
  anniversaries: EngagementPerson[]
  activity: EngagementActivity[]
  tasks: EngagementTask[]
  announcements: EngagementAnnouncement[]
}

export interface MonthlyTrendPoint {
  key: string
  label: string
  recruitment: number
  resign: number
  phk: number
  vehicleUsage: number
}

export interface TrendComparison {
  current: number
  previous: number
  deltaPct: number | null
}

export interface DashboardMonthlyTrends {
  months: number
  series: MonthlyTrendPoint[]
  comparison: {
    recruitment: TrendComparison
    offboarding: TrendComparison
    vehicleUsage: TrendComparison
  }
}

/**
 * Data "engagement" untuk dashboard: ulang tahun, anniversary masa kerja,
 * feed aktivitas (khusus ADMIN), tugas Space milik user, dan pengumuman terbaru.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getEngagement(userId: number, role: string, monthInput?: number): Promise<DashboardEngagement> {
    const now = new Date()
    const month = monthInput && monthInput >= 1 && monthInput <= 12 ? monthInput : now.getUTCMonth() + 1

    const employees = await this.prisma.employee.findMany({
      where: { employmentStatus: 'AKTIF' },
      select: {
        id: true,
        fullName: true,
        birthDate: true,
        joinDate: true,
        jobRole: { select: { name: true } },
        workLocation: { select: { name: true } },
      },
    })

    const birthdays: EngagementPerson[] = []
    const anniversaries: EngagementPerson[] = []

    for (const e of employees) {
      if (e.birthDate && e.birthDate.getUTCMonth() + 1 === month) {
        birthdays.push({
          id: e.id,
          fullName: e.fullName,
          day: e.birthDate.getUTCDate(),
          month,
          date: e.birthDate.toISOString(),
          jobRole: e.jobRole?.name ?? null,
          workLocation: e.workLocation?.name ?? null,
        })
      }
      if (e.joinDate && e.joinDate.getUTCMonth() + 1 === month) {
        const years = now.getUTCFullYear() - e.joinDate.getUTCFullYear()
        if (years >= 1) {
          anniversaries.push({
            id: e.id,
            fullName: e.fullName,
            day: e.joinDate.getUTCDate(),
            month,
            date: e.joinDate.toISOString(),
            jobRole: e.jobRole?.name ?? null,
            workLocation: e.workLocation?.name ?? null,
            years,
          })
        }
      }
    }

    birthdays.sort((a, b) => a.day - b.day)
    anniversaries.sort((a, b) => a.day - b.day)

    const activity = await this.getActivity(role)
    const tasks = await this.getTasks(userId)
    const announcements = await this.getAnnouncements(userId)

    return { month, birthdays, anniversaries, activity, tasks, announcements }
  }

  /**
   * Tren bulanan + perbandingan dengan periode sebelumnya (MoM/period-over-period).
   * Metrik ber-tanggal saja (rekrutmen, offboarding, pemakaian kendaraan) —
   * headcount bersifat snapshot sehingga tidak punya riwayat.
   */
  async getMonthlyTrends(monthsInput?: number): Promise<DashboardMonthlyTrends> {
    const months = Math.min(Math.max(monthsInput ?? 12, 3), 24)
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (2 * months - 1), 1))

    const [employees, offboardings, usages] = await Promise.all([
      this.prisma.employee.findMany({
        where: { joinDate: { gte: prevStart } },
        select: { joinDate: true },
      }),
      this.prisma.employeeOffboarding.findMany({
        where: { terminationDate: { gte: prevStart } },
        select: { terminationDate: true, terminationType: true },
      }),
      this.prisma.operationalVehicleUsage.findMany({
        where: { usedAt: { gte: prevStart }, status: null },
        select: { usedAt: true },
      }),
    ])

    const buckets = new Map<string, MonthlyTrendPoint>()
    for (let i = 0; i < months * 2; i++) {
      const d = new Date(Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth() + i, 1))
      buckets.set(monthKey(d), {
        key: monthKey(d),
        label: monthLabel(d),
        recruitment: 0,
        resign: 0,
        phk: 0,
        vehicleUsage: 0,
      })
    }

    for (const e of employees) {
      const b = buckets.get(monthKey(e.joinDate))
      if (b) b.recruitment++
    }
    for (const o of offboardings) {
      const b = buckets.get(monthKey(o.terminationDate))
      if (!b) continue
      if (o.terminationType === 'RESIGN') b.resign++
      else if (o.terminationType === 'PHK') b.phk++
    }
    for (const u of usages) {
      const b = buckets.get(monthKey(u.usedAt))
      if (b) b.vehicleUsage++
    }

    const all = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
    const series = all.slice(months)
    const previous = all.slice(0, months)

    const sum = (rows: MonthlyTrendPoint[], pick: (r: MonthlyTrendPoint) => number) =>
      rows.reduce((acc, r) => acc + pick(r), 0)

    const build = (pick: (r: MonthlyTrendPoint) => number): TrendComparison => {
      const current = sum(series, pick)
      const prev = sum(previous, pick)
      return {
        current,
        previous: prev,
        deltaPct: prev > 0 ? Math.round(((current - prev) / prev) * 100) : null,
      }
    }

    return {
      months,
      series,
      comparison: {
        recruitment: build(r => r.recruitment),
        offboarding: build(r => r.resign + r.phk),
        vehicleUsage: build(r => r.vehicleUsage),
      },
    }
  }

  private async getActivity(role: string): Promise<EngagementActivity[]> {
    if (role !== 'ADMIN') return []
    const rows: any[] = await this.prisma.activityLog.findMany({
      take: 8,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true, action: true, module: true, targetLabel: true,
        performedBy: true, timestamp: true,
      },
    })
    return rows.map(a => ({
      id: a.id,
      action: a.action,
      module: a.module,
      targetLabel: a.targetLabel,
      performedBy: a.performedBy,
      timestamp: new Date(a.timestamp).toISOString(),
    }))
  }

  private async getTasks(userId: number): Promise<EngagementTask[]> {
    if (!Number.isFinite(userId)) return []
    const rows: any[] = await this.prisma.spaceCard.findMany({
      where: { assigneeIds: { has: userId } },
      take: 8,
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        column: { select: { name: true, space: { select: { id: true, name: true, icon: true, color: true } } } },
      },
    })
    return rows.map(t => ({
      id: t.id,
      title: t.title,
      priority: String(t.priority),
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      columnName: t.column?.name ?? '',
      spaceId: t.column?.space?.id ?? 0,
      spaceName: t.column?.space?.name ?? '',
      spaceIcon: t.column?.space?.icon ?? null,
      spaceColor: t.column?.space?.color ?? 'blue',
    }))
  }

  private async getAnnouncements(userId: number): Promise<EngagementAnnouncement[]> {
    if (!Number.isFinite(userId)) return []
    const rows: any[] = await this.prisma.spaceAnnouncement.findMany({
      where: { space: { memberIds: { has: userId } } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdByName: true,
        createdAt: true,
        spaceId: true,
        space: { select: { name: true, icon: true, color: true } },
      },
    })
    return rows.map(a => ({
      id: a.id,
      content: a.content,
      createdByName: a.createdByName,
      createdAt: new Date(a.createdAt).toISOString(),
      spaceId: a.spaceId,
      spaceName: a.space?.name ?? '',
      spaceIcon: a.space?.icon ?? null,
      spaceColor: a.space?.color ?? 'blue',
    }))
  }
}
