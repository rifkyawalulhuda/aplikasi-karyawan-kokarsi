<script setup lang="ts">
import type { AdminRole, UserAccount } from '~/types'

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()

const users = ref<UserAccount[]>([])
const loading = ref(false)
const submitting = ref(false)
const deleteLoading = ref<number | null>(null)
const modalOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')

const form = reactive({
  id: null as number | null,
  name: '',
  nik: '',
  email: '',
  role: 'PENGELOLA_KOPERASI' as AdminRole,
  username: '',
  password: '',
})

const validationErrors = reactive({
  nik: '',
  email: '',
  username: '',
})

const roleOptions: Array<{ label: string; value: AdminRole }> = [
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Pengelola Koperasi', value: 'PENGELOLA_KOPERASI' },
]

async function loadUsers() {
  loading.value = true
  try {
    users.value = await $fetch<UserAccount[]>('/api/users')
  } catch (error) {
    console.error('Gagal memuat user', error)
    toast.add({
      title: 'Gagal memuat user',
      description: 'Pastikan backend user sudah berjalan dan database memiliki tabel user_accounts.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

function resetForm() {
  form.id = null
  form.name = ''
  form.nik = ''
  form.email = ''
  form.role = 'PENGELOLA_KOPERASI'
  form.username = ''
  form.password = ''
  validationErrors.nik = ''
  validationErrors.email = ''
  validationErrors.username = ''
}

function openCreate() {
  mode.value = 'create'
  resetForm()
  modalOpen.value = true
}

function openEdit(item: UserAccount) {
  mode.value = 'edit'
  form.id = item.id
  form.name = item.name
  form.nik = item.nik
  form.email = item.email
  form.role = item.role
  form.username = item.username
  form.password = ''
  modalOpen.value = true
}

function roleLabel(role: AdminRole) {
  return role === 'ADMIN' ? 'Admin' : 'Pengelola Koperasi'
}

function clearValidationErrors() {
  validationErrors.nik = ''
  validationErrors.email = ''
  validationErrors.username = ''
}

function applyFieldErrors(fieldErrors?: Record<string, string>) {
  clearValidationErrors()
  if (!fieldErrors) return

  validationErrors.nik = fieldErrors.nik ?? ''
  validationErrors.email = fieldErrors.email ?? ''
  validationErrors.username = fieldErrors.username ?? ''
}

function findDuplicateUser() {
  const currentId = form.id
  const nik = form.nik.trim().toLowerCase()
  const email = form.email.trim().toLowerCase()
  const username = form.username.trim().toLowerCase()

  const duplicate = users.value.find((item) => {
    if (currentId && item.id === currentId) return false
    return item.nik.trim().toLowerCase() === nik
      || item.email.trim().toLowerCase() === email
      || item.username.trim().toLowerCase() === username
  })

  if (!duplicate) return null

  if (duplicate.nik.trim().toLowerCase() === nik) {
    return { field: 'nik' as const, label: 'NIK', message: `NIK ini sudah dipakai oleh ${duplicate.name}` }
  }

  if (duplicate.email.trim().toLowerCase() === email) {
    return { field: 'email' as const, label: 'Email', message: `Email ini sudah dipakai oleh ${duplicate.name}` }
  }

  return { field: 'username' as const, label: 'Username', message: `Username ini sudah dipakai oleh ${duplicate.name}` }
}

async function saveUser() {
  if (!form.name.trim() || !form.nik.trim() || !form.email.trim() || !form.username.trim()) return
  if (mode.value === 'create' && !form.password.trim()) return

  clearValidationErrors()

  const duplicate = findDuplicateUser()
  if (duplicate) {
    validationErrors[duplicate.field] = duplicate.message
    toast.add({
      title: `${duplicate.label} sudah digunakan`,
      description: duplicate.message,
      color: 'error',
    })
    return
  }

  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      nik: form.nik.trim(),
      email: form.email.trim(),
      role: form.role,
      username: form.username.trim(),
    }

    if (form.password.trim()) {
      body.password = form.password
    }

    if (mode.value === 'create') {
      await $fetch('/api/users', { method: 'POST', body })
      toast.add({ title: 'User berhasil ditambahkan', color: 'success' })
    } else if (form.id) {
      await $fetch(`/api/users/${form.id}`, { method: 'PUT', body })
      toast.add({ title: 'User berhasil diperbarui', color: 'success' })
    }

    modalOpen.value = false
    resetForm()
    await loadUsers()
  } catch (error: any) {
    const fieldErrors = error?.data?.fieldErrors ?? error?.response?._data?.fieldErrors
    if (fieldErrors) {
      applyFieldErrors(fieldErrors)
    }

    const duplicateMessage = error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Terjadi kesalahan'
    toast.add({
      title: fieldErrors ? 'Data user sudah digunakan' : 'Gagal menyimpan user',
      description: duplicateMessage,
      color: 'error',
    })
  } finally {
    submitting.value = false
  }
}

function confirmDelete(item: UserAccount) {
  confirmDeleteToast({
    title: 'Hapus user?',
    description: `Akun ${item.name} (${item.username}) akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus User',
    onConfirm: () => deleteUser(item.id),
  })
}

async function deleteUser(id: number) {
  deleteLoading.value = id
  try {
    await $fetch(`/api/users/${id}`, { method: 'DELETE' })
    toast.add({ title: 'User berhasil dihapus', color: 'success' })
    await loadUsers()
  } catch (error: any) {
    toast.add({
      title: 'Gagal menghapus user',
      description: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    deleteLoading.value = null
  }
}

const stats = computed(() => ({
  total: users.value.length,
  admin: users.value.filter((item) => item.role === 'ADMIN').length,
  pengelola: users.value.filter((item) => item.role === 'PENGELOLA_KOPERASI').length,
}))
</script>

<template>
  <UDashboardPanel id="settings-users">
    <template #header>
      <UDashboardNavbar title="User">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6 p-4 sm:p-6">
        <div class="grid gap-4 md:grid-cols-3">
          <UCard>
            <p class="text-xs uppercase tracking-[0.18em] text-muted">Total Akun</p>
            <p class="mt-2 text-2xl font-semibold text-highlighted">{{ stats.total }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-[0.18em] text-muted">Admin</p>
            <p class="mt-2 text-2xl font-semibold text-highlighted">{{ stats.admin }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-[0.18em] text-muted">Pengelola</p>
            <p class="mt-2 text-2xl font-semibold text-highlighted">{{ stats.pengelola }}</p>
          </UCard>
        </div>

        <UCard :ui="{ body: 'p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <h2 class="text-sm font-semibold text-highlighted">Master User</h2>
                <p class="mt-1 text-xs text-muted">Akun internal untuk login menggunakan username atau NIK.</p>
              </div>
              <UButton
                label="Tambah User"
                icon="i-lucide-plus"
                color="primary"
                size="sm"
                @click="openCreate"
              />
            </div>
          </template>

          <div v-if="loading" class="px-4 py-6 text-sm text-muted">
            Memuat data user...
          </div>

          <div v-else class="divide-y divide-default">
            <div
              v-if="users.length === 0"
              class="px-4 py-10 text-center text-sm text-muted"
            >
              Belum ada data user.
            </div>

            <div
              v-for="item in users"
              :key="item.id"
              class="grid gap-4 px-4 py-4 lg:grid-cols-[1.25fr_.75fr_1.1fr_.85fr_.95fr_auto]"
            >
              <div>
                <p class="text-xs uppercase tracking-[0.16em] text-muted lg:hidden">Nama</p>
                <p class="font-medium text-highlighted">{{ item.name }}</p>
                <p class="mt-1 text-xs text-muted">NIK: {{ item.nik }}</p>
              </div>

              <div>
                <p class="text-xs uppercase tracking-[0.16em] text-muted lg:hidden">Role</p>
                <UBadge :color="item.role === 'ADMIN' ? 'primary' : 'neutral'" variant="subtle">
                  {{ roleLabel(item.role) }}
                </UBadge>
              </div>

              <div>
                <p class="text-xs uppercase tracking-[0.16em] text-muted lg:hidden">Email</p>
                <p class="text-sm text-highlighted">{{ item.email }}</p>
              </div>

              <div>
                <p class="text-xs uppercase tracking-[0.16em] text-muted lg:hidden">Username</p>
                <p class="text-sm font-medium text-highlighted">{{ item.username }}</p>
              </div>

              <div>
                <p class="text-xs uppercase tracking-[0.16em] text-muted lg:hidden">Password</p>
                <p class="text-sm text-muted">Disimpan aman di backend</p>
              </div>

              <div class="flex items-start gap-1 lg:justify-end">
                <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEdit(item)" />
                <UButton
                  icon="i-lucide-trash"
                  size="xs"
                  variant="ghost"
                  color="error"
                  :loading="deleteLoading === item.id"
                  @click="confirmDelete(item)"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="modalOpen" :title="mode === 'create' ? 'Tambah User' : 'Edit User'">
    <template #body>
      <div class="grid gap-4">
        <UFormField label="Nama" required>
          <UInput v-model="form.name" placeholder="Nama lengkap" />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="NIK" required>
          <UInput v-model="form.nik" placeholder="NIK / nomor identitas" />
          <p v-if="validationErrors.nik" class="mt-1 text-xs text-error">
            {{ validationErrors.nik }}
          </p>
        </UFormField>

          <UFormField label="Role" required>
            <select
              v-model="form.role"
              class="h-10 w-full rounded-md border border-default bg-default px-3 text-sm text-highlighted outline-none ring-0 focus:ring-2 focus:ring-primary/20"
            >
              <option v-for="option in roleOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </UFormField>
        </div>

        <UFormField label="Email" required>
          <UInput v-model="form.email" type="email" placeholder="nama@domain.com" />
          <p v-if="validationErrors.email" class="mt-1 text-xs text-error">
            {{ validationErrors.email }}
          </p>
        </UFormField>

        <UFormField label="Username" required>
          <UInput v-model="form.username" placeholder="Username login" />
          <p v-if="validationErrors.username" class="mt-1 text-xs text-error">
            {{ validationErrors.username }}
          </p>
        </UFormField>

        <UFormField :label="mode === 'create' ? 'Password' : 'Password Baru'" :required="mode === 'create'">
          <UInput
            v-model="form.password"
            :type="'password'"
            :placeholder="mode === 'create' ? 'Password akun' : 'Kosongkan jika tidak diubah'"
          />
        </UFormField>

        <p class="text-xs leading-6 text-muted">
          User dapat login menggunakan username atau NIK. Password hanya disimpan di backend dan tidak ditampilkan di daftar.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Batal" color="neutral" variant="subtle" @click="modalOpen = false" />
        <UButton :label="mode === 'create' ? 'Simpan' : 'Perbarui'" color="primary" :loading="submitting" @click="saveUser" />
      </div>
    </template>
  </UModal>
</template>
