<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'
import type { GeneralSettings, LoginFeatureItem } from '~/types'

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
const appVersion = useRuntimeConfig().public.appVersion

const generalSchema = z.object({
  cooperativeChairmanName: z.string().min(3, 'Nama Ketua Koperasi wajib diisi'),
  organizationName: z.string().min(2, 'Nama Organisasi wajib diisi')
})

type GeneralSchema = z.output<typeof generalSchema>

const { data: generalSettings, refresh: refreshGeneralSettings } = await useFetch<GeneralSettings>('/api/settings/general')

const generalState = reactive<Partial<GeneralSchema>>({
  cooperativeChairmanName: '',
  organizationName: ''
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
      body: { agendaNotificationMorningHour: String(agendaMorningHour.value) }
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
  loginTagline: '',
  loginSubtitle: '',
  loginFeatures: '[]',
  loginGreetingEnabled: '1',
  loginRememberMeEnabled: '1',
  loginOrnamentsEnabled: '1',
  loginFooterShowVersion: '1',
  loginSupportTitle: '',
  loginSupportContact: ''
})

const loginBaseline = ref('')

function applySettingsToLoginForm() {
  const s = generalSettings.value
  loginForm.loginLeftBgColor = s?.loginLeftBgColor ?? ''
  loginForm.loginRightBgColor = s?.loginRightBgColor ?? ''
  loginForm.loginLeftImageUrl = s?.loginLeftImageUrl ?? ''
  loginForm.loginRightImageUrl = s?.loginRightImageUrl ?? ''
  loginForm.loginLeftOverlayOpacity = Number(s?.loginLeftOverlayOpacity ?? '7')
  loginForm.loginRightOverlayOpacity = Number(s?.loginRightOverlayOpacity ?? '0')
  loginForm.loginLeftTextColor = s?.loginLeftTextColor ?? ''
  loginForm.loginRightTextColor = s?.loginRightTextColor ?? ''
  loginForm.loginTagline = s?.loginTagline ?? 'Sistem Manajemen Karyawan'
  loginForm.loginSubtitle = s?.loginSubtitle ?? ''
  loginForm.loginFeatures = s?.loginFeatures ?? '[]'
  loginForm.loginGreetingEnabled = s?.loginGreetingEnabled ?? '1'
  loginForm.loginRememberMeEnabled = s?.loginRememberMeEnabled ?? '1'
  loginForm.loginOrnamentsEnabled = s?.loginOrnamentsEnabled ?? '1'
  loginForm.loginFooterShowVersion = s?.loginFooterShowVersion ?? '1'
  loginForm.loginSupportTitle = s?.loginSupportTitle ?? ''
  loginForm.loginSupportContact = s?.loginSupportContact ?? ''
}

function snapshotLoginBaseline() {
  loginBaseline.value = JSON.stringify(toRaw(loginForm))
}

watchEffect(() => {
  // Reaktif terhadap generalSettings (mis. setelah refresh dari server).
  applySettingsToLoginForm()
  snapshotLoginBaseline()
})

// Computed (bukan watch) agar ikut ter-update saat baseline berubah setelah simpan/reset.
const loginDirty = computed(() => JSON.stringify(loginForm) !== loginBaseline.value)

const previewDevice = ref<'desktop' | 'mobile'>('desktop')

