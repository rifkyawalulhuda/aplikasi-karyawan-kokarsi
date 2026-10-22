import { startOfDay } from './date-utils'

/**
 * Pesan tunggal untuk periode kontrak yang tidak sah. Dipakai juga oleh
 * frontend (salinan di `app/utils/contract-period.ts`) agar teks yang dilihat
 * admin sama baik penolakan datang dari form maupun dari API.
 */
export const CONTRACT_PERIOD_ERROR = 'Tanggal selesai harus setelah tanggal mulai'

/**
 * Validasi urutan periode kontrak: `endDate` harus LEBIH BESAR dari `startDate`.
 *
 * Tanggal yang sama ditolak — kontrak satu hari tidak dianggap sah. Dibandingkan
 * per hari (bukan per milidetik) agar jam pada `Date` tidak membuat dua tanggal
 * yang sama dianggap berbeda.
 *
 * Mengembalikan pesan error, atau `null` bila periode sah.
 */
export function contractPeriodError(startDate: Date | string, endDate: Date | string): string | null {
  const start = startOfDay(new Date(startDate)).getTime()
  const end = startOfDay(new Date(endDate)).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return CONTRACT_PERIOD_ERROR
  return end > start ? null : CONTRACT_PERIOD_ERROR
}
