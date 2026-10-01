import { defineEventHandler, getCookie, getHeader, getRouterParam } from 'h3'

/**
 * Proxy field dinamis form kontrak untuk sebuah template.
 *
 * Backend `GET /contract-templates/:templateId/fields` membaca
 * `fieldDefinitions` versi PUBLISHED — sumber yang sama dengan yang divalidasi
 * `TemplateSnapshotService` saat kontrak dibuat/diperpanjang. Jadi field yang
 * ditampilkan form persis sama dengan field yang diwajibkan server; kalau form
 * membaca sumber lain (mis. katalog `ContractTemplateField`), user bisa diminta
 * mengisi field yang tidak pernah divalidasi, atau sebaliknya.
 */
export default defineEventHandler(async (event) => {
  // Nama param harus konsisten dengan [id].ts / [id]/** lain di folder ini.
  // radix3 memilih placeholder berdasarkan maxDepth, sehingga dua nama param berbeda
  // (:id dan :templateId) pada posisi yang sama membuat route yang lebih dalam gagal cocok.
  const templateId = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  return $fetch(`${BACKEND}/contract-templates/${templateId}/fields`, {
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined
  })
})
