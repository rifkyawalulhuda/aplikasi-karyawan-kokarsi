const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const body = await readBody(event)

  const res = await $fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    body,
    ignoreResponseError: true,
  })

  return res
})
