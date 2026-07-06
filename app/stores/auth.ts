import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const token = useCookie('auth_token', { maxAge: 60 * 60 * 8 })
  const admin = useCookie<{ id: number; employeeNo: string; fullName: string; email?: string; role?: 'ADMIN' | 'PENGELOLA_KOPERASI'; accountType?: 'master_admin' | 'user_account' } | null>('auth_admin', { maxAge: 60 * 60 * 8 })

  const isLoggedIn = computed(() => !!token.value)
  const canManageMasterData = computed(() => admin.value?.role === 'ADMIN')

  async function login(employeeNo: string, password: string) {
    const res = await $fetch<{ access_token: string; admin: { id: number; employeeNo: string; fullName: string; role: 'ADMIN' | 'PENGELOLA_KOPERASI'; accountType?: 'master_admin' | 'user_account' } }>('/api/auth/login', {
      method: 'POST',
      body: { employeeNo, password },
    })

    if (!res?.access_token) {
      throw new Error('Login gagal, respons backend tidak valid')
    }

    token.value = res.access_token
    admin.value = res.admin
    return res
  }

  function logout() {
    token.value = null
    admin.value = null
    navigateTo('/login')
  }

  function getAuthHeader(): Record<string, string> {
    if (!token.value) return {}
    return { Authorization: `Bearer ${token.value}` }
  }

  return { token, admin, isLoggedIn, canManageMasterData, login, logout, getAuthHeader }
})
