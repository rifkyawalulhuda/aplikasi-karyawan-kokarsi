/**
 * Tinggi ruang kosong pada tabel tanda tangan — tempat menempel meterai.
 *
 * Modul daun (tanpa PDFKit/NestJS/Prisma) supaya dipakai bersama oleh:
 *  - validator (`contract-templates/template-schema.validator.ts`), dan
 *  - renderer PKWT & MITRA (`contracts/*-document.renderer.ts`).
 *
 * SATU nilai berlaku untuk kolom kiri DAN kanan. Disimpan dalam **mm** (bukan
 * pt seperti `spaceAfter`) karena acuannya ukuran fisik meterai:
 * meterai Rp10.000 = 21 × 28,95 mm.
 */

/** Batas atas nilai (mm). Di atas ini tabel tanda tangan bisa keluar halaman. */
export const MAX_SIGNATURE_SPACE_MM = 100

/** 1 mm dalam pt (PDF memakai 72 pt per inci). */
export const PT_PER_MM = 72 / 25.4

/** Default PKWT: tinggi meterai Rp10.000 (28,95 mm). */
export const PKWT_DEFAULT_SIGNATURE_SPACE_MM = 28.95

/**
 * Default MITRA dalam pt — SENGAJA pt, bukan mm, supaya template lama
 * menghasilkan PDF yang sama persis: `signSpaceRowH` master = 88 pt.
 */
export const MITRA_DEFAULT_SIGNATURE_SPACE_PT = 88

/**
 * Normalisasi nilai mentah `signatureSpaceMm`.
 *
 * Hanya angka berhingga `0..MAX_SIGNATURE_SPACE_MM` yang sah (dibulatkan ke 2
 * desimal); selain itu → `undefined` (pakai default keluarga). Nilai `0` SAH
 * dan berarti "rapat" — garis bawah tetap diberi jarak aman oleh engine.
 */
export function normalizeSignatureSpaceMm(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (value < 0 || value > MAX_SIGNATURE_SPACE_MM) return undefined
  return Math.round(value * 100) / 100
}

/**
 * Tinggi ruang dalam pt untuk engine.
 *
 * @param value nilai mentah dari blok `signature` (`signatureSpaceMm`).
 * @param family keluarga template — menentukan default saat nilai kosong.
 */
export function signatureSpacePt(value: unknown, family: 'PKWT' | 'MITRA'): number {
  const mm = normalizeSignatureSpaceMm(value)
  if (mm === undefined) {
    return family === 'MITRA'
      ? MITRA_DEFAULT_SIGNATURE_SPACE_PT
      : PKWT_DEFAULT_SIGNATURE_SPACE_MM * PT_PER_MM
  }
  return mm * PT_PER_MM
}

/** Default yang ditampilkan di editor (mm), per keluarga. */
export function signatureSpaceDefaultMm(family: 'PKWT' | 'MITRA'): number {
  return family === 'MITRA'
    ? MITRA_DEFAULT_SIGNATURE_SPACE_PT / PT_PER_MM
    : PKWT_DEFAULT_SIGNATURE_SPACE_MM
}

/**
 * Ambil nilai `signatureSpaceMm` dari blok template, lalu ubah ke pt.
 *
 * Tabel tanda tangan hanya SATU untuk kedua bahasa (PKWT bilingual), jadi nilai
 * diambil dari blok ID lebih dulu dengan fallback EN — fallback per NILAI, agar
 * blok EN yang terlanjur menyimpan nilai tetap terpakai. Renderer memanggil ini
 * (bukan service) supaya jalur generate dan pratinjau tidak bisa menyimpang.
 */
export function signatureSpacePtFromBlocks(
  blocksId: unknown,
  blocksEn: unknown,
  family: 'PKWT' | 'MITRA'
): number {
  const find = (list: unknown): any =>
    Array.isArray(list) ? list.find((b: any) => b?.type === 'signature') : undefined
  // Fallback per NILAI, bukan per blok: blok EN yang terlanjur punya nilai tetap
  // terpakai bila blok ID belum diisi. Editor hanya menulis ke blok ID.
  const idBlock = find(blocksId)
  const enBlock = find(blocksEn)
  return signatureSpacePt(idBlock?.signatureSpaceMm ?? enBlock?.signatureSpaceMm, family)
}
