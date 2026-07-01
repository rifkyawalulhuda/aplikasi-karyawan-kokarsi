export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (to.path !== '/login' && !auth.isLoggedIn) {
    return navigateTo('/login')
  }
  if (to.path === '/login' && auth.isLoggedIn) {
    return navigateTo('/')
  }
  if (to.path === '/settings/master-data' && (auth.admin?.role ?? 'ADMIN') !== 'ADMIN') {
    return navigateTo('/settings')
  }
  if (to.path === '/settings/users' && (auth.admin?.role ?? 'ADMIN') !== 'ADMIN') {
    return navigateTo('/settings')
  }
})
