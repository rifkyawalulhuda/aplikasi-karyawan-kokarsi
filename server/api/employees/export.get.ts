import { defineEventHandler, getCookie, getQuery } from 'h3'

const BACKEND = 'http://localhost:3001/api'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const query = getQuery(event)

  // Fetch semua data tanpa pagination limit
  const params = new URLSearchParams({
    limit: '9999',
    page: '1',
    ...(query.search ? { search: String(query.search) } : {}),
    ...(query.employmentStatus ? { employmentStatus: String(query.employmentStatus) } : {}),
  })

  const res = await fetch(`${BACKEND}/employees?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  return res.json()
})
