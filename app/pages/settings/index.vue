<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'
import type { GeneralSettings } from '~/types'

const auth = useAuthStore()
const toast = useToast()
const savingGeneral = ref(false)
const uploadingLogo = ref(false)
const logoFileInput = ref<HTMLInputElement | null>(null)
const uploadingLoginImage = ref<'left' | 'right' | null>(null)
const loginLeftImageInput = ref<HTMLInputElement | null>(null)
const loginRightImageInput = ref<HTMLInputElement | null>(null)
const savingLoginAppearance = ref(false)
const { refresh: refreshAppSettings } = useAppSettings()

const generalSchema = z.object({
  cooperativeChairmanName: z.string().min(3, 'Nama Ketua Koperasi wajib diisi'),
  organizationName: z.string().min(2, 'Nama Organisasi wajib diisi'),
})

type GeneralSchema = z.output<typeof generalSchema>

const { data: generalSettings, refresh: refreshGeneralSettings } = await useFetch<GeneralSettings>('/api/settings/general')

const generalState = reactive<Partial<GeneralSchema>>({
  cooperativeChairmanName: '',
  organizationName: '',
})

watchEffect(() => {
  generalState.cooperativeChairmanName = generalSettings.value?.cooperativeChairmanName ?? ''
  generalState.organizationName = generalSettings.value?.organizationName ?? ''
})

const currentLogoUrl = computed(() => {
  if (!generalSettings.value?.appLogoUrl) return ''
  return generalSettings.value.appLogoUrl
})

// --- Agenda Notification ---
const savingAgendaNotif = ref(false)
const agendaMorningHour = ref(7)

watchEffect(() => {
  agendaMorningHour.value = Number(generalSettings.value?.agendaNotificationMorningHour ?? '7')
})

