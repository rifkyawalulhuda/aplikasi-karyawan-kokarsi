<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'
import type { GeneralSettings } from '~/types'

const auth = useAuthStore()
const toast = useToast()
const savingGeneral = ref(false)
const uploadingLogo = ref(false)
const logoFileInput = ref<HTMLInputElement | null>(null)

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
  return `http://localhost:3001${generalSettings.value.appLogoUrl}`
})

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
      <div class="max-w-2xl space-y-6">
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

        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-user-cog" class="size-4 text-muted" />
              <span class="font-semibold text-sm">Profil Master Admin</span>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField label="Nama Lengkap">
              <UInput model-value="Master Admin" class="w-full" disabled />
            </UFormField>
            <UFormField label="Email">
              <UInput model-value="admin@kokarsi-sankyu.co.id" type="email" class="w-full" disabled />
            </UFormField>
            <UFormField label="No. Induk Karyawan">
              <UInput model-value="SKY-ADM-001" class="w-full" disabled />
            </UFormField>
            <p class="text-xs text-muted">Hubungi administrator sistem untuk mengubah data profil.</p>
          </div>
        </UCard>

        <UCard v-if="auth.canManageMasterData">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-file-text" class="size-4 text-muted" />
              <span class="font-semibold text-sm">Template Kontrak</span>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-muted">
              Kelola template dokumen PKWT dan Mitra yang dipakai saat generate kontrak kerja otomatis.
            </p>
            <UButton
              to="/settings/contract-templates"
              label="Buka Template Kontrak"
              icon="i-lucide-arrow-right"
              color="primary"
              variant="soft"
            />
          </div>
        </UCard>

        <UCard v-if="auth.canManageMasterData">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-users" class="size-4 text-muted" />
              <span class="font-semibold text-sm">Master User</span>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-muted">
              Kelola akun internal untuk Admin dan Pengelola Koperasi dari satu tempat.
            </p>
            <UButton
              to="/settings/users"
              label="Buka Master User"
              icon="i-lucide-arrow-right"
              color="primary"
              variant="soft"
            />
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
