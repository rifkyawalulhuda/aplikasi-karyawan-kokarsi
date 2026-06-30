<script setup lang="ts">
definePageMeta({ layout: false })

const auth = useAuthStore()
const toast = useToast()

const form = reactive({ employeeNo: '', password: '' })
const loading = ref(false)

async function handleLogin() {
  if (!form.employeeNo || !form.password) return
  loading.value = true
  try {
    await auth.login(form.employeeNo, form.password)
    await navigateTo('/')
  } catch (e: any) {
    toast.add({
      title: 'Login Gagal',
      description: e?.data?.message ?? 'Kredensial tidak valid',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-default px-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="text-center py-2">
          <h1 class="text-xl font-bold text-highlighted">Kokarsi</h1>
          <p class="text-sm text-muted mt-1">Sistem Manajemen Karyawan</p>
        </div>
      </template>

      <UForm :state="form" class="space-y-4" @submit="handleLogin">
        <UFormField label="No. Induk Karyawan" name="employeeNo">
          <UInput
            v-model="form.employeeNo"
            placeholder="Contoh: EMP001"
            class="w-full"
            autocomplete="username"
          />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput
            v-model="form.password"
            type="password"
            placeholder="Masukkan password"
            class="w-full"
            autocomplete="current-password"
          />
        </UFormField>

        <UButton
          type="submit"
          class="w-full justify-center"
          :loading="loading"
        >
          Masuk
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
