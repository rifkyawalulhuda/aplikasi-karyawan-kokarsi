<script setup lang="ts">
const toast = useToast()
const auth = useAuthStore()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)

// Show/hide toggle per field
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

// Password strength indicator
const passwordStrength = computed(() => {
  const p = newPassword.value
  if (!p) return null
  let score = 0
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  if (score <= 1) return { label: 'Lemah', color: 'bg-error', textColor: 'text-error', width: '25%' }
  if (score === 2) return { label: 'Sedang', color: 'bg-warning', textColor: 'text-warning', width: '50%' }
  if (score === 3) return { label: 'Kuat', color: 'bg-success', textColor: 'text-success', width: '75%' }
  return { label: 'Sangat Kuat', color: 'bg-success', textColor: 'text-success', width: '100%' }
})

// Inline confirmation match
const passwordsMatch = computed(() => {
  if (!confirmPassword.value) return null
  return newPassword.value === confirmPassword.value
})

// Role & account type labels
const roleLabel = computed(() => {
  const role = auth.admin?.role
  if (role === 'ADMIN') return { label: 'Admin', color: 'primary' }
  if (role === 'PENGELOLA_KOPERASI') return { label: 'Pengelola Koperasi', color: 'info' }
  return { label: role ?? '-', color: 'neutral' }
})

const accountTypeLabel = computed(() => {
  const type = auth.admin?.accountType
  if (type === 'master_admin') return { label: 'Master Admin', color: 'warning' }
  if (type === 'user_account') return { label: 'User Account', color: 'neutral' }
  return { label: type ?? '-', color: 'neutral' }
})

