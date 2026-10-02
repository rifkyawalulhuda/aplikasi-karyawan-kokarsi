import { defineEventHandler, getRouterParam, proxyRequest } from 'h3'

/**
 * Proxy pratinjau PDF pratinjau template (respons biner).
 *
 * Memakai `proxyRequest` (bukan `$fetch` JSON) supaya byte PDF diteruskan apa
 * adanya — pola yang sama dengan `contracts/[id]/download-pdf.get.ts`.
 *
 * Backend: `POST /contract-template-versions/:versionId/preview-pdf`
 * Body: `{ contentDefinition? }` (agar editan belum tersimpan ikut terlihat).
 */
export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  return proxyRequest(event, `${BACKEND}/contract-template-versions/${versionId}/preview-pdf`)
})
