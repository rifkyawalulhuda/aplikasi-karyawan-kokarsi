/**
 * Blocker periode kontrak di sisi klien.
 *
 * Aturannya sama persis dengan server (`backend/src/shared/contract-period.ts`):
 * `endDate` harus LEBIH BESAR dari `startDate` — tanggal yang sama ditolak.
 * Server tetap memeriksa ulang; util ini hanya membuat admin tahu sebelum
 * menekan Simpan.
 */

/** Pesan yang sama dengan yang dikembalikan API. */
export const CONTRACT_PERIOD_ERROR = 'Tanggal selesai harus setelah tanggal mulai'

/**
 * Pesan error periode, atau `null` bila sah.
 *
 * Tanggal dari form berbentuk `YYYY-MM-DD`, yang urutannya sama dengan urutan
 * leksikografis — jadi perbandingan string sudah cukup dan bebas zona waktu.
 * `null` bila salah satu tanggal belum diisi: field wajib punya pesan sendiri.
 */
export function contractPeriodError(
  startDate?: string | null,
  endDate?: string | null
): string | null {
  const start = (startDate ?? '').slice(0, 10)
  const end = (endDate ?? '').slice(0, 10)
  if (!start || !end) return null
  return end > start ? null : CONTRACT_PERIOD_ERROR
}
