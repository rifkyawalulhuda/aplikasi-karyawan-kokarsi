<script setup lang="ts">
const auth = useAuthStore()
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
              <span class="font-semibold text-sm">Informasi Aplikasi</span>
            </div>
          </template>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted">Nama Aplikasi</dt>
              <dd class="font-medium text-highlighted">Aplikasi Manajemen Karyawan</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted">Organisasi</dt>
              <dd class="font-medium text-highlighted">Koperasi Karyawan PT. Sankyu</dd>
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
