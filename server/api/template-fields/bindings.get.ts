import { defineEventHandler, getCookie, getHeader, getQuery } from 'h3'

/**
 * Panel binding editor template: katalog field + status pakai/wajib untuk template.
 *
 * Backend `GET /template-fields/bindings?templateId=...` membaca katalog
 * `TemplateFieldDefinition` + baris binding `ContractTemplateField`, dan menandai
 * field yang placeholder-nya masih dipakai konten (`usedInContent`).
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const { templateId } = getQuery(event)
  return $fetch(`${BACKEND}/template-fields/bindings`, {
    query: { templateId },
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
  })
})
