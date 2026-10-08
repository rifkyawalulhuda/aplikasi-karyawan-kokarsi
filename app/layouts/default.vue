<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)
/** Buka/tutup command palette Global Search (dipicu tombol sidebar & Ctrl K). */
const searchOpen = ref(false)
const auth = useAuthStore()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleColorMode() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

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
    label: 'Struktur Organisasi',
    icon: 'i-lucide-network',
    to: '/struktur-organisasi',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Kontrak',
    icon: 'i-lucide-file-text',
    to: '/kontrak',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Kalender',
    icon: 'i-lucide-calendar-days',
    to: '/kalender',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Pemakaian Kendaraan',
    icon: 'i-lucide-car-front',
    to: '/operasional/pemakaian-kendaraan',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Space',
    icon: 'i-lucide-kanban',
    to: '/spaces',
    onSelect: () => { open.value = false },
  },
  {
    label: 'Dokumen Karyawan',
    icon: 'i-lucide-file-badge',
    defaultOpen: true,
    type: 'trigger',
    children: [
      {
        label: 'Dok. Karyawan',
        to: '/dokumen/dok-karyawan',
        onSelect: () => { open.value = false },
      },
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
      {
        label: 'Arsip Umum',
        to: '/dokumen-legal/arsip-umum',
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
      auth.canManageMasterData
        ? {
            label: 'Log Aktivitas',
            to: '/settings/activity-log',
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
        <!-- Rail (collapsed) hanya 64px: menumpuk logo (40px) + lonceng (32px)
             = 76px sehingga tombol logo terpotong atasnya dan lonceng meluber
             ke baris pencarian. Saat collapsed cukup logo saja; lonceng
             dipindah ke area menu di bawah (lihat slot #default). -->
        <div :class="collapsed ? 'flex items-center justify-center w-full' : 'flex items-center justify-between w-full gap-2'">
          <TeamsMenu :collapsed="collapsed" />
          <NotificationBell v-if="!collapsed" :collapsed="collapsed" />
        </div>
      </template>

      <template #default="{ collapsed }">
        <GlobalSearchTrigger :collapsed="collapsed" @open="searchOpen = true" />

        <!-- Rail: lonceng notifikasi sejajar dengan ikon menu lain. Tooltip
             kanan tetap memberi label, jadi fungsinya tidak hilang saat tutup. -->
        <NotificationBell v-if="collapsed" collapsed />

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

    <!-- Command palette Global Search (satu modal, responsif). -->
    <GlobalSearch v-model:open="searchOpen" />

    <slot />
  </UDashboardGroup>
</template>
