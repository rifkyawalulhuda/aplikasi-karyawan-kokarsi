import { defineEventHandler, getCookie, getQuery } from 'h3'


export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const { q, limit = '5' } = getQuery(event)
  if (!q || String(q).trim().length < 2) {
    return { employees: [], contracts: [], warningLetters: [] }
  }

  const searchParam = encodeURIComponent(String(q).trim())
  const limitParam = String(limit)

  const [employeesRes, contractsRes, warningLettersRes] = await Promise.allSettled([
    $fetch(`${BACKEND}/employees?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/contracts?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/warning-letters?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
  ])

  if (employeesRes.status === 'rejected') {
    console.error('[search] Gagal fetch employees:', employeesRes.reason)
  }
  if (contractsRes.status === 'rejected') {
    console.error('[search] Gagal fetch contracts:', contractsRes.reason)
  }
  if (warningLettersRes.status === 'rejected') {
    console.error('[search] Gagal fetch warning-letters:', warningLettersRes.reason)
  }

  const employees = employeesRes.status === 'fulfilled'
    ? (employeesRes.value?.data ?? [])
    : []

  const contracts = contractsRes.status === 'fulfilled'
    ? (contractsRes.value?.data ?? [])
    : []

  const warningLetters = warningLettersRes.status === 'fulfilled'
    ? (warningLettersRes.value?.data ?? [])
    : []

  return { employees, contracts, warningLetters }
})
