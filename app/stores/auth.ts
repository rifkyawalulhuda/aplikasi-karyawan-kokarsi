import { defineStore } from 'pinia'

const ADMIN_COOKIE = 'auth_admin'
const ADMIN_TTL_SECONDS = 60 * 60 * 24 * 7

interface AuthAdmin {
  id: number
  employeeNo: string
  fullName: string
  email?: string
  role?: 'ADMIN' | 'PENGELOLA_KOPERASI'
  accountType?: 'master_admin' | 'user_account'
  photoUrl?: string | null
}

export const useAuthStore = defineStore('auth', () => {
  // Cookie ini hanya menyimpan info tampilan (bukan kredensial); otorisasi tetap
  // via JWT httpOnly. "Remember me" mengatur apakah cookie ini persisten 7 hari
  // atau sesi (hilang saat browser ditutup) — diselaraskan dengan cookie httpOnly.
  const admin = useCookie<AuthAdmin | null>(ADMIN_COOKIE, { maxAge: ADMIN_TTL_SECONDS })

  const isLoggedIn = computed(() => !!admin.value)
  const canManageMasterData = computed(() => admin.value?.role === 'ADMIN')
  const canDelete = computed(() => admin.value?.role === 'ADMIN')

  async function login(employeeNo: string, password: string, remember = true) {
    const res = await $fetch<{ admin: AuthAdmin }>('/api/auth/login', {
      method: 'POST',
      body: { employeeNo, password, remember }
    })

    if (!res?.admin) {
      throw new Error('Login gagal, respons backend tidak valid')
    }

    admin.value = res.admin

    // remember=false → tulis ulang cookie tanpa maxAge agar menjadi cookie sesi.
    if (!remember) {
      const sessionCookie = useCookie<AuthAdmin | null>(ADMIN_COOKIE)
      sessionCookie.value = res.admin
    }

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
