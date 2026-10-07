export interface ExpiringItem {
  id: number
  label: string
  suffix: string
  endDate: string | null
}

export interface VehicleUsageItem {
  id: number
  usedAt: string
  vehicleNumber: string
  driver: string
  destination: string
  status: 'BATAL' | null
}

export interface VehicleUsagePeriod {
  total: number
  active: number
  cancelled: number
  items: VehicleUsageItem[]
}

export interface ExpiringSoonGroup {
  count: number
  items: ExpiringItem[]
}

/** Satu irisan untuk donut / split bar. */
export interface DashboardChartDatum {
  label: string
  value: number
  color: string
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

export interface DashboardStats {
  total: number
  aktif: number
  kontrakExpired: number
  resign: number
  phk: number
  expiringContracts: number
  byLocation: { name: string, count: number }[]
  byLevel: { name: string, count: number }[]
  bySp: { sp1: number, sp2: number, sp3: number }
  byContractFamily: { mitra: number, pkwt: number }
  byGender: { male: number, female: number }
  byEducation: { sma: number, d3: number, s1: number, s2: number }
  byDepartment: { name: string, count: number }[]
  recruitmentTrend: { year: number, count: number }[]
  offboardingTrend: { year: number, resign: number, phk: number }[]
  vehicleUsage: {
    today: VehicleUsagePeriod
    nextSevenDays: VehicleUsagePeriod
    vehicleCounts: { vehicleNumber: string, count: number }[]
  }
  expiringSoon: {
    contracts: ExpiringSoonGroup
    vendorContracts: ExpiringSoonGroup
    legalKoperasi: ExpiringSoonGroup
    certifications: ExpiringSoonGroup
    activeWarnings: number
  }
}
