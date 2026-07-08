/**
 * Utility untuk generate nomor dokumen otomatis.
 *
 * Format: {seq}/{code}/KUKP/SII/{bulan_romawi}/{tahun}
 * Contoh: 005/KK/KUKP/SII/VII/2026
 *
 * Running number 3 digit, reset setiap tahun.
 * Metode parse-max: ambil nomor tertinggi dari record tahun berjalan + 1
 * (aman terhadap penghapusan data — tidak akan bentrok).
 */

const MONTH_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/**
 * Build nomor dokumen dari daftar nomor existing di tahun berjalan.
 *
 * @param existingNumbers - Array nomor dokumen existing (semua dari tahun berjalan)
 * @param code            - Kode jenis dokumen: 'KK' (Kontrak Kerja) | 'SP' (Surat Peringatan)
 * @param now             - Tanggal referensi (default: waktu sekarang)
 */
export function buildDocumentNumber(
  existingNumbers: string[],
  code: 'KK' | 'SP',
  now = new Date(),
): string {
  const year = now.getFullYear()
  const month = MONTH_ROMAN[now.getMonth()]

  let max = 0
  for (const no of existingNumbers) {
    const match = no.match(/^(\d+)\//)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > max) max = num
    }
  }

  const seq = String(max + 1).padStart(3, '0')
  return `${seq}/${code}/KUKP/SII/${month}/${year}`
}