async function onSave() {
  if (!currentPassword.value) {
    toast.add({ title: 'Password saat ini wajib diisi', color: 'error' })
    return
  }
  if (!newPassword.value) {
    toast.add({ title: 'Password baru wajib diisi', color: 'error' })
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.add({ title: 'Konfirmasi password tidak cocok', color: 'error' })
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'PUT',
      body: { oldPassword: currentPassword.value, newPassword: newPassword.value },
      credentials: 'include',
    })
    toast.add({ title: 'Password berhasil diubah', color: 'success' })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    showCurrent.value = false
    showNew.value = false
    showConfirm.value = false
  } catch (e: any) {
    toast.add({
      title: 'Gagal mengubah password',
      description: e?.data?.message ?? 'Password saat ini tidak sesuai',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
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
      <div class="space-y-6 p-4 sm:p-6 max-w-2xl">

        <!-- Kartu 1: Ubah Password -->
        <UCard>
          <template #header>
            <div class="flex items-start gap-3 px-1">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon name="i-lucide-key-round" class="size-5" />
              </div>
              <div>
                <h2 class="font-semibold text-highlighted">Ubah Password</h2>
                <p class="text-sm text-muted mt-0.5">Perbarui password akun Anda secara berkala untuk menjaga keamanan.</p>
              </div>
            </div>
          </template>

          <div class="space-y-5">
            <!-- Password Saat Ini -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-3 flex items-center gap-1.5">
                <UIcon name="i-lucide-lock" class="size-3.5" />
                Password Saat Ini
              </p>
              <UFormField label="Password Saat Ini" required>
                <UInput
                  v-model="currentPassword"
                  :type="showCurrent ? 'text' : 'password'"
                  class="w-full"
                  placeholder="Masukkan password saat ini"
                  autocomplete="current-password"
                >
                  <template #trailing>
                    <UButton
                      :icon="showCurrent ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      :padded="false"
                      class="mr-1"
                      :aria-label="showCurrent ? 'Sembunyikan password' : 'Tampilkan password'"
                      @click="showCurrent = !showCurrent"
                    />
                  </template>
                </UInput>
              </UFormField>
            </div>

            <!-- Divider -->
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-default" />
              </div>
              <div class="relative flex justify-start">
                <span class="bg-default pr-3 text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
                  <UIcon name="i-lucide-shield-plus" class="size-3.5" />
                  Password Baru
                </span>
              </div>
            </div>

            <!-- Password Baru -->
            <UFormField label="Password Baru" required>
              <UInput
                v-model="newPassword"
                :type="showNew ? 'text' : 'password'"
                class="w-full"
                placeholder="Minimal 8 karakter"
                autocomplete="new-password"
              >
                <template #trailing>
                  <UButton
                    :icon="showNew ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :padded="false"
                    class="mr-1"
                    :aria-label="showNew ? 'Sembunyikan password' : 'Tampilkan password'"
                    @click="showNew = !showNew"
                  />
                </template>
              </UInput>
              <!-- Strength indicator -->
              <div v-if="passwordStrength" class="mt-2">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-muted">Kekuatan password</span>
                  <span class="text-xs font-medium" :class="passwordStrength.textColor">{{ passwordStrength.label }}</span>
                </div>
                <div class="h-1.5 w-full rounded-full bg-elevated overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :class="passwordStrength.color"
                    :style="{ width: passwordStrength.width }"
                  />
                </div>
                <p class="text-xs text-muted mt-1.5">Gunakan kombinasi huruf besar, angka, dan simbol untuk password yang lebih kuat.</p>
              </div>
            </UFormField>

            <!-- Konfirmasi Password -->
            <UFormField label="Konfirmasi Password Baru" required>
              <UInput
                v-model="confirmPassword"
                :type="showConfirm ? 'text' : 'password'"
                class="w-full"
                placeholder="Ulangi password baru"
                autocomplete="new-password"
              >
                <template #trailing>
                  <UButton
                    :icon="showConfirm ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :padded="false"
                    class="mr-1"
                    :aria-label="showConfirm ? 'Sembunyikan password' : 'Tampilkan password'"
                    @click="showConfirm = !showConfirm"
                  />
                </template>
              </UInput>
              <!-- Match indicator -->
              <div v-if="passwordsMatch !== null" class="mt-1.5 flex items-center gap-1.5">
                <UIcon
                  :name="passwordsMatch ? 'i-lucide-check-circle-2' : 'i-lucide-x-circle'"
                  class="size-3.5 shrink-0"
                  :class="passwordsMatch ? 'text-success' : 'text-error'"
                />
                <span
                  class="text-xs"
                  :class="passwordsMatch ? 'text-success' : 'text-error'"
                >
                  {{ passwordsMatch ? 'Password cocok' : 'Password tidak cocok' }}
                </span>
              </div>
            </UFormField>

            <!-- Submit -->
            <div class="flex justify-end pt-1">
              <UButton
                label="Simpan Password"
                icon="i-lucide-save"
                color="primary"
                :loading="loading"
                :disabled="loading"
                @click="onSave"
              />
            </div>
          </div>
        </UCard>

        <!-- Kartu 2: Info Akun -->
        <UCard>
          <template #header>
            <div class="flex items-start gap-3 px-1">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <UIcon name="i-lucide-shield-check" class="size-5" />
              </div>
              <div>
                <h2 class="font-semibold text-highlighted">Info Akun</h2>
                <p class="text-sm text-muted mt-0.5">Detail identitas dan hak akses akun Anda saat ini.</p>
              </div>
            </div>
          </template>

          <div class="space-y-3">
            <!-- Nama -->
            <div class="flex items-center justify-between py-2 border-b border-default">
              <div class="flex items-center gap-2 text-sm text-muted">
                <UIcon name="i-lucide-user" class="size-4 shrink-0" />
                <span>Nama</span>
              </div>
              <span class="text-sm font-medium text-highlighted">{{ auth.admin?.fullName ?? '-' }}</span>
            </div>

            <!-- No. Karyawan -->
            <div class="flex items-center justify-between py-2 border-b border-default">
              <div class="flex items-center gap-2 text-sm text-muted">
                <UIcon name="i-lucide-badge" class="size-4 shrink-0" />
                <span>No. Karyawan</span>
              </div>
              <span class="font-mono text-sm text-highlighted">{{ auth.admin?.employeeNo ?? '-' }}</span>
            </div>

            <!-- Role -->
            <div class="flex items-center justify-between py-2 border-b border-default">
              <div class="flex items-center gap-2 text-sm text-muted">
                <UIcon name="i-lucide-shield" class="size-4 shrink-0" />
                <span>Role</span>
              </div>
              <UBadge :color="(roleLabel.color as any)" variant="subtle" size="sm">
                {{ roleLabel.label }}
              </UBadge>
            </div>

            <!-- Tipe Akun -->
            <div class="flex items-center justify-between py-2">
              <div class="flex items-center gap-2 text-sm text-muted">
                <UIcon name="i-lucide-layers" class="size-4 shrink-0" />
                <span>Tipe Akun</span>
              </div>
              <UBadge :color="(accountTypeLabel.color as any)" variant="subtle" size="sm">
                {{ accountTypeLabel.label }}
              </UBadge>
            </div>
          </div>

          <!-- Info footer -->
          <template #footer>
            <div class="flex items-start gap-2 text-xs text-muted px-1">
              <UIcon name="i-lucide-info" class="size-3.5 mt-0.5 shrink-0 text-primary" />
              <span>Untuk mengubah data profil lainnya (nama, email, foto), buka halaman <strong class="text-highlighted">Pengaturan &gt; Umum &gt; Profil Akun</strong>.</span>
            </div>
          </template>
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