const featureItems = computed<LoginFeatureItem[]>({
  get: () => {
    try {
      const parsed = JSON.parse(loginForm.loginFeatures || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },
  set: (items) => {
    loginForm.loginFeatures = JSON.stringify(items)
  }
})

function boolModel(key: 'loginGreetingEnabled' | 'loginRememberMeEnabled' | 'loginOrnamentsEnabled' | 'loginFooterShowVersion') {
  return computed({
    get: () => loginForm[key] === '1',
    set: (value: boolean) => { loginForm[key] = value ? '1' : '0' }
  })
}

const greetingEnabled = boolModel('loginGreetingEnabled')
const rememberMeEnabled = boolModel('loginRememberMeEnabled')
const ornamentsEnabled = boolModel('loginOrnamentsEnabled')
const footerShowVersion = boolModel('loginFooterShowVersion')

const currentLoginLeftImageUrl = computed(() => loginForm.loginLeftImageUrl || '')
const currentLoginRightImageUrl = computed(() => loginForm.loginRightImageUrl || '')

const loginPreviewFeatures = computed<LoginFeatureItem[]>(() => featureItems.value)

async function discardLoginChanges() {
  await refreshGeneralSettings()
  applySettingsToLoginForm()
  snapshotLoginBaseline()
}

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
      body: formData
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
        loginTagline: loginForm.loginTagline,
        loginSubtitle: loginForm.loginSubtitle,
        loginFeatures: loginForm.loginFeatures,
        loginGreetingEnabled: loginForm.loginGreetingEnabled,
        loginRememberMeEnabled: loginForm.loginRememberMeEnabled,
        loginOrnamentsEnabled: loginForm.loginOrnamentsEnabled,
        loginFooterShowVersion: loginForm.loginFooterShowVersion,
        loginSupportTitle: loginForm.loginSupportTitle,
        loginSupportContact: loginForm.loginSupportContact
      }
    })
    await refreshGeneralSettings()
    await refreshAppSettings()
    applySettingsToLoginForm()
    snapshotLoginBaseline()
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
        loginTagline: 'Sistem Manajemen Karyawan',
        loginSubtitle: 'Platform internal untuk pengelolaan data karyawan, kontrak kerja, dan laporan operasional.',
        loginFeatures: JSON.stringify([
          { icon: 'i-lucide-users', text: 'Manajemen Data Karyawan' },
          { icon: 'i-lucide-file-text', text: 'Administrasi Kontrak Kerja' },
          { icon: 'i-lucide-bar-chart-3', text: 'Laporan & Ekspor Data' }
        ]),
        loginGreetingEnabled: '1',
        loginRememberMeEnabled: '1',
        loginOrnamentsEnabled: '1',
        loginFooterShowVersion: '1',
        loginSupportTitle: 'Butuh bantuan?',
        loginSupportContact: 'Hubungi Administrator IT Koperasi'
      }
    })
    await refreshGeneralSettings()
    await refreshAppSettings()
    applySettingsToLoginForm()
    snapshotLoginBaseline()
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
          color: 'error'
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

  if (!file.type.match(/\/(jpg|jpeg|png|webp)$/)) {
    toast.add({ title: 'Format tidak didukung', description: 'Gunakan JPG, PNG, atau WEBP', color: 'error' })
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal 2MB', color: 'error' })
    return
  }

  const valid = await validateLogoDimensions(file)
  if (!valid) {
    if (logoFileInput.value) logoFileInput.value.value = ''
    return
  }

  uploadingLogo.value = true
  try {
    const formData = new FormData()
    formData.append('logo', file)
    await $fetch('/api/settings/logo', {
      method: 'POST',
      body: formData
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
      body: { organizationName: generalState.organizationName }
    })
    await $fetch('/api/settings/logo', {
      method: 'POST',
      body: new FormData()
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
      body: event.data
    })
    generalState.cooperativeChairmanName = updated.cooperativeChairmanName
    generalState.organizationName = updated.organizationName
    await refreshGeneralSettings()
    toast.add({ title: 'Pengaturan umum berhasil disimpan', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Gagal menyimpan pengaturan umum',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error'
    })
  } finally {
    savingGeneral.value = false
  }
}

type SettingsTab = 'general' | 'profile' | 'login-appearance' | 'email-config'
const activeTab = ref<SettingsTab>('general')

function confirmLeaveDirty(): boolean {
  if (activeTab.value !== 'login-appearance' || !loginDirty.value) return true
  return window.confirm('Ada perubahan tampilan login yang belum disimpan. Lanjutkan tanpa menyimpan?')
}

const activeTabModel = computed({
  get: () => activeTab.value,
  set: (value: SettingsTab) => {
    if (value === activeTab.value) return
    if (!confirmLeaveDirty()) return
    activeTab.value = value
  }
})

// Foto profil
const uploadingProfilePhoto = ref(false)
const deletingProfilePhoto = ref(false)
const profilePhotoInput = ref<HTMLInputElement | null>(null)

const profilePhotoUrl = computed(() => auth.admin?.photoUrl || '')

function triggerProfilePhotoUpload() {
  profilePhotoInput.value?.click()
}

