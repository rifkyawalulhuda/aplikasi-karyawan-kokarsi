import { defineEventHandler, getCookie, getQuery } from 'h3'


export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const MAX_EXPORT = 5000

  const params = new URLSearchParams({
    limit: String(MAX_EXPORT),
    page: '1',
    includeContracts: 'true',
    ...(query.search ? { search: String(query.search) } : {}),
    ...(query.employmentStatus ? { employmentStatus: String(query.employmentStatus) } : {}),
  })

  const res = await fetch(`${BACKEND}/employees?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    throw createError({ statusCode: res.status, statusMessage: 'Gagal mengambil data export' })
  }

  return res.json()
})
