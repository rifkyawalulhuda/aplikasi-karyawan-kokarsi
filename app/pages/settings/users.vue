<script setup lang="ts">
import type { AdminRole, UserAccount } from '~/types'
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const UAvatar = resolveComponent('UAvatar')

const toast = useToast()
const auth = useAuthStore()
const { confirmDeleteToast } = useConfirmDeleteToast()

const users = ref<UserAccount[]>([])
const loading = ref(false)
const deleteLoading = ref<number | null>(null)

const modalOpen = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const modalUser = ref<UserAccount | null>(null)

const table = useTemplateRef('table')
const searchQuery = ref('')
const roleFilter = ref<'all' | AdminRole>('all')
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]
const sorting = ref<{ key: string, direction: 'asc' | 'desc' } | null>(null)

const roleOptions: Array<{ label: string, value: AdminRole }> = [
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Pengelola Koperasi', value: 'PENGELOLA_KOPERASI' }
]

const roleFilterItems = [
  { label: 'Semua role', value: 'all' },
  ...roleOptions.map(option => ({ label: option.label, value: option.value }))
]

// ── Data ────────────────────────────────────────────────────────────────────
async function loadUsers() {
  loading.value = true
  try {
    users.value = await $fetch<UserAccount[]>('/api/users')
  } catch {
    toast.add({
      title: 'Gagal memuat user',
      description: 'Pastikan backend user sudah berjalan dan database memiliki tabel user_accounts.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

function roleLabel(role: AdminRole) {
  return role === 'ADMIN' ? 'Admin' : 'Pengelola Koperasi'
}

/** Akun yang sedang dipakai di sesi ini (tidak boleh menghapus dirinya sendiri). */
function isSelf(user: UserAccount) {
  return auth.admin?.accountType === 'user_account' && auth.admin?.id === user.id
}

const selfUser = computed(() => users.value.find(user => isSelf(user)) ?? null)

const stats = computed(() => {
  const total = users.value.length
  const admin = users.value.filter(item => item.role === 'ADMIN').length
  const pengelola = total - admin
  return [
    {
      key: 'total',
      label: 'Total Akun',
      value: total,
      detail: 'Terdaftar di sistem',
      icon: 'i-lucide-users-round',
      tone: 'text-primary bg-primary/10'
    },
    {
      key: 'admin',
      label: 'Admin',
      value: admin,
      detail: total ? `${Math.round((admin / total) * 100)}% dari total akun` : 'Belum ada akun',
      icon: 'i-lucide-shield-check',
      tone: 'text-warning bg-warning/10'
    },
    {
      key: 'pengelola',
      label: 'Pengelola Koperasi',
      value: pengelola,
      detail: total ? `${Math.round((pengelola / total) * 100)}% dari total akun` : 'Belum ada akun',
      icon: 'i-lucide-user-cog',
      tone: 'text-info bg-info/10'
    }
  ]
})

// ── Aksi ────────────────────────────────────────────────────────────────────
function openCreate() {
  modalMode.value = 'create'
  modalUser.value = null
  modalOpen.value = true
}

function openEdit(user: UserAccount) {
  modalMode.value = 'edit'
  modalUser.value = user
  modalOpen.value = true
}

function confirmDelete(user: UserAccount) {
  if (isSelf(user)) {
    toast.add({
      title: 'Tidak dapat menghapus akun sendiri',
      description: 'Akun yang sedang Anda gunakan tidak bisa dihapus dari halaman ini.',
      color: 'warning'
    })
    return
  }

  confirmDeleteToast({
    title: 'Hapus user?',
    description: `Akun ${user.name} (${user.username}) akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus User',
    onConfirm: () => deleteUser(user.id)
  })
}

async function deleteUser(id: number) {
  deleteLoading.value = id
  try {
    await $fetch(`/api/users/${id}`, { method: 'DELETE' })
    toast.add({ title: 'User berhasil dihapus', color: 'success' })
    await loadUsers()
  } catch (error) {
    const message = (error as { data?: { message?: string } })?.data?.message
      ?? (error as { message?: string })?.message
      ?? 'Terjadi kesalahan'
    toast.add({ title: 'Gagal menghapus user', description: message, color: 'error' })
  } finally {
    deleteLoading.value = null
  }
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} disalin`, color: 'success' })
  } catch {
    toast.add({ title: `Gagal menyalin ${label.toLowerCase()}`, color: 'error' })
  }
}

// ── Pencarian / filter / sortir ─────────────────────────────────────────────
function getSearchText(item: UserAccount) {
  return [
    item.name,
    item.nik,
    item.email,
    item.username,
    roleLabel(item.role)
  ]
    .flatMap(value => String(value ?? '').toLowerCase().split(/\s+/))
    .filter(Boolean)
    .join(' ')
}

function toggleSort(key: string) {
  if (sorting.value?.key !== key) {
    sorting.value = { key, direction: 'asc' }
    return
  }
  if (sorting.value.direction === 'asc') {
    sorting.value = { key, direction: 'desc' }
    return
  }
  sorting.value = null
}

function sortableHeader(label: string, key: string) {
  const isActive = sorting.value?.key === key
  const icon = !isActive
    ? 'i-lucide-arrow-up-down'
    : sorting.value?.direction === 'asc'
      ? 'i-lucide-arrow-up'
      : 'i-lucide-arrow-down'

  return h('button', {
    type: 'button',
    class: 'inline-flex items-center gap-1.5 py-1 text-left font-medium text-highlighted hover:text-primary transition-colors',
    onClick: () => toggleSort(key),
    title: `Urutkan ${label}`
  }, [
    h('span', label),
    h(UIcon, { name: icon, class: 'size-3.5 text-muted' })
  ])
}

interface IconButtonOptions {
  icon: string
  label: string
  color?: 'neutral' | 'error'
  loading?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}

/** Tombol aksi baris berukuran 36px agar tetap nyaman di layar sentuh. */
function iconButton(options: IconButtonOptions) {
  return h(UButton, {
    'icon': options.icon,
    'square': true,
    'variant': 'ghost',
    'color': options.color ?? 'neutral',
    'class': 'size-9',
    'loading': options.loading,
    'disabled': options.disabled,
    'title': options.title,
    'aria-label': options.label,
    'onClick': (event: MouseEvent) => {
      event.stopPropagation()
      options.onClick()
    }
  })
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string) {
  return name
    .trim()
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const filteredData = computed(() => {
  let list = users.value

  if (roleFilter.value !== 'all') {
    list = list.filter(user => user.role === roleFilter.value)
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    list = list.filter(user => getSearchText(user).includes(query))
  }

  const sort = sorting.value
  if (!sort) return list

  return [...list].sort((a, b) => {
    const aValue = String(a[sort.key as keyof UserAccount] ?? '')
    const bValue = String(b[sort.key as keyof UserAccount] ?? '')
    return sort.direction === 'asc'
      ? aValue.localeCompare(bValue, 'id')
      : bValue.localeCompare(aValue, 'id')
  })
})

const hasActiveFilters = computed(() => roleFilter.value !== 'all' || searchQuery.value.trim().length > 0)

function resetFilters() {
  searchQuery.value = ''
  roleFilter.value = 'all'
}

watch([searchQuery, roleFilter], async () => {
  pagination.value.pageIndex = 0
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

watch(() => pagination.value.pageSize, async () => {
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

// ── Menu kontekstual ────────────────────────────────────────────────────────
const contextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<UserAccount | null>(null)

async function openContextMenu(event: MouseEvent, user: UserAccount) {
  event.preventDefault()
  contextMenuTarget.value = user
  contextMenu.value = true
  await nextTick()
  const menu = document.querySelector('[data-user-context-menu]') as HTMLElement | null
  const width = menu?.offsetWidth ?? 200
  const height = menu?.offsetHeight ?? 180
  contextMenuX.value = Math.min(event.clientX, window.innerWidth - width - 8)
  contextMenuY.value = Math.min(event.clientY, window.innerHeight - height - 8)
}

function closeContextMenu() {
  contextMenu.value = false
}

// ── Kolom tabel ─────────────────────────────────────────────────────────────
const columns: TableColumn<UserAccount>[] = [
  {
    accessorKey: 'name',
    header: () => sortableHeader('Nama', 'name'),
    cell: ({ row }: { row: Row<UserAccount> }) => h('div', { class: 'flex items-center gap-3 min-w-0' }, [
      h(UAvatar, {
        alt: row.original.name,
        text: initials(row.original.name),
        size: 'sm',
        class: 'shrink-0 bg-primary/10 text-primary'
      }),
      h('div', { class: 'min-w-0' }, [
        h('div', { class: 'flex items-center gap-1.5' }, [
          h('p', { class: 'truncate font-medium text-sm text-highlighted' }, row.original.name),
          isSelf(row.original)
            ? h(UBadge, { color: 'primary', variant: 'subtle', size: 'sm', label: 'Anda' })
            : null
        ]),
        h('p', { class: 'truncate text-xs text-muted' }, `NIK ${row.original.nik}`)
      ])
    ])
  },
  {
    accessorKey: 'role',
    header: () => sortableHeader('Role', 'role'),
    cell: ({ row }: { row: Row<UserAccount> }) => h(UBadge, {
      color: row.original.role === 'ADMIN' ? 'warning' : 'info',
      variant: 'subtle',
      size: 'sm',
      label: roleLabel(row.original.role)
    })
  },
  {
    accessorKey: 'email',
    header: () => sortableHeader('Email', 'email'),
    cell: ({ row }: { row: Row<UserAccount> }) =>
      h('span', { class: 'block truncate text-sm text-muted', title: row.original.email }, row.original.email)
  },
  {
    accessorKey: 'username',
    header: () => sortableHeader('Username', 'username'),
    cell: ({ row }: { row: Row<UserAccount> }) =>
      h('span', { class: 'font-mono text-sm text-highlighted' }, row.original.username)
  },
  {
    accessorKey: 'createdAt',
    header: () => sortableHeader('Dibuat', 'createdAt'),
    cell: ({ row }: { row: Row<UserAccount> }) =>
      h('span', { class: 'text-sm text-muted tabular-nums' }, formatDate(row.original.createdAt))
  },
  {
    id: 'actions',
    header: () => h('span', { class: 'sr-only' }, 'Aksi'),
    cell: ({ row }: { row: Row<UserAccount> }) =>
      h('div', { class: 'flex justify-end gap-1' }, [
        iconButton({
          icon: 'i-lucide-pencil',
          label: `Edit ${row.original.name}`,
          onClick: () => openEdit(row.original)
        }),
        iconButton({
          icon: 'i-lucide-trash',
          label: `Hapus ${row.original.name}`,
          color: 'error',
          loading: deleteLoading.value === row.original.id,
          disabled: isSelf(row.original),
          title: isSelf(row.original) ? 'Akun sendiri tidak dapat dihapus' : undefined,
          onClick: () => confirmDelete(row.original)
        })
      ])
  }
]
</script>

<template>
  <UDashboardPanel id="settings-users">
    <template #header>
      <UDashboardNavbar title="User">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Tambah User"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
        <!-- Ringkasan akun -->
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            v-for="(stat, index) in stats"
            :key="stat.key"
            class="dossier-rise rounded-xl border border-default bg-default p-4"
            :style="{ animationDelay: `${index * 40}ms` }"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  {{ stat.label }}
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted tabular-nums">
                  {{ stat.value }}
                </p>
                <p class="mt-1 text-xs text-muted">
                  {{ stat.detail }}
                </p>
              </div>
              <span class="flex size-9 shrink-0 items-center justify-center rounded-lg" :class="stat.tone">
                <UIcon :name="stat.icon" class="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>

        <!-- Daftar user -->
        <UCard class="dossier-rise" :ui="{ body: 'p-0' }" style="animation-delay: 120ms">
          <template #header>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-highlighted">
                  Master User
                </h2>
                <p class="mt-1 text-xs text-muted">
                  Akun internal untuk login menggunakan username atau NIK. Klik baris untuk mengedit.
                </p>
              </div>
              <UBadge
                variant="subtle"
                color="neutral"
                size="sm"
                class="tabular-nums"
              >
                {{ users.length }} akun
              </UBadge>
            </div>
          </template>

          <!-- Toolbar -->
          <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <UInput
              v-model="searchQuery"
              class="w-full max-w-xs"
              icon="i-lucide-search"
              placeholder="Cari nama, NIK, email, username..."
              aria-label="Cari user"
            >
              <template v-if="searchQuery" #trailing>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  square
                  class="size-6"
                  aria-label="Hapus pencarian"
                  @click="searchQuery = ''"
                />
              </template>
            </UInput>

            <div class="flex items-center gap-2">
              <USelect
                v-model="roleFilter"
                :items="roleFilterItems"
                value-key="value"
                class="min-w-44"
                aria-label="Filter role"
              />
              <UButton
                v-if="hasActiveFilters"
                label="Reset"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="resetFilters"
              />
            </div>
          </div>

          <UTable
            ref="table"
            v-model:pagination="pagination"
            :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
            class="shrink-0"
            :data="filteredData"
            :columns="columns"
            :loading="loading"
            :on-select="(_e: any, row: any) => openEdit(row.original)"
            :on-contextmenu="(e: any, row: any) => openContextMenu(e, row.original)"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:hover:bg-elevated/40 [&>tr]:transition-colors',
              th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default',
              separator: 'h-0'
            }"
          >
            <template #empty>
              <div class="flex flex-col items-center gap-3 px-4 py-14 text-center">
                <span class="flex size-12 items-center justify-center rounded-full bg-elevated text-muted">
                  <UIcon :name="hasActiveFilters ? 'i-lucide-search-x' : 'i-lucide-users-round'" class="size-6" aria-hidden="true" />
                </span>
                <div>
                  <p class="text-sm font-medium text-highlighted">
                    {{ hasActiveFilters ? 'Tidak ada user yang cocok' : 'Belum ada akun user' }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    {{ hasActiveFilters
                      ? 'Ubah kata kunci atau reset filter untuk melihat semua akun.'
                      : 'Tambahkan akun pertama agar pengelola dapat masuk ke aplikasi.' }}
                  </p>
                </div>
                <UButton
                  v-if="hasActiveFilters"
                  label="Reset filter"
                  icon="i-lucide-rotate-ccw"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="resetFilters"
                />
                <UButton
                  v-else
                  label="Tambah User"
                  icon="i-lucide-plus"
                  color="primary"
                  size="sm"
                  @click="openCreate"
                />
              </div>
            </template>
          </UTable>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-4 py-3">
            <div class="flex items-center gap-2 text-sm text-muted">
              <span class="tabular-nums">{{ filteredData.length }} user</span>
              <USelect
                v-model="pagination.pageSize"
                :items="pageSizeOptions.map(n => ({ label: `${n} / hal`, value: n }))"
                value-key="value"
                class="w-28"
                aria-label="Jumlah baris per halaman"
              />
            </div>
            <UPagination
              :key="`pagination-${pagination.pageSize}-${pagination.pageIndex}`"
              :page="pagination.pageIndex + 1"
              :items-per-page="pagination.pageSize"
              :total="filteredData.length"
              @update:page="(p: number) => { pagination.pageIndex = p - 1; table?.tableApi?.setPageIndex(p - 1) }"
            />
          </div>
        </UCard>

        <p class="flex items-center gap-1.5 px-1 text-xs text-muted">
          <UIcon name="i-lucide-info" class="size-3.5 shrink-0" aria-hidden="true" />
          Password hanya disimpan terenkripsi di backend dan tidak pernah ditampilkan di daftar.
          <template v-if="selfUser">
            Akun <span class="font-medium text-highlighted">{{ selfUser.username }}</span> adalah akun yang sedang Anda gunakan.
          </template>
        </p>
      </div>
    </template>
  </UDashboardPanel>

  <SettingsUserFormModal
    v-model:open="modalOpen"
    :mode="modalMode"
    :user="modalUser"
    @saved="loadUsers"
  />

  <!-- Menu kontekstual baris -->
  <Teleport to="body">
    <div
      v-if="contextMenu"
      class="fixed inset-0 z-50"
      @click="closeContextMenu"
      @contextmenu.prevent="closeContextMenu"
    >
      <div
        data-user-context-menu
        class="absolute z-50 min-w-52 overflow-hidden rounded-xl border border-default bg-default py-1 shadow-xl"
        :style="{ top: `${contextMenuY}px`, left: `${contextMenuX}px` }"
        @click.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60"
          @click="openEdit(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-pencil" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          Edit User
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60"
          @click="copyToClipboard(contextMenuTarget!.username, 'Username'); closeContextMenu()"
        >
          <UIcon name="i-lucide-at-sign" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          Salin Username
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60"
          @click="copyToClipboard(contextMenuTarget!.email, 'Email'); closeContextMenu()"
        >
          <UIcon name="i-lucide-mail" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          Salin Email
        </button>

        <hr class="my-1 border-default">

        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
          :class="contextMenuTarget && isSelf(contextMenuTarget)
            ? 'cursor-not-allowed text-muted opacity-60'
            : 'text-error hover:bg-error/10'"
          :disabled="contextMenuTarget ? isSelf(contextMenuTarget) : false"
          @click="contextMenuTarget && !isSelf(contextMenuTarget) && (confirmDelete(contextMenuTarget), closeContextMenu())"
        >
          <UIcon name="i-lucide-trash" class="size-4 shrink-0" aria-hidden="true" />
          {{ contextMenuTarget && isSelf(contextMenuTarget) ? 'Hapus User (akun sendiri)' : 'Hapus User' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
