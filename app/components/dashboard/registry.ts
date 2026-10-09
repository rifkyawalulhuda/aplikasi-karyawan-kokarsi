/**
 * Metadata widget dashboard.
 *
 * File ini SENGAJA hanya berisi metadata (tanpa import komponen `.vue`) supaya
 * bisa dipakai bersama oleh `useDashboardLayout` (urutan default) dan
 * `DashboardGrid` (peta id → komponen) tanpa membentuk impor melingkar.
 */

export type DashboardWidgetGroup = 'overview' | 'operational' | 'analytics' | 'engagement' | 'shortcut'

export interface DashboardWidgetDef {
  id: string
  title: string
  icon: string
  /** Kelas grid span untuk grid 1 / 2 / 6 kolom. */
  spanClass: string
  group: DashboardWidgetGroup
  defaultVisible: boolean
  /** Hanya tampil untuk role ADMIN (mis. feed log aktivitas). */
  adminOnly?: boolean
}

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  {
    id: 'kpi',
    title: 'Ringkasan KPI',
    icon: 'i-lucide-layout-dashboard',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'overview',
    defaultVisible: true
  },
  {
    id: 'attention',
    title: 'Perlu Perhatian',
    icon: 'i-lucide-bell-ring',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'operational',
    defaultVisible: true
  },
  {
    id: 'vehicle',
    title: 'Pemakaian Kendaraan',
    icon: 'i-lucide-car-front',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'operational',
    defaultVisible: true
  },
  {
    id: 'birthdays',
    title: 'Ulang Tahun & Anniversary',
    icon: 'i-lucide-cake',
    spanClass: 'xl:col-span-3',
    group: 'engagement',
    defaultVisible: true
  },
  {
    id: 'tasks',
    title: 'Tugas Saya',
    icon: 'i-lucide-list-checks',
    spanClass: 'xl:col-span-3',
    group: 'engagement',
    defaultVisible: true
  },
  {
    id: 'activity',
    title: 'Aktivitas Terbaru',
    icon: 'i-lucide-history',
    spanClass: 'xl:col-span-3',
    group: 'engagement',
    defaultVisible: true,
    adminOnly: true
  },
  {
    id: 'distribution',
    title: 'Distribusi & Status',
    icon: 'i-lucide-bar-chart-3',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'analytics',
    defaultVisible: true
  },
  {
    id: 'demographics',
    title: 'Demografi Karyawan',
    icon: 'i-lucide-users-round',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'analytics',
    defaultVisible: false
  },
  {
    id: 'education',
    title: 'Pendidikan & Departemen',
    icon: 'i-lucide-graduation-cap',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'analytics',
    defaultVisible: false
  },
  {
    id: 'trend',
    title: 'Trend Rekrutmen & Offboarding',
    icon: 'i-lucide-trending-up',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'analytics',
    defaultVisible: false
  },
  {
    id: 'monthlyTrend',
    title: 'Tren Bulanan & Perbandingan',
    icon: 'i-lucide-activity',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'analytics',
    defaultVisible: true
  },
  {
    id: 'quick',
    title: 'Akses Cepat',
    icon: 'i-lucide-zap',
    spanClass: 'lg:col-span-2 xl:col-span-6',
    group: 'shortcut',
    defaultVisible: true
  }
]

/**
 * Padding UCard yang selaras antar slot (header/body/footer rata kiri-kanan).
 * Dipakai semua widget agar tinggi & garis teks konsisten.
 */
export const DASHBOARD_CARD_UI = {
  header: 'px-4 pt-4 pb-0 sm:px-5 sm:pt-5',
  body: 'p-4 sm:p-5',
  footer: 'px-4 py-4 sm:px-5'
}

export const DASHBOARD_WIDGET_IDS: string[] = DASHBOARD_WIDGETS.map(w => w.id)

export const DASHBOARD_WIDGET_MAP: Record<string, DashboardWidgetDef> = Object.fromEntries(
  DASHBOARD_WIDGETS.map(w => [w.id, w])
)
