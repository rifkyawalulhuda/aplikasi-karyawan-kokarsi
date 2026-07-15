import { defineEventHandler, getCookie, getMethod, getRouterParam, readBody, getQuery } from 'h3'


const ALLOWED = ['work-locations', 'job-roles', 'job-levels', 'tax-status', 'contract-types', 'departments', 'document-types']

export default defineEventHandler(async (event) => {
  const resource = getRouterParam(event, 'resource')
  if (!resource || !ALLOWED.includes(resource)) {
    throw createError({ statusCode: 404, message: 'Resource tidak ditemukan' })
  }

  const method = getMethod(event)
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` } as Record<string, string>
    : {} as Record<string, string>

  const body = method !== 'GET' ? await readBody(event) : undefined

  // Build query string dari params yang diterima (misal ?category=PERSONAL)
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(query)) {
    if (val !== undefined && val !== null) params.set(key, String(val))
  }
  const qs = params.toString() ? `?${params.toString()}` : ''

  try {
    return await $fetch(`${BACKEND}/lookups/${resource}${qs}`, {
      method: method as any,
      headers: authHeader,
      body,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memproses data master',
      data: {
        message: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memproses data master',
      },
    })
  }
})
