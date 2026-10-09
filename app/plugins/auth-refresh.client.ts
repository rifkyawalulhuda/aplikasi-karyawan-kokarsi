/**
 * Sliding session di sisi client: refresh access token secara berkala selama
 * tab terbuka agar sesi tetap hidup selama user aktif (dan resource seperti
 * gambar /uploads yang di-proxied dengan cookie auth_token tidak putus).
 *
 * Refresh token disimpan di cookie httpOnly — client cukup POST ke
 * /api/auth/refresh tanpa perlu tahu isi token. Jika refresh gagal (sesi
 * sudah dicabut / kadaluarsa 7 hari), route guard + 401 handler yang
 * mengarahkan ke /login.
 */
export default defineNuxtPlugin(() => {
  const INTERVAL_MS = 10 * 60 * 1000 // tiap 10 menit
  const MIN_GAP_MS = 5 * 60 * 1000 // jangan lebih rapat dari 5 menit
  let lastRefresh = Date.now()

  async function refresh() {
    const now = Date.now()
    if (now - lastRefresh < MIN_GAP_MS) return
    lastRefresh = now
    try {
      await $fetch('/api/auth/refresh', { method: 'POST' })
    } catch {
      // Sesi berakhir — biarkan middleware/401 handler yang menangani logout.
    }
  }

  const timer = setInterval(() => void refresh(), INTERVAL_MS)

  // Tab lama di background lalu diaktifkan lagi → segarkan sesi.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh()
  })

  window.addEventListener('beforeunload', () => clearInterval(timer))
})
