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
      employeeDocuments: any[]
      vendorContracts: any[]
      legalKoperasi: any[]
      akteDokumen: any[]
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

    if (results.employeeDocuments?.length) {
      groups.push({
        id: 'employeeDocuments',
        label: 'Sertifikasi & Ijin',
        ignoreFilter: true,
        items: results.employeeDocuments.map((doc: any) => ({
          id: `edoc-${doc.id}`,
          label: `${doc.documentType?.name ?? 'Dokumen'}`,
          suffix: `${doc.employee?.fullName ?? ''}`,
          icon: 'i-lucide-file-badge',
          to: '/dokumen/sertifikasi-ijin',
        })),
      })
    }

    if (results.vendorContracts?.length) {
      groups.push({
        id: 'vendorContracts',
        label: 'Kontrak Vendor',
        ignoreFilter: true,
        items: results.vendorContracts.map((vc: any) => ({
          id: `vc-${vc.id}`,
          label: `${vc.documentName}`,
          suffix: `${vc.company?.name ?? ''}`,
          icon: 'i-lucide-building-2',
          to: `/dokumen-legal/kontrak-vendor?openId=${vc.id}`,
        })),
      })
    }

    if (results.legalKoperasi?.length) {
      groups.push({
        id: 'legalKoperasi',
        label: 'Legal Koperasi',
        ignoreFilter: true,
        items: results.legalKoperasi.map((lk: any) => ({
          id: `lk-${lk.id}`,
          label: `${lk.documentName}`,
          suffix: `${lk.publisher}`,
          icon: 'i-lucide-file-signature',
          to: `/dokumen-legal/legal-koperasi?openId=${lk.id}`,
        })),
      })
    }

    if (results.akteDokumen?.length) {
      groups.push({
        id: 'akteDokumen',
        label: 'Akte Dokumen',
        ignoreFilter: true,
        items: results.akteDokumen.map((a: any) => ({
          id: `akte-${a.id}`,
          label: a.judulAkte,
          suffix: a.nomorAkte,
          icon: 'i-lucide-scroll-text',
          to: `/dokumen-legal/akte-dokumen?openId=${a.id}`,
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
    label: 'Dokumen Legal',
    icon: 'i-lucide-file-signature',
    defaultOpen: true,
    type: 'trigger',
    children: [
      {
        label: 'Kontrak Customer/Vendor',
        to: '/dokumen-legal/kontrak-vendor',
        onSelect: () => { open.value = false },
      },
      {
        label: 'Legal Koperasi',
        to: '/dokumen-legal/legal-koperasi',
        onSelect: () => { open.value = false },
      },
      {
        label: 'Akte Dokumen',
        to: '/dokumen-legal/akte-dokumen',
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
        <NotificationBell :collapsed="collapsed" />
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
        <UserMenu :collapsed="collapsed" class="flex-1 min-w-0" />
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
