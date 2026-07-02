import { defineEventHandler, getCookie, getMethod, getRouterParam, readBody } from 'h3'

const BACKEND = 'http://localhost:3001/api'

const ALLOWED = ['work-locations', 'job-roles', 'job-levels', 'tax-status', 'contract-types', 'departments']

export default defineEventHandler(async (event) => {
  const resource = getRouterParam(event, 'resource')
  const id = getRouterParam(event, 'id')

  if (!resource || !ALLOWED.includes(resource)) {
    throw createError({ statusCode: 404, message: 'Resource tidak ditemukan' })
  }

  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` } as Record<string, string>
    : {} as Record<string, string>

  const body = method !== 'GET' && method !== 'DELETE' ? await readBody(event) : undefined

  try {
    return await $fetch(`${BACKEND}/lookups/${resource}/${id}`, {
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
