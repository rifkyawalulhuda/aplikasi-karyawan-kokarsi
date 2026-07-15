import { defineEventHandler, getCookie, getQuery } from 'h3'


export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const { q, limit = '5' } = getQuery(event)
  if (!q || String(q).trim().length < 2) {
    return { employees: [], contracts: [], warningLetters: [], employeeDocuments: [], dokKaryawan: [], vendorContracts: [], legalKoperasi: [], akteDokumen: [] }
  }

  const searchParam = encodeURIComponent(String(q).trim())
  const limitParam = String(limit)

  const [employeesRes, contractsRes, warningLettersRes, employeeDocumentsRes, dokKaryawanRes, vendorContractsRes, legalKoperasiRes, akteDokumenRes] = await Promise.allSettled([
    $fetch(`${BACKEND}/employees?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/contracts?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/warning-letters?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    // Sertifikasi & Ijin — hanya CERTIFICATION category
    $fetch(`${BACKEND}/employee-documents?search=${searchParam}&limit=${limitParam}&documentTypeCategory=CERTIFICATION`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    // Dok. Karyawan — hanya PERSONAL category
    $fetch(`${BACKEND}/employee-documents?search=${searchParam}&limit=${limitParam}&documentTypeCategory=PERSONAL`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/vendor-contracts?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/legal-koperasi?search=${searchParam}&limit=${limitParam}`, {
      headers: authHeader,
    }) as Promise<{ data: any[] }>,
    $fetch(`${BACKEND}/akte-dokumen?search=${searchParam}&limit=${limitParam}`, {
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
  if (employeeDocumentsRes.status === 'rejected') {
    console.error('[search] Gagal fetch employee-documents (CERTIFICATION):', employeeDocumentsRes.reason)
  }
  if (dokKaryawanRes.status === 'rejected') {
    console.error('[search] Gagal fetch employee-documents (PERSONAL):', dokKaryawanRes.reason)
  }
  if (vendorContractsRes.status === 'rejected') {
    console.error('[search] Gagal fetch vendor-contracts:', vendorContractsRes.reason)
  }
  if (legalKoperasiRes.status === 'rejected') {
    console.error('[search] Gagal fetch legal-koperasi:', legalKoperasiRes.reason)
  }
  if (akteDokumenRes.status === 'rejected') {
    console.error('[search] Gagal fetch akte-dokumen:', akteDokumenRes.reason)
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

  const employeeDocuments = employeeDocumentsRes.status === 'fulfilled'
    ? (employeeDocumentsRes.value?.data ?? [])
    : []

  const dokKaryawan = dokKaryawanRes.status === 'fulfilled'
    ? (dokKaryawanRes.value?.data ?? [])
    : []

  const vendorContracts = vendorContractsRes.status === 'fulfilled'
    ? (vendorContractsRes.value?.data ?? [])
    : []

  const legalKoperasi = legalKoperasiRes.status === 'fulfilled'
    ? (legalKoperasiRes.value?.data ?? [])
    : []

  const akteDokumen = akteDokumenRes.status === 'fulfilled'
    ? (akteDokumenRes.value?.data ?? [])
    : []

  return { employees, contracts, warningLetters, employeeDocuments, dokKaryawan, vendorContracts, legalKoperasi, akteDokumen }
})
