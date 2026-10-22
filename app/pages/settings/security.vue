<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

type BadgeColor = 'primary' | 'info' | 'warning' | 'neutral'

const auth = useAuthStore()
const toast = useToast()

const formId = useId()
const loading = ref(false)
const passwordChanged = ref(false)
const redirecting = ref(false)
const secondsLeft = ref(10)
let redirectTimer: ReturnType<typeof setInterval> | null = null

const state = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const schema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z
    .string()
    .min(8, 'Password baru minimal 8 karakter')
    .refine(value => /[A-Z]/.test(value), 'Tambahkan minimal satu huruf besar')
    .refine(value => /[0-9]/.test(value), 'Tambahkan minimal satu angka')
    .refine(value => /[^A-Za-z0-9]/.test(value), 'Tambahkan minimal satu simbol'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi')
})
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword']
  })
  .refine(data => !data.currentPassword || data.newPassword !== data.currentPassword, {
    message: 'Password baru harus berbeda dari password saat ini',
    path: ['newPassword']
  })

type Schema = z.output<typeof schema>

// ── Syarat & kekuatan password ──────────────────────────────────────────────
const passwordRules = computed(() => {
  const value = state.newPassword
  return [
    { key: 'length', label: 'Minimal 8 karakter', met: value.length >= 8 },
    { key: 'upper', label: 'Satu huruf besar', met: /[A-Z]/.test(value) },
    { key: 'number', label: 'Satu angka', met: /[0-9]/.test(value) },
    { key: 'symbol', label: 'Satu simbol', met: /[^A-Za-z0-9]/.test(value) }
  ]
})

// Warna teks memakai shade lebih gelap di mode terang agar kontras ≥ 4.5:1
// untuk label kecil; mode gelap tetap memakai shade terang.
const strengthLevels = [
  { label: 'Sangat lemah', bar: 'bg-error-600 dark:bg-error-500', text: 'text-error-600 dark:text-error-400' },
  { label: 'Sangat lemah', bar: 'bg-error-600 dark:bg-error-500', text: 'text-error-600 dark:text-error-400' },
  { label: 'Lemah', bar: 'bg-error-600 dark:bg-error-500', text: 'text-error-600 dark:text-error-400' },
  { label: 'Sedang', bar: 'bg-warning-600 dark:bg-warning-500', text: 'text-warning-700 dark:text-warning-400' },
  { label: 'Kuat', bar: 'bg-success-600 dark:bg-success-500', text: 'text-success-700 dark:text-success-400' },
  { label: 'Sangat kuat', bar: 'bg-success-600 dark:bg-success-500', text: 'text-success-700 dark:text-success-400' }
]

const strength = computed(() => {
  const value = state.newPassword
  if (!value) return null
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/[0-9]/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  const level = strengthLevels[Math.min(score, 5)] ?? strengthLevels[0]!
  return { ...level, score: Math.min(score, 5) }
})

// ── Aksi ────────────────────────────────────────────────────────────────────
async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'PUT',
      body: {
        oldPassword: event.data.currentPassword,
        newPassword: event.data.newPassword
      },
      credentials: 'include'
    })
    // Password tidak disimpan lagi di memori form setelah berhasil.
    state.currentPassword = ''
    state.newPassword = ''
    state.confirmPassword = ''
    startReloginCountdown()
  } catch (error) {
    const raw = (error as { data?: { message?: string } })?.data?.message
    const message = raw && raw !== 'Unauthorized'
      ? raw
      : 'Password saat ini tidak sesuai. Periksa kembali lalu coba lagi.'
    toast.add({ title: 'Gagal mengubah password', description: message, color: 'error' })
  } finally {
    loading.value = false
  }
}

function onFormError(event: { errors?: { id?: string, name?: string }[] }) {
  const first = event.errors?.[0]
  nextTick(() => {
    // UForm menonaktifkan input selama submit; tunggu satu frame agar input
    // kembali aktif sebelum difokuskan.
    requestAnimationFrame(() => {
      const byId = first?.id ? document.getElementById(first.id) : null
      const byName = first?.name
        ? document.querySelector<HTMLElement>(`[data-security-form] [data-field="${first.name}"]`)
        : null
      const byInvalid = document.querySelector<HTMLElement>('[data-security-form] [aria-invalid="true"]')
      const target = byId ?? byName ?? byInvalid
      if (!target) return
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  })
}

/**
 * Mengubah password menaikkan `tokenVersion` di backend, sehingga SELURUH sesi
 * (termasuk perangkat ini) langsung tidak valid. Karena itu halaman ini
 * menampilkan konfirmasi lalu mengarahkan ke login, bukan diam di tempat.
 */
function startReloginCountdown() {
  passwordChanged.value = true
  secondsLeft.value = 10
  if (redirectTimer) clearInterval(redirectTimer)
  redirectTimer = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) void goToLogin()
  }, 1000)
}

