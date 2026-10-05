import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  // maxAge mengikuti masa berlaku refresh token (7 hari) — cookie ini hanya
  // menyimpan info tampilan (bukan kredensial); otorisasi tetap via JWT httpOnly.
  const admin = useCookie<{ id: number, employeeNo: string, fullName: string, email?: string, role?: 'ADMIN' | 'PENGELOLA_KOPERASI', accountType?: 'master_admin' | 'user_account', photoUrl?: string | null } | null>('auth_admin', { maxAge: 60 * 60 * 24 * 7 })

  const isLoggedIn = computed(() => !!admin.value)
  const canManageMasterData = computed(() => admin.value?.role === 'ADMIN')
  const canDelete = computed(() => admin.value?.role === 'ADMIN')

  async function login(employeeNo: string, password: string) {
    const res = await $fetch<{ admin: { id: number, employeeNo: string, fullName: string, role: 'ADMIN' | 'PENGELOLA_KOPERASI', accountType?: 'master_admin' | 'user_account', photoUrl?: string | null } }>('/api/auth/login', {
      method: 'POST',
      body: { employeeNo, password }
    })

    if (!res?.admin) {
      throw new Error('Login gagal, respons backend tidak valid')
    }

    admin.value = res.admin
    return res
  }

  function setPhotoUrl(photoUrl: string | null) {
    if (admin.value) {
      admin.value = { ...admin.value, photoUrl }
    }
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      admin.value = null
      await navigateTo('/login')
    }
  }

  function getAuthHeader(): Record<string, string> {
    return {}
  }

  return { admin, isLoggedIn, canManageMasterData, canDelete, login, logout, getAuthHeader, setPhotoUrl }
})
