const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const method = getMethod(event)
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.search) params.set('search', String(query.search))
  if (query.employmentStatus) params.set('employmentStatus', String(query.employmentStatus))
  if (query.includeContracts) params.set('includeContracts', String(query.includeContracts))
  const qs = params.toString() ? '?' + params.toString() : ''

  try {
    return await $fetch(`${BACKEND}/employees${qs}`, {
      method: method as any,
      headers: authHeader,
      body: method !== 'GET' ? await readBody(event) : undefined,
      ignoreResponseError: true,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memuat data karyawan',
      data: {
        message: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memuat data karyawan',
      },
    })
  }
})