async function goToLogin() {
  if (redirecting.value) return
  redirecting.value = true
  if (redirectTimer) {
    clearInterval(redirectTimer)
    redirectTimer = null
  }
  try {
    await auth.logout()
  } catch {
    // Sesi sudah dicabut server; logout() tetap membersihkan cookie lokal.
  }
}

onBeforeUnmount(() => {
  if (redirectTimer) clearInterval(redirectTimer)
})

// ── Keluar dari semua perangkat ─────────────────────────────────────────────
const logoutOpen = ref(false)
const loggingOut = ref(false)

async function signOutEverywhere() {
  loggingOut.value = true
  try {
    await auth.logout()
  } catch {
    // Abaikan kegagalan jaringan: cookie lokal tetap dibersihkan oleh logout().
  } finally {
    loggingOut.value = false
  }
}

// ── Identitas & perangkat ───────────────────────────────────────────────────
const initials = computed(() =>
  (auth.admin?.fullName ?? '')
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const roleLabel = computed<{ label: string, color: BadgeColor }>(() => {
  const role = auth.admin?.role
  if (role === 'ADMIN') return { label: 'Admin', color: 'primary' }
  if (role === 'PENGELOLA_KOPERASI') return { label: 'Pengelola Koperasi', color: 'info' }
  return { label: role ?? '-', color: 'neutral' }
})

const accountTypeLabel = computed<{ label: string, color: BadgeColor }>(() => {
  const type = auth.admin?.accountType
  if (type === 'master_admin') return { label: 'Master Admin', color: 'warning' }
  if (type === 'user_account') return { label: 'User Account', color: 'neutral' }
  return { label: type ?? '-', color: 'neutral' }
})

const deviceLabel = ref('')

onMounted(() => {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Microsoft Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Google Chrome'
        : /Firefox\//.test(ua)
          ? 'Mozilla Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  deviceLabel.value = os ? `${browser} · ${os}` : browser
})

const postureItems = [
  {
    icon: 'i-lucide-lock-keyhole',
    title: 'Sesi terenkripsi',
    detail: 'Cookie sesi disimpan httpOnly dengan SameSite Strict, sehingga tidak dapat dibaca JavaScript.'
  },
  {
    icon: 'i-lucide-timer-reset',
    title: 'Token berumur pendek',
    detail: 'Token akses berlaku 15 menit dan diperbarui otomatis lewat refresh token 7 hari.'
  },
  {
    icon: 'i-lucide-user-check',
    title: 'Pencabutan sesi',
    detail: 'Mengubah password atau keluar langsung mengakhiri semua token yang masih aktif.'
  }
]
</script>

<template>
  <UDashboardPanel id="settings-security">
    <template #header>
      <UDashboardNavbar title="Keamanan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
        <div class="grid gap-6 lg:grid-cols-3">
          <!-- Kolom utama: ubah password -->
          <div class="lg:col-span-2">
            <!-- Status sukses: semua sesi sudah dicabut, arahkan login ulang -->
            <UCard v-if="passwordChanged" class="dossier-rise">
              <div class="flex flex-col items-center px-2 py-8 text-center" role="status">
                <div class="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <UIcon name="i-lucide-shield-check" class="size-7" aria-hidden="true" />
                </div>
                <h2 class="mt-4 text-lg font-semibold text-highlighted">
                  Password berhasil diubah
                </h2>
                <p class="mt-1 max-w-md text-sm leading-relaxed text-muted">
                  Seluruh sesi akun Anda — termasuk perangkat ini — sudah diakhiri.
                  Masuk kembali dengan password baru untuk melanjutkan.
                </p>
                <UButton
                  label="Masuk sekarang"
                  icon="i-lucide-log-in"
                  color="primary"
                  class="mt-6"
                  :loading="redirecting"
                  @click="goToLogin"
                />
                <p class="mt-3 text-xs text-muted">
                  Mengalihkan ke halaman masuk dalam
                  <span class="font-medium text-highlighted">{{ Math.max(secondsLeft, 0) }}</span>
                  detik
                </p>
              </div>
            </UCard>

            <UCard v-else class="dossier-rise">
              <template #header>
                <div class="flex items-start gap-3">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UIcon name="i-lucide-key-round" class="size-5" aria-hidden="true" />
                  </div>
                  <div class="min-w-0">
                    <h2 class="font-semibold text-highlighted">
                      Ubah Password
                    </h2>
                    <p class="mt-0.5 text-sm text-muted">
                      Gunakan password panjang yang tidak dipakai di akun lain.
                    </p>
                  </div>
                </div>
              </template>

              <UForm
                :id="formId"
                :schema="schema"
                :state="state"
                class="space-y-5"
                data-security-form
                @submit="onSubmit"
                @error="onFormError"
              >
                <SettingsPasswordField
                  v-model="state.currentPassword"
                  name="currentPassword"
                  label="Password saat ini"
                  placeholder="Masukkan password saat ini"
                  autocomplete="current-password"
                />

                <div class="space-y-4 rounded-xl border border-default bg-elevated/30 p-4">
                  <SettingsPasswordField
                    v-model="state.newPassword"
                    name="newPassword"
                    label="Password baru"
                    placeholder="Minimal 8 karakter"
                    autocomplete="new-password"
                  />

                  <div v-if="strength">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs text-muted">Kekuatan password</span>
                      <span class="text-xs font-medium" :class="strength.text">{{ strength.label }}</span>
                    </div>
                    <div
                      class="mt-1.5 grid grid-cols-5 gap-1"
                      role="img"
                      :aria-label="`Kekuatan password: ${strength.label}`"
                    >
                      <span
                        v-for="step in 5"
                        :key="step"
                        class="h-1.5 rounded-full transition-colors duration-300"
                        :class="step <= strength.score ? strength.bar : 'bg-elevated'"
                      />
                    </div>
                  </div>

                  <ul class="grid gap-2 sm:grid-cols-2">
                    <li
                      v-for="rule in passwordRules"
                      :key="rule.key"
                      class="flex items-center gap-2 text-xs"
                      :class="rule.met ? 'text-success-700 dark:text-success-400' : 'text-muted'"
                    >
                      <UIcon
                        :name="rule.met ? 'i-lucide-circle-check' : 'i-lucide-circle'"
                        class="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {{ rule.label }}
                    </li>
                  </ul>
                </div>

                <SettingsPasswordField
                  v-model="state.confirmPassword"
                  name="confirmPassword"
                  label="Konfirmasi password baru"
                  placeholder="Ulangi password baru"
                  autocomplete="new-password"
                />

                <div class="flex items-start gap-2 rounded-lg border border-default bg-elevated/30 p-3 text-xs leading-relaxed text-muted">
                  <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    Setelah password diubah, semua sesi — termasuk perangkat ini — akan diakhiri
                    dan Anda perlu masuk kembali.
                  </span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3">
                  <p class="text-xs text-muted">
                    Password baru harus berbeda dari password saat ini.
                  </p>
                  <UButton
                    type="submit"
                    label="Simpan Password"
                    icon="i-lucide-save"
                    color="primary"
                    :loading="loading"
                    :disabled="loading"
                  />
                </div>
              </UForm>
            </UCard>
          </div>

          <!-- Panel kanan: postur keamanan, sesi, identitas -->
          <div class="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-shield-check" class="size-4 text-muted" aria-hidden="true" />
                  <span class="font-semibold text-sm">Status Keamanan</span>
                  <UBadge
                    color="success"
                    variant="subtle"
                    size="sm"
                    class="ml-auto"
                  >
                    Aktif
                  </UBadge>
                </div>
              </template>

              <ul class="space-y-4">
                <li v-for="item in postureItems" :key="item.title" class="flex items-start gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                    <UIcon :name="item.icon" class="size-4" aria-hidden="true" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-highlighted">
                      {{ item.title }}
                    </p>
                    <p class="mt-0.5 text-xs leading-relaxed text-muted">
                      {{ item.detail }}
                    </p>
                  </div>
                </li>
              </ul>

              <template #footer>
                <p class="text-xs text-muted">
                  Hak akses akun ini:
                  <span class="font-medium text-highlighted">{{ roleLabel.label }}</span>.
                </p>
              </template>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-monitor-smartphone" class="size-4 text-muted" aria-hidden="true" />
                  <span class="font-semibold text-sm">Sesi & Perangkat</span>
                </div>
              </template>

              <div class="flex items-center gap-3 rounded-lg border border-default bg-elevated/30 p-3">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UIcon name="i-lucide-laptop" class="size-4" aria-hidden="true" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted">
                    Perangkat ini
                  </p>
                  <p class="mt-0.5 truncate text-xs text-muted" :title="deviceLabel">
                    {{ deviceLabel || 'Browser' }}
                  </p>
                </div>
                <UBadge color="success" variant="subtle" size="sm">
                  Aktif
                </UBadge>
              </div>

              <dl class="mt-4 space-y-2 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-muted">
                    Masa berlaku akses
                  </dt>
                  <dd class="font-medium text-highlighted">
                    15 menit
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-muted">
                    Perpanjangan otomatis
                  </dt>
                  <dd class="font-medium text-highlighted">
                    7 hari
                  </dd>
                </div>
              </dl>

              <template #footer>
                <div class="space-y-3">
                  <p class="text-xs leading-relaxed text-muted">
                    Keluar akan mengakhiri sesi ini sekaligus seluruh sesi lain di akun Anda.
                  </p>
                  <UButton
                    label="Keluar dari semua perangkat"
                    icon="i-lucide-log-out"
                    color="error"
                    variant="outline"
                    block
                    @click="logoutOpen = true"
                  />
                </div>
              </template>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-user-round" class="size-4 text-muted" aria-hidden="true" />
                  <span class="font-semibold text-sm">Info Akun</span>
                </div>
              </template>

              <div class="flex items-center gap-3">
                <div class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-default">
                  <img
                    v-if="auth.admin?.photoUrl"
                    :src="auth.admin.photoUrl"
                    :alt="auth.admin?.fullName ?? 'Foto profil'"
                    class="size-full object-cover"
                  >
                  <span v-else class="text-sm font-semibold text-primary">{{ initials }}</span>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-highlighted">
                    {{ auth.admin?.fullName ?? '-' }}
                  </p>
                  <p class="mt-0.5 font-mono text-xs text-muted">
                    {{ auth.admin?.employeeNo ?? '-' }}
                  </p>
                </div>
              </div>

              <dl class="mt-4 space-y-2 border-t border-default pt-4">
                <div class="flex items-center justify-between gap-3">
                  <dt class="flex items-center gap-2 text-sm text-muted">
                    <UIcon name="i-lucide-shield" class="size-4" aria-hidden="true" />
                    Role
                  </dt>
                  <dd>
                    <UBadge :color="roleLabel.color" variant="subtle" size="sm">
                      {{ roleLabel.label }}
                    </UBadge>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="flex items-center gap-2 text-sm text-muted">
                    <UIcon name="i-lucide-layers" class="size-4" aria-hidden="true" />
                    Tipe Akun
                  </dt>
                  <dd>
                    <UBadge :color="accountTypeLabel.color" variant="subtle" size="sm">
                      {{ accountTypeLabel.label }}
                    </UBadge>
                  </dd>
                </div>
              </dl>

              <template #footer>
                <p class="text-xs leading-relaxed text-muted">
                  Ubah nama, email, atau foto profil di
                  <NuxtLink to="/settings" class="font-medium text-primary hover:underline">
                    Pengaturan › Profil Akun
                  </NuxtLink>.
                </p>
              </template>
            </UCard>
          </div>
        </div>
      </div>

      <!-- Konfirmasi keluar dari semua perangkat -->
      <UModal v-model:open="logoutOpen" title="Keluar dari semua perangkat?">
        <template #body>
          <p class="text-sm leading-relaxed text-muted">
            Sesi di perangkat ini dan seluruh sesi lain pada akun
            <span class="font-medium text-highlighted">{{ auth.admin?.fullName ?? 'Anda' }}</span>
            akan diakhiri. Anda perlu masuk kembali untuk melanjutkan.
          </p>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Batal"
              color="neutral"
              variant="subtle"
              :disabled="loggingOut"
              @click="logoutOpen = false"
            />
            <UButton
              label="Ya, keluar"
              icon="i-lucide-log-out"
              color="error"
              :loading="loggingOut"
              @click="signOutEverywhere"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
