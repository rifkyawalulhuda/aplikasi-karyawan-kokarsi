<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const open = ref(false)
const auth = useAuthStore()

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

const groups = computed<any[]>(() => [{
  id: 'links',
  label: 'Navigasi',
  items: links.value as any
}])
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
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
