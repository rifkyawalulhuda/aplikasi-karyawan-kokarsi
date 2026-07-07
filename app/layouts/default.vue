<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const open = ref(false)
const auth = useAuthStore()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleColorMode() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

function employmentStatusLabel(status: string) {
  const map: Record<string, string> = {
    AKTIF: 'Aktif', KONTRAK_EXPIRED: 'Kontrak Expired', RESIGN: 'Resign', PHK: 'PHK',
  }
  return map[status] ?? status
}

function contractStatusLabel(status: string) {
  const map: Record<string, string> = {
    AKTIF: 'Aktif', AKAN_HABIS: 'Akan Habis', EXPIRED: 'Expired',
    SELESAI: 'Selesai', DIBATALKAN: 'Dibatalkan', DRAFT: 'Draft',
  }
  return map[status] ?? status
}

async function fetchGroups(query: string) {
  if (!query || query.trim().length < 2) return []

  try {
    const results = await $fetch<{
      employees: any[]
      contracts: any[]
      warningLetters: any[]
    }>(`/api/search?q=${encodeURIComponent(query.trim())}&limit=5`, {
      credentials: 'include',
    })

    const groups: any[] = []

    if (results.employees?.length) {
      groups.push({
        id: 'employees',
        label: 'Karyawan',
        ignoreFilter: true,
        items: results.employees.map((e: any) => ({
          id: `emp-${e.id}`,
          label: e.fullName,
          suffix: `${e.employeeNo} · ${employmentStatusLabel(e.employmentStatus)}`,
          icon: 'i-lucide-user',
          to: `/karyawan/${e.id}`,
        })),
      })
    }

    if (results.contracts?.length) {
      groups.push({
        id: 'contracts',
        label: 'Kontrak',
        ignoreFilter: true,
        items: results.contracts.map((c: any) => ({
          id: `contract-${c.id}`,
          label: c.contractNo,
          suffix: `${c.employee?.fullName ?? '-'} · ${contractStatusLabel(c.status)}`,
          icon: 'i-lucide-file-text',
          to: '/kontrak',
        })),
      })
    }

    if (results.warningLetters?.length) {
      groups.push({
        id: 'warning-letters',
        label: 'Surat Peringatan',
        ignoreFilter: true,
        items: results.warningLetters.map((l: any) => ({
          id: `sp-${l.id}`,
          label: l.letterNumber,
          suffix: `${l.employee?.fullName ?? '-'} · SP ${l.warningLevel}`,
          icon: 'i-lucide-alert-triangle',
          to: '/dokumen/surat-peringatan',
        })),
      })
    }

    return groups
  } catch {
    return []
  }
}

// Reactive search: watch search term, debounce, fetch results
const searchTerm = ref('')
const searchGroups = ref<any[]>([])
const searchLoading = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(searchTerm, (q) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  if (!q || q.trim().length < 2) {
    searchGroups.value = []
    return
  }
  searchLoading.value = true
  searchDebounce = setTimeout(async () => {
    searchGroups.value = await fetchGroups(q)
    searchLoading.value = false
  }, 200)
})

const links = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Data Karyawan',
    icon: 'i-lucide-users',
    to: '/karyawan',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Kontrak',
    icon: 'i-lucide-file-text',
    to: '/kontrak',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Dokumen Karyawan',
    icon: 'i-lucide-file-badge',
    defaultOpen: true,
    type: 'trigger',
    children: [
      {
        label: 'Surat Peringatan',
        to: '/dokumen/surat-peringatan',
        onSelect: () => { open.value = false },
      },
      {
        label: 'Sertifikasi & Ijin',
        to: '/dokumen/sertifikasi-ijin',
        onSelect: () => { open.value = false },
      },
    ],
  },
  {
    label: 'Pengaturan',
    to: '/settings',
    icon: 'i-lucide-settings',
    defaultOpen: true,
    type: 'trigger',
    children: [
      {
        label: 'Umum',
        to: '/settings',
        exact: true,
        onSelect: () => { open.value = false },
      },
      auth.canManageMasterData
        ? {
            label: 'Master Data',
            to: '/settings/master-data',
            onSelect: () => { open.value = false },
          }
        : null,
      auth.canManageMasterData
        ? {
            label: 'Template Kontrak',
            to: '/settings/contract-templates',
            onSelect: () => { open.value = false },
          }
        : null,
      auth.canManageMasterData
        ? {
            label: 'User',
            to: '/settings/users',
            onSelect: () => { open.value = false },
          }
        : null,
      {
        label: 'Keamanan',
        to: '/settings/security',
        onSelect: () => { open.value = false },
      },
    ].filter(Boolean) as NavigationMenuItem[],
  },
])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex items-center gap-1" :class="collapsed ? 'flex-col' : 'flex-row'">
          <UButton
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            color="neutral"
            variant="ghost"
            square
            :aria-label="isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'"
            :tooltip="collapsed ? (isDark ? 'Tema Terang' : 'Tema Gelap') : undefined"
            @click="toggleColorMode"
          />
          <UserMenu :collapsed="collapsed" class="flex-1 min-w-0" />
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch
      v-model:search-term="searchTerm"
      :groups="searchGroups"
      :loading="searchLoading"
    />

    <slot />
  </UDashboardGroup>
</template>