async function saveAgendaNotificationSettings() {
  if (!auth.canManageMasterData) return
  savingAgendaNotif.value = true
  try {
    await $fetch('/api/settings/general', {
      method: 'PUT',
      body: { agendaNotificationMorningHour: String(agendaMorningHour.value) },
    })
    await refreshGeneralSettings()
    toast.add({ title: 'Pengaturan notifikasi agenda disimpan', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Gagal menyimpan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    savingAgendaNotif.value = false
  }
}

// --- Login Appearance ---
const loginForm = reactive({
  loginLeftBgColor: '',
  loginRightBgColor: '',
  loginLeftImageUrl: '',
  loginRightImageUrl: '',
  loginLeftOverlayOpacity: 7,
  loginRightOverlayOpacity: 0,
  loginLeftTextColor: '',
  loginRightTextColor: '',
})

watchEffect(() => {
  loginForm.loginLeftBgColor = generalSettings.value?.loginLeftBgColor ?? ''
  loginForm.loginRightBgColor = generalSettings.value?.loginRightBgColor ?? ''
  loginForm.loginLeftImageUrl = generalSettings.value?.loginLeftImageUrl ?? ''
  loginForm.loginRightImageUrl = generalSettings.value?.loginRightImageUrl ?? ''
  loginForm.loginLeftOverlayOpacity = Number(generalSettings.value?.loginLeftOverlayOpacity ?? '7')
  loginForm.loginRightOverlayOpacity = Number(generalSettings.value?.loginRightOverlayOpacity ?? '0')
  loginForm.loginLeftTextColor = generalSettings.value?.loginLeftTextColor ?? ''
  loginForm.loginRightTextColor = generalSettings.value?.loginRightTextColor ?? ''
})

const currentLoginLeftImageUrl = computed(() => {
  if (!loginForm.loginLeftImageUrl) return ''
  return loginForm.loginLeftImageUrl
})

const currentLoginRightImageUrl = computed(() => {
  if (!loginForm.loginRightImageUrl) return ''
  return loginForm.loginRightImageUrl
})

const previewLeftStyle = computed(() => {
  const style: Record<string, string> = {}
  if (loginForm.loginLeftBgColor) style.backgroundColor = loginForm.loginLeftBgColor
  if (loginForm.loginLeftImageUrl) {
    style.backgroundImage = `url('${loginForm.loginLeftImageUrl}')`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  if (loginForm.loginLeftTextColor) style.color = loginForm.loginLeftTextColor
  return style
})

const previewRightStyle = computed(() => {
  const style: Record<string, string> = {}
  if (loginForm.loginRightBgColor) style.backgroundColor = loginForm.loginRightBgColor
  if (loginForm.loginRightImageUrl) {
    style.backgroundImage = `url('${loginForm.loginRightImageUrl}')`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  if (loginForm.loginRightTextColor) style.color = loginForm.loginRightTextColor
  return style
})

async function onLoginImageSelected(e: Event, side: 'left' | 'right') {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !auth.canManageMasterData) return

  if (!file.type.match(/\/(jpg|jpeg|png|webp)$/)) {
    toast.add({ title: 'Format tidak didukung', description: 'Gunakan JPG, PNG, atau WEBP', color: 'error' })
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal 5MB', color: 'error' })
    return
  }

  uploadingLoginImage.value = side
  try {
    const formData = new FormData()
    formData.append('image', file)
    const result = await $fetch<GeneralSettings>(`/api/settings/login-image/${side}`, {
      method: 'POST',
      body: formData,
    })
    // Update loginForm immediately from result
    if (side === 'left') loginForm.loginLeftImageUrl = result.loginLeftImageUrl ?? ''
    else loginForm.loginRightImageUrl = result.loginRightImageUrl ?? ''
    await refreshGeneralSettings()
    await refreshAppSettings()
    toast.add({ title: `Gambar panel ${side === 'left' ? 'kiri' : 'kanan'} berhasil diupload`, color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Gagal upload gambar', description: err?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    uploadingLoginImage.value = null
    if (side === 'left' && loginLeftImageInput.value) loginLeftImageInput.value.value = ''
    if (side === 'right' && loginRightImageInput.value) loginRightImageInput.value.value = ''
  }
}

async function removeLoginImage(side: 'left' | 'right') {
  if (!auth.canManageMasterData) return
  uploadingLoginImage.value = side
  try {
    const key = side === 'left' ? 'loginLeftImageUrl' : 'loginRightImageUrl'
    await $fetch('/api/settings/general', { method: 'PUT', body: { [key]: '' } })
    if (side === 'left') loginForm.loginLeftImageUrl = ''
    else loginForm.loginRightImageUrl = ''
    await refreshGeneralSettings()
    await refreshAppSettings()
    toast.add({ title: 'Gambar dihapus', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Gagal menghapus gambar', description: err?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    uploadingLoginImage.value = null
  }
}

async function saveLoginAppearance() {
  if (!auth.canManageMasterData) return
  savingLoginAppearance.value = true
  try {
    await $fetch('/api/settings/general', {
      method: 'PUT',
      body: {
        loginLeftBgColor: loginForm.loginLeftBgColor,
        loginRightBgColor: loginForm.loginRightBgColor,
        loginLeftOverlayOpacity: String(loginForm.loginLeftOverlayOpacity),
        loginRightOverlayOpacity: String(loginForm.loginRightOverlayOpacity),
        loginLeftTextColor: loginForm.loginLeftTextColor,
        loginRightTextColor: loginForm.loginRightTextColor,
      },
    })
    await refreshGeneralSettings()
    await refreshAppSettings()
    toast.add({ title: 'Tampilan halaman login berhasil disimpan', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Gagal menyimpan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    savingLoginAppearance.value = false
  }
}

async function resetLoginAppearance() {
  if (!auth.canManageMasterData) return
  savingLoginAppearance.value = true
  try {
    await $fetch('/api/settings/general', {
      method: 'PUT',
      body: {
        loginLeftBgColor: '',
        loginRightBgColor: '',
        loginLeftImageUrl: '',
        loginRightImageUrl: '',
        loginLeftOverlayOpacity: '7',
        loginRightOverlayOpacity: '0',
        loginLeftTextColor: '',
        loginRightTextColor: '',
      },
    })
    await refreshGeneralSettings()
    await refreshAppSettings()
    toast.add({ title: 'Tampilan login direset ke default', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Gagal mereset', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    savingLoginAppearance.value = false
  }
}

async function validateLogoDimensions(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width > 512 || img.height > 512) {
        toast.add({
          title: 'Logo terlalu besar',
          description: `Dimensi ${img.width}x${img.height}px. Maksimal 512x512px agar tidak merusak layout.`,
          color: 'error',
        })
        resolve(false)
      } else {
        resolve(true)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    img.src = url
  })
}

async function onLogoSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !auth.canManageMasterData) return

  if (!file.type.match(/\/(jpg|jpeg|png|webp|svg\+xml)$/)) {
    toast.add({ title: 'Format tidak didukung', description: 'Gunakan JPG, PNG, WEBP, atau SVG', color: 'error' })
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal 2MB', color: 'error' })
    return
  }

  if (file.type !== 'image/svg+xml') {
    const valid = await validateLogoDimensions(file)
    if (!valid) {
      if (logoFileInput.value) logoFileInput.value.value = ''
      return
    }
  }

  uploadingLogo.value = true
  try {
    const formData = new FormData()
    formData.append('logo', file)
    await $fetch('/api/settings/logo', {
      method: 'POST',
      body: formData,
    })
    await refreshGeneralSettings()
    toast.add({ title: 'Logo berhasil diupload', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Gagal upload logo', description: err?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    uploadingLogo.value = false
    if (logoFileInput.value) logoFileInput.value.value = ''
  }
}

async function removeLogo() {
  if (!auth.canManageMasterData) return
  uploadingLogo.value = true
  try {
    await $fetch<GeneralSettings>('/api/settings/general', {
      method: 'PUT',
      body: { organizationName: generalState.organizationName },
    })
    await $fetch('/api/settings/logo', {
      method: 'POST',
      body: new FormData(),
    })
    await refreshGeneralSettings()
    toast.add({ title: 'Logo dihapus', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Gagal menghapus logo', description: err?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    uploadingLogo.value = false
  }
}

async function saveGeneralSettings(event: FormSubmitEvent<GeneralSchema>) {
  if (!auth.canManageMasterData) return

  savingGeneral.value = true
  try {
    const updated = await $fetch<GeneralSettings>('/api/settings/general', {
      method: 'PUT',
      body: event.data,
    })
    generalState.cooperativeChairmanName = updated.cooperativeChairmanName
    generalState.organizationName = updated.organizationName
    await refreshGeneralSettings()
    toast.add({ title: 'Pengaturan umum berhasil disimpan', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Gagal menyimpan pengaturan umum',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    savingGeneral.value = false
  }
}

type SettingsTab = 'general' | 'profile' | 'login-appearance' | 'email-config'
const activeTab = ref<SettingsTab>('general')

const tabs = computed(() => [
  { key: 'general' as SettingsTab, label: 'Umum', icon: 'i-lucide-building-2' },
  { key: 'profile' as SettingsTab, label: 'Profil Akun', icon: 'i-lucide-user-cog' },
  ...(auth.canManageMasterData
    ? [
        { key: 'login-appearance' as SettingsTab, label: 'Tampilan Login', icon: 'i-lucide-monitor' },
        { key: 'email-config' as SettingsTab, label: 'Email Config', icon: 'i-lucide-mail' },
      ]
    : []),
])

function onTabChange(key: SettingsTab) {
  activeTab.value = key
}
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar title="Pengaturan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 sm:p-6 lg:p-8">
        <!-- Tab navigation -->
        <div class="mb-6 border-b border-default">
          <div class="flex flex-wrap gap-1 -mb-px">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer"
              :class="activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-highlighted hover:bg-elevated/50'"
              @click="onTabChange(tab.key)"
            >
              <UIcon :name="tab.icon" class="size-4" />
              <span>{{ tab.label }}</span>
            </button>
          </div>
        </div>

        <!-- Tab content -->
        <div class="max-w-2xl">
          <!-- Tab: Umum -->
          <div v-if="activeTab === 'general'">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Pengaturan Umum</span>
              </div>
            </template>
          <div class="space-y-5">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted">Nama Aplikasi</dt>
                <dd class="font-medium text-highlighted">Aplikasi Manajemen Karyawan</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted">Versi</dt>
                <dd class="font-medium text-highlighted">1.0.0 (MVP)</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted">Status</dt>
                <dd><UBadge color="success" variant="subtle">Aktif</UBadge></dd>
              </div>
            </dl>

            <div class="border-t border-default pt-5">
              <UForm
                :schema="generalSchema"
                :state="generalState"
                class="space-y-4"
                @submit="saveGeneralSettings"
              >
                <!-- Logo Upload -->
                <UFormField
                  label="Logo Organisasi"
                  description="Logo tampil di sidebar header. Maksimal 512x512px, 2MB. Format: JPG, PNG, WEBP, SVG."
                >
                  <div class="flex items-center gap-4">
                    <div class="size-12 rounded-lg border border-default bg-elevated/30 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        v-if="currentLogoUrl"
                        :src="currentLogoUrl"
                        alt="Logo"
                        class="w-full h-full object-contain"
                      />
                      <span
                        v-else
                        class="text-lg font-bold text-primary"
                      >
                        {{ (generalState.organizationName || 'Kokarsi')[0] }}
                      </span>
                    </div>
                    <div class="flex flex-col gap-2">
                      <input
                        ref="logoFileInput"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 cursor-pointer"
                        :disabled="!auth.canManageMasterData || uploadingLogo"
                        @change="onLogoSelected"
                      >
                      <div v-if="uploadingLogo" class="flex items-center gap-2 text-xs text-muted">
                        <UIcon name="i-lucide-loader-circle" class="w-3.5 h-3.5 animate-spin" />
                        Mengupload...
                      </div>
                    </div>
                  </div>
                </UFormField>

                <!-- Organization Name -->
                <UFormField
                  label="Nama Organisasi"
                  name="organizationName"
                  description="Nama ini tampil di sidebar header dan dokumen kontrak."
                  required
                >
                  <UInput
                    v-model="generalState.organizationName"
                    class="w-full"
                    :disabled="!auth.canManageMasterData"
                    placeholder="Contoh: Kokarsi PT. Sankyu"
                  />
                </UFormField>

                <!-- Chairman Name -->
                <UFormField
                  label="Nama Ketua Koperasi"
                  name="cooperativeChairmanName"
                  description="Nama ini dipakai otomatis di dokumen kontrak sebagai perwakilan PIHAK PERTAMA."
                  required
                >
                  <UInput
                    v-model="generalState.cooperativeChairmanName"
                    class="w-full"
                    :disabled="!auth.canManageMasterData"
                    placeholder="Contoh: Hari Suhono"
                  />
                </UFormField>

                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs text-muted">
                    {{ auth.canManageMasterData ? 'Perubahan akan langsung dipakai di sidebar dan dokumen kontrak.' : 'Hanya Admin yang dapat mengubah pengaturan umum.' }}
                  </p>
                  <UButton
                    v-if="auth.canManageMasterData"
                    type="submit"
                    label="Simpan Pengaturan"
                    color="primary"
                    :loading="savingGeneral"
                  />
                </div>
              </UForm>
            </div>
          </div>
          </UCard>

          <!-- Card: Notifikasi Agenda Kalender -->
          <UCard class="mt-4">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-bell" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Notifikasi Agenda Kalender</span>
              </div>
            </template>
            <div class="space-y-5">
              <p class="text-sm text-muted">
                Atur jam pengiriman notifikasi pagi untuk agenda kalender hari ini. Notifikasi 5 menit sebelum agenda dimulai akan selalu dikirim otomatis.
              </p>
              <UFormField
                label="Jam Notifikasi Pagi"
                description="Notifikasi ringkasan agenda hari ini dikirim pada jam ini setiap hari."
              >
                <div class="flex items-center gap-3">
                  <UInput
                    v-model.number="agendaMorningHour"
                    type="number"
                    :min="0"
                    :max="23"
                    class="w-24"
                    :disabled="!auth.canManageMasterData"
                  />
                  <span class="text-sm text-muted">:00 WIB</span>
                </div>
                <p class="mt-1 text-xs text-muted">
                  Contoh: 7 = jam 07:00, 8 = jam 08:00 (0–23)
                </p>
              </UFormField>
              <div class="rounded-md border border-default bg-elevated/30 p-3 text-sm">
                <div class="flex items-start gap-2">
                  <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-primary" />
                  <div class="space-y-1 text-muted">
                    <p><span class="font-medium text-highlighted">Notifikasi Pagi</span> — Dikirim pada jam yang dikonfigurasi untuk agenda yang ada hari ini.</p>
                    <p><span class="font-medium text-highlighted">Notifikasi 5 Menit Sebelum</span> — Dikirim otomatis 5 menit sebelum jam mulai agenda.</p>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs text-muted">
                  {{ auth.canManageMasterData ? 'Perubahan akan berlaku pada pengiriman notifikasi berikutnya.' : 'Hanya Admin yang dapat mengubah pengaturan ini.' }}
                </p>
                <UButton
                  v-if="auth.canManageMasterData"
                  label="Simpan Pengaturan"
                  color="primary"
                  :loading="savingAgendaNotif"
                  @click="saveAgendaNotificationSettings"
                />
              </div>
            </div>
          </UCard>
          </div>

          <!-- Tab: Profil Akun -->
          <div v-else-if="activeTab === 'profile'">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-user-cog" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Profil Akun</span>
              </div>
            </template>
            <div class="space-y-4">
              <UFormField label="Nama Lengkap">
                <UInput :model-value="auth.admin?.fullName ?? '-'" class="w-full" disabled />
              </UFormField>
              <UFormField label="No. Induk / Username">
                <UInput :model-value="auth.admin?.employeeNo ?? '-'" class="w-full" disabled />
              </UFormField>
              <UFormField v-if="auth.admin?.accountType === 'user_account'" label="Email">
                <UInput :model-value="auth.admin?.email || '-'" class="w-full" disabled />
              </UFormField>
              <UFormField label="Role">
                <UInput :model-value="auth.admin?.role === 'ADMIN' ? 'Administrator' : 'Pengelola Koperasi'" class="w-full" disabled />
              </UFormField>
              <p class="text-xs text-muted">Hubungi administrator sistem untuk mengubah data profil.</p>
            </div>
          </UCard>
          </div>

          <!-- Tab: Tampilan Login -->
          <div v-else-if="activeTab === 'login-appearance'">
          <!-- Login Page Appearance Card -->
          <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-monitor" class="size-4 text-muted" />
              <span class="font-semibold text-sm">Tampilan Halaman Login</span>
            </div>
          </template>
          <div class="space-y-6">

            <!-- Live Preview -->
            <div>
              <p class="text-sm font-medium text-highlighted mb-2">Preview</p>
              <div class="rounded-xl overflow-hidden border border-default flex h-32 text-xs">
                <!-- Left mini panel -->
                <div
                  class="w-2/5 p-3 flex flex-col justify-between relative overflow-hidden"
                  :class="{ 'bg-primary': !loginForm.loginLeftBgColor }"
                  :style="previewLeftStyle"
                >
                  <div class="relative z-10">
                    <div class="w-4 h-4 rounded bg-white/20 mb-1" />
                    <div class="w-16 h-1.5 rounded bg-white/60" />
                  </div>
                  <div class="relative z-10">
                    <div class="w-12 h-2 rounded mb-1" :style="{ backgroundColor: loginForm.loginLeftTextColor || 'rgba(255,255,255,0.9)' }" />
                    <div class="w-20 h-1 rounded" :style="{ backgroundColor: loginForm.loginLeftTextColor || 'rgba(255,255,255,0.5)' }" />
                  </div>
                  <div
                    class="absolute inset-0"
                    :style="{ opacity: (loginForm.loginLeftOverlayOpacity ?? 7) / 100, backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)' }"
                  />
                </div>
                <!-- Right mini panel -->
                <div
                  class="w-3/5 p-3 flex flex-col justify-center gap-1.5 relative overflow-hidden"
                  :class="{ 'bg-background': !loginForm.loginRightBgColor }"
                  :style="previewRightStyle"
                >
                  <div class="w-16 h-2 rounded bg-muted" />
                  <div class="w-full h-5 rounded border border-default bg-elevated" />
                  <div class="w-full h-5 rounded border border-default bg-elevated" />
                  <div class="w-full h-5 rounded bg-primary" />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <!-- Panel Kiri -->
              <div class="space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">Panel Kiri</h3>

                <!-- Left BG Color -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Warna Background</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      :value="loginForm.loginLeftBgColor || '#2563eb'"
                      class="w-8 h-8 rounded cursor-pointer border border-default shrink-0"
                      @input="loginForm.loginLeftBgColor = ($event.target as HTMLInputElement).value"
                    />
                    <UInput v-model="loginForm.loginLeftBgColor" placeholder="#2563eb" class="flex-1" size="sm" />
                    <UButton v-if="loginForm.loginLeftBgColor" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="loginForm.loginLeftBgColor = ''" />
                  </div>
                </div>

                <!-- Left Image -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Background Image</label>
                  <div v-if="currentLoginLeftImageUrl" class="flex items-center gap-2 mb-2">
                    <img :src="currentLoginLeftImageUrl" alt="Left BG" class="w-12 h-8 object-cover rounded border border-default" />
                    <UButton
                      icon="i-lucide-trash-2"
                      size="xs"
                      color="error"
                      variant="ghost"
                      label="Hapus"
                      :loading="uploadingLoginImage === 'left'"
                      @click="removeLoginImage('left')"
                    />
                  </div>
                  <input
                    ref="loginLeftImageInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    class="block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    :disabled="uploadingLoginImage === 'left'"
                    @change="onLoginImageSelected($event, 'left')"
                  />
                  <div v-if="uploadingLoginImage === 'left'" class="flex items-center gap-1 text-xs text-muted">
                    <UIcon name="i-lucide-loader-circle" class="w-3 h-3 animate-spin" />
                    Mengupload...
                  </div>
                </div>

                <!-- Left Overlay Opacity -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Overlay Opacity: {{ loginForm.loginLeftOverlayOpacity }}%</label>
                  <input
                    v-model.number="loginForm.loginLeftOverlayOpacity"
                    type="range"
                    min="0"
                    max="100"
                    class="w-full accent-primary"
                  />
                </div>

                <!-- Left Text Color -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Warna Teks</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      :value="loginForm.loginLeftTextColor || '#ffffff'"
                      class="w-8 h-8 rounded cursor-pointer border border-default shrink-0"
                      @input="loginForm.loginLeftTextColor = ($event.target as HTMLInputElement).value"
                    />
                    <UInput v-model="loginForm.loginLeftTextColor" placeholder="#ffffff" class="flex-1" size="sm" />
                    <UButton v-if="loginForm.loginLeftTextColor" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="loginForm.loginLeftTextColor = ''" />
                  </div>
                </div>
              </div>

              <!-- Panel Kanan -->
              <div class="space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">Panel Kanan</h3>

                <!-- Right BG Color -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Warna Background</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      :value="loginForm.loginRightBgColor || '#ffffff'"
                      class="w-8 h-8 rounded cursor-pointer border border-default shrink-0"
                      @input="loginForm.loginRightBgColor = ($event.target as HTMLInputElement).value"
                    />
                    <UInput v-model="loginForm.loginRightBgColor" placeholder="#ffffff" class="flex-1" size="sm" />
                    <UButton v-if="loginForm.loginRightBgColor" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="loginForm.loginRightBgColor = ''" />
                  </div>
                </div>

                <!-- Right Image -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Background Image</label>
                  <div v-if="currentLoginRightImageUrl" class="flex items-center gap-2 mb-2">
                    <img :src="currentLoginRightImageUrl" alt="Right BG" class="w-12 h-8 object-cover rounded border border-default" />
                    <UButton
                      icon="i-lucide-trash-2"
                      size="xs"
                      color="error"
                      variant="ghost"
                      label="Hapus"
                      :loading="uploadingLoginImage === 'right'"
                      @click="removeLoginImage('right')"
                    />
                  </div>
                  <input
                    ref="loginRightImageInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    class="block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    :disabled="uploadingLoginImage === 'right'"
                    @change="onLoginImageSelected($event, 'right')"
                  />
                  <div v-if="uploadingLoginImage === 'right'" class="flex items-center gap-1 text-xs text-muted">
                    <UIcon name="i-lucide-loader-circle" class="w-3 h-3 animate-spin" />
                    Mengupload...
                  </div>
                </div>

                <!-- Right Overlay Opacity -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Overlay Opacity: {{ loginForm.loginRightOverlayOpacity }}%</label>
                  <input
                    v-model.number="loginForm.loginRightOverlayOpacity"
                    type="range"
                    min="0"
                    max="100"
                    class="w-full accent-primary"
                  />
                </div>

                <!-- Right Text Color -->
                <div class="space-y-1">
                  <label class="text-xs font-medium text-muted">Warna Teks</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      :value="loginForm.loginRightTextColor || '#000000'"
                      class="w-8 h-8 rounded cursor-pointer border border-default shrink-0"
                      @input="loginForm.loginRightTextColor = ($event.target as HTMLInputElement).value"
                    />
                    <UInput v-model="loginForm.loginRightTextColor" placeholder="#000000" class="flex-1" size="sm" />
                    <UButton v-if="loginForm.loginRightTextColor" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="loginForm.loginRightTextColor = ''" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center justify-between gap-3 pt-2 border-t border-default">
              <UButton
                label="Reset ke Default"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-rotate-ccw"
                :loading="savingLoginAppearance"
                @click="resetLoginAppearance"
              />
              <UButton
                label="Simpan Perubahan"
                color="primary"
                size="sm"
                icon="i-lucide-save"
                :loading="savingLoginAppearance"
                @click="saveLoginAppearance"
              />
            </div>
          </div>
          </UCard>
          </div>

          <!-- Tab: Email Config -->
          <div v-else-if="activeTab === 'email-config'">
            <SettingsEmailConfigTab />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
