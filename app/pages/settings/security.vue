<script setup lang="ts">
const toast = useToast()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

function onSave() {
  if (newPassword.value !== confirmPassword.value) {
    toast.add({ title: 'Password tidak cocok', color: 'error' })
    return
  }
  toast.add({ title: 'Password berhasil diubah', color: 'success' })
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
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
      <div class="max-w-md space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-key-round" class="size-4 text-muted" />
              <span class="font-semibold text-sm">Ubah Password</span>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField label="Password Saat Ini">
              <UInput v-model="currentPassword" type="password" class="w-full" placeholder="••••••••" />
            </UFormField>
            <UFormField label="Password Baru">
              <UInput v-model="newPassword" type="password" class="w-full" placeholder="••••••••" />
            </UFormField>
            <UFormField label="Konfirmasi Password Baru">
              <UInput v-model="confirmPassword" type="password" class="w-full" placeholder="••••••••" />
            </UFormField>
            <div class="flex justify-end">
              <UButton label="Simpan Password" color="primary" @click="onSave" />
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
