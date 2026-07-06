export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (to.path !== '/login' && !auth.isLoggedIn) {
    return navigateTo('/login')
  }
  if (to.path === '/login' && auth.isLoggedIn) {
    return navigateTo('/')
  }
  const isAdmin = auth.admin?.role === 'ADMIN'

  if (to.path === '/settings/master-data' && !isAdmin) {
    return navigateTo('/settings')
  }
  if (to.path === '/settings/contract-templates' && !isAdmin) {
    return navigateTo('/settings')
  }
  if (to.path === '/settings/users' && !isAdmin) {
    return navigateTo('/settings')
  }
})
