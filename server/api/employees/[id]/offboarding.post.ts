import { getCookie, getRouterParam, proxyRequest } from 'h3'


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  return proxyRequest(event, `${BACKEND}/employees/${id}/offboarding`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
})
