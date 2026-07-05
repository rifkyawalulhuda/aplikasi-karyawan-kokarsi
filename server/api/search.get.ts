import { defineEventHandler, getCookie, getQuery } from 'h3'

const BACKEND = 'http://localhost:3001/api'

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
      ignoreResponseError: true,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/contracts?limit=${limitParam}`, {
      headers: authHeader,
      ignoreResponseError: true,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/warning-letters?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
      ignoreResponseError: true,
    }) as Promise<{ data: any[] }>,
  ])

  const employees = employeesRes.status === 'fulfilled'
    ? (employeesRes.value?.data ?? [])
    : []

  // Filter contracts by query (contractNo or employee name)
  const allContracts = contractsRes.status === 'fulfilled'
    ? (contractsRes.value?.data ?? [])
    : []
  const qLower = String(q).toLowerCase()
  const contracts = allContracts.filter((c: any) =>
    c.contractNo?.toLowerCase().includes(qLower) ||
    c.employee?.fullName?.toLowerCase().includes(qLower) ||
    c.employee?.employeeNo?.toLowerCase().includes(qLower),
  ).slice(0, Number(limitParam))

  const warningLetters = warningLettersRes.status === 'fulfilled'
    ? (warningLettersRes.value?.data ?? [])
    : []

  return { employees, contracts, warningLetters }
})
