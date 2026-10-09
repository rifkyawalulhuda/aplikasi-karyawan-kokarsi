<script setup lang="ts">
import { DASHBOARD_WIDGET_MAP } from './registry'

const widget = DASHBOARD_WIDGET_MAP.quick!

const actions = [
  { to: '/karyawan', icon: 'i-lucide-users', label: 'Data Karyawan' },
  { to: '/kontrak', icon: 'i-lucide-file-text', label: 'Kontrak' },
  { to: '/settings/master-data', icon: 'i-lucide-database', label: 'Master Data' },
  { to: '/settings', icon: 'i-lucide-settings', label: 'Pengaturan' }
]
</script>

<template>
  <DashboardWidgetShell :widget="widget">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <UButton
        v-for="action in actions"
        :key="action.to"
        :to="action.to"
        color="neutral"
        variant="subtle"
        :icon="action.icon"
        :label="action.label"
        class="cursor-pointer justify-start"
      />
    </div>
  </DashboardWidgetShell>
</template>