async function onProfilePhotoSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.add({ title: 'File harus berupa gambar', color: 'error' })
    input.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    toast.add({ title: 'Ukuran file maksimal 2MB', color: 'error' })
    input.value = ''
    return
  }

  uploadingProfilePhoto.value = true
  try {
    const fd = new FormData()
    fd.append('photo', file)
    // Native fetch — $fetch men-serialisasi FormData sebagai JSON yang memecah multipart
    const res = await fetch('/api/auth/profile/photo', {
      method: 'POST',
      body: fd,
      credentials: 'include'
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.message ?? `Upload gagal (${res.status})`)
    }
    const data = await res.json()
    auth.setPhotoUrl(data.photoUrl ?? null)
    toast.add({ title: 'Foto profil diperbarui', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Gagal upload foto', description: err?.message ?? 'Error', color: 'error' })
  } finally {
    uploadingProfilePhoto.value = false
    input.value = ''
  }
}

async function removeProfilePhoto() {
  if (!profilePhotoUrl.value) return
  deletingProfilePhoto.value = true
  try {
    await $fetch('/api/auth/profile/photo', { method: 'DELETE', credentials: 'include' })
    auth.setPhotoUrl(null)
    toast.add({ title: 'Foto profil dihapus', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Gagal menghapus foto', description: err?.data?.message ?? 'Error', color: 'error' })
  } finally {
    deletingProfilePhoto.value = false
  }
}

function profileInitials(): string {
  const name = auth.admin?.fullName?.trim() ?? 'U'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
  return (name[0] ?? 'U').toUpperCase()
}

const tabs = computed(() => [
  { value: 'general' as SettingsTab, label: 'Umum', icon: 'i-lucide-building-2' },
  { value: 'profile' as SettingsTab, label: 'Profil Akun', icon: 'i-lucide-user-cog' },
  ...(auth.canManageMasterData
    ? [
        { value: 'login-appearance' as SettingsTab, label: 'Tampilan Login', icon: 'i-lucide-monitor' },
        { value: 'email-config' as SettingsTab, label: 'Email Config', icon: 'i-lucide-mail' }
      ]
    : [])
])

// Peringatan perubahan belum disimpan
function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (loginDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})

onBeforeRouteLeave(() => {
  if (!confirmLeaveDirty()) return false
})
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
      <div class="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <!-- Tab navigation -->
        <UTabs
          v-model="activeTabModel"
          :items="tabs"
          :content="false"
          class="mb-6"
        />

        <!-- Tab: Umum -->
        <div v-if="activeTab === 'general'" class="space-y-4">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Informasi Aplikasi</span>
              </div>
            </template>
            <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div class="rounded-lg border border-default bg-elevated/30 p-3">
                <dt class="text-muted">
                  Nama Aplikasi
                </dt>
                <dd class="mt-0.5 font-medium text-highlighted">
                  Aplikasi Manajemen Karyawan
                </dd>
              </div>
              <div class="rounded-lg border border-default bg-elevated/30 p-3">
                <dt class="text-muted">
                  Versi
                </dt>
                <dd class="mt-0.5 font-medium text-highlighted">
                  {{ appVersion }}
                </dd>
              </div>
              <div class="rounded-lg border border-default bg-elevated/30 p-3">
                <dt class="text-muted">
                  Status
                </dt>
                <dd class="mt-0.5">
                  <UBadge color="success" variant="subtle">
                    Aktif
                  </UBadge>
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-settings-2" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Pengaturan Umum</span>
              </div>
            </template>
            <UForm
              :schema="generalSchema"
              :state="generalState"
              class="space-y-5"
              @submit="saveGeneralSettings"
            >
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
                    >
                    <span v-else class="text-lg font-bold text-primary">
                      {{ (generalState.organizationName || 'Kokarsi')[0] }}
                    </span>
                  </div>
                  <div class="flex flex-col gap-2">
                    <input
                      ref="logoFileInput"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
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
          </UCard>

          <UCard>
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
        <div v-else-if="activeTab === 'profile'" class="space-y-4">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-user-cog" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Profil Akun</span>
              </div>
            </template>
            <div class="flex items-center gap-6">
              <div class="relative shrink-0">
                <div class="flex size-24 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-default">
                  <img
                    v-if="profilePhotoUrl"
                    :src="profilePhotoUrl"
                    :alt="auth.admin?.fullName ?? 'Foto profil'"
                    class="h-full w-full object-cover"
                  >
                  <span v-else class="text-3xl font-bold text-primary">{{ profileInitials() }}</span>
                </div>
              </div>

              <div class="space-y-3">
                <div>
                  <UButton
                    label="Upload Foto"
                    icon="i-lucide-upload"
                    color="primary"
                    size="sm"
                    :loading="uploadingProfilePhoto"
                    @click="triggerProfilePhotoUpload"
                  />
                  <input
                    ref="profilePhotoInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    :disabled="uploadingProfilePhoto"
                    @change="onProfilePhotoSelected"
                  >
                </div>
                <UButton
                  v-if="profilePhotoUrl"
                  label="Hapus Foto"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  :loading="deletingProfilePhoto"
                  @click="removeProfilePhoto"
                />
                <p v-if="uploadingProfilePhoto" class="flex items-center gap-1 text-xs text-muted">
                  <UIcon name="i-lucide-loader-circle" class="size-3 animate-spin" />
                  Mengunggah...
                </p>
              </div>
            </div>
            <p class="mt-2 text-xs text-muted">
              Format gambar JPG, PNG, WebP, SVG. Maksimal 2MB.
            </p>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-id-card" class="size-4 text-muted" />
                <span class="font-semibold text-sm">Data Login</span>
              </div>
            </template>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
            <p class="mt-3 text-xs text-muted">
              Hubungi administrator sistem untuk mengubah data profil.
            </p>
          </UCard>
        </div>

        <!-- Tab: Tampilan Login -->
        <div v-else-if="activeTab === 'login-appearance'" class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-highlighted">
                Tampilan Halaman Login
              </h3>
              <p class="text-sm text-muted">
                Sesuaikan branding, konten, dan opsi halaman login.
              </p>
            </div>
            <UButton
              label="Reset ke Default"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-rotate-ccw"
              :loading="savingLoginAppearance"
              @click="resetLoginAppearance"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <!-- Preview column -->
            <UCard class="xl:sticky xl:top-4 self-start">
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-eye" class="size-4 text-muted" />
                  <span class="font-semibold text-sm">Pratinjau Langsung</span>
                </div>
              </template>
              <SettingsLoginPreview
                v-model:device="previewDevice"
                :left-bg-color="loginForm.loginLeftBgColor"
                :right-bg-color="loginForm.loginRightBgColor"
                :left-image-url="loginForm.loginLeftImageUrl"
                :right-image-url="loginForm.loginRightImageUrl"
                :left-overlay-opacity="loginForm.loginLeftOverlayOpacity"
                :right-overlay-opacity="loginForm.loginRightOverlayOpacity"
                :left-text-color="loginForm.loginLeftTextColor"
                :right-text-color="loginForm.loginRightTextColor"
                :tagline="loginForm.loginTagline"
                :features="loginPreviewFeatures"
                :ornaments-enabled="ornamentsEnabled"
                :show-version="footerShowVersion"
                :app-version="appVersion"
                :support-contact="loginForm.loginSupportContact"
              />
            </UCard>

            <!-- Controls column -->
            <div class="space-y-4">
              <UCard>
                <template #header>
                  <span class="font-semibold text-sm">Panel Kiri (Branding)</span>
                </template>
                <div class="space-y-4">
                  <SettingsColorField
                    v-model="loginForm.loginLeftBgColor"
                    label="Warna Background"
                    placeholder="#2563eb"
                    fallback="#2563eb"
                  />

                  <div class="space-y-1">
                    <label class="text-xs font-medium text-muted">Background Image</label>
                    <div v-if="currentLoginLeftImageUrl" class="flex items-center gap-2">
                      <img :src="currentLoginLeftImageUrl" alt="Left BG" class="w-14 h-9 object-cover rounded border border-default">
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
                    >
                    <div v-if="uploadingLoginImage === 'left'" class="flex items-center gap-1 text-xs text-muted">
                      <UIcon name="i-lucide-loader-circle" class="w-3 h-3 animate-spin" />
                      Mengupload...
                    </div>
                  </div>

                  <UFormField :label="`Overlay Opacity: ${loginForm.loginLeftOverlayOpacity}%`">
                    <USlider v-model="loginForm.loginLeftOverlayOpacity" :min="0" :max="100" />
                  </UFormField>

                  <SettingsColorField
                    v-model="loginForm.loginLeftTextColor"
                    label="Warna Teks"
                    placeholder="#ffffff"
                    fallback="#ffffff"
                  />
                </div>
              </UCard>

              <UCard>
                <template #header>
                  <span class="font-semibold text-sm">Panel Kanan (Form)</span>
                </template>
                <div class="space-y-4">
                  <SettingsColorField
                    v-model="loginForm.loginRightBgColor"
                    label="Warna Background"
                    placeholder="#ffffff"
                    fallback="#ffffff"
                  />

                  <div class="space-y-1">
                    <label class="text-xs font-medium text-muted">Background Image</label>
                    <div v-if="currentLoginRightImageUrl" class="flex items-center gap-2">
                      <img :src="currentLoginRightImageUrl" alt="Right BG" class="w-14 h-9 object-cover rounded border border-default">
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
                    >
                    <div v-if="uploadingLoginImage === 'right'" class="flex items-center gap-1 text-xs text-muted">
                      <UIcon name="i-lucide-loader-circle" class="w-3 h-3 animate-spin" />
                      Mengupload...
                    </div>
                  </div>

                  <UFormField :label="`Overlay Opacity: ${loginForm.loginRightOverlayOpacity}%`">
                    <USlider v-model="loginForm.loginRightOverlayOpacity" :min="0" :max="100" />
                  </UFormField>

                  <SettingsColorField
                    v-model="loginForm.loginRightTextColor"
                    label="Warna Teks"
                    placeholder="#000000"
                    fallback="#000000"
                  />
                </div>
              </UCard>

              <UCard>
                <template #header>
                  <span class="font-semibold text-sm">Konten Halaman</span>
                </template>
                <div class="space-y-4">
                  <UFormField label="Tagline / Judul Utama" description="Teks besar pada panel kiri halaman login.">
                    <UInput v-model="loginForm.loginTagline" class="w-full" placeholder="Sistem Manajemen Karyawan" />
                  </UFormField>

                  <UFormField label="Subjudul" description="Deskripsi singkat di bawah tagline.">
                    <UTextarea
                      v-model="loginForm.loginSubtitle"
                      class="w-full"
                      :rows="2"
                      placeholder="Platform internal untuk pengelolaan data karyawan..."
                    />
                  </UFormField>

                  <UFormField label="Daftar Fitur" description="Poin keunggulan yang tampil di panel kiri. Maksimal 3 disarankan.">
                    <SettingsFeatureListEditor v-model="featureItems" />
                  </UFormField>

                  <UFormField label="Judul Bantuan" description="Judul modal bantuan / lupa password.">
                    <UInput v-model="loginForm.loginSupportTitle" class="w-full" placeholder="Butuh bantuan?" />
                  </UFormField>

                  <UFormField label="Kontak Bantuan" description="Info kontak administrator yang ditampilkan di modal bantuan dan footer.">
                    <UInput v-model="loginForm.loginSupportContact" class="w-full" placeholder="Hubungi Administrator IT Koperasi" />
                  </UFormField>
                </div>
              </UCard>

              <UCard>
                <template #header>
                  <span class="font-semibold text-sm">Opsi Tambahan</span>
                </template>
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-highlighted">
                        Sapaan Dinamis
                      </p>
                      <p class="text-xs text-muted">
                        Ubah judul form menjadi Selamat Pagi/Siang/Sore/Malam sesuai waktu.
                      </p>
                    </div>
                    <USwitch v-model="greetingEnabled" />
                  </div>
                  <USeparator />
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-highlighted">
                        Ingat Saya
                      </p>
                      <p class="text-xs text-muted">
                        Tampilkan opsi "Ingat saya" agar sesi bertahan 7 hari.
                      </p>
                    </div>
                    <USwitch v-model="rememberMeEnabled" />
                  </div>
                  <USeparator />
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-highlighted">
                        Ornamen Latar
                      </p>
                      <p class="text-xs text-muted">
                        Efek gradien lembut pada latar panel login.
                      </p>
                    </div>
                    <USwitch v-model="ornamentsEnabled" />
                  </div>
                  <USeparator />
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-highlighted">
                        Tampilkan Versi Aplikasi
                      </p>
                      <p class="text-xs text-muted">
                        Menampilkan versi {{ appVersion }} di footer login.
                      </p>
                    </div>
                    <USwitch v-model="footerShowVersion" />
                  </div>
                </div>
              </UCard>
            </div>
          </div>

          <SettingsStickySaveBar
            :dirty="loginDirty"
            :saving="savingLoginAppearance"
            @save="saveLoginAppearance"
            @reset="discardLoginChanges"
          />
        </div>

        <!-- Tab: Email Config -->
        <div v-else-if="activeTab === 'email-config'">
          <SettingsEmailConfigTab />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
