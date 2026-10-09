<script setup lang="ts">
import type { DashboardStats } from '~/types/dashboard'
import { DASHBOARD_WIDGET_MAP } from './registry'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const widget = DASHBOARD_WIDGET_MAP.attention!
const { unreadCount } = useNotifications()

const totalAttentionCount = computed(() => {
  const es = props.stats?.expiringSoon
  if (!es) return 0
  return (es.contracts?.count ?? 0)
    + (es.vendorContracts?.count ?? 0)
    + (es.legalKoperasi?.count ?? 0)
    + (es.certifications?.count ?? 0)
    + (es.activeWarnings ?? 0)
    + unreadCount.value
})
</script>

<template>
  <DashboardWidgetShell :widget="widget" variant="bare">
    <template #badge>
      <span
        v-if="!loading && totalAttentionCount > 0"
        class="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500"
      >{{ totalAttentionCount }}</span>
    </template>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-6 xl:grid-cols-3">
      <template v-if="loading">
        <UCard v-for="i in 4" :key="`att-skel-${i}`" :ui="{ body: 'p-4' }">
          <div class="space-y-2">
            <div class="h-4 w-1/2 animate-pulse rounded bg-accented" />
            <div class="h-3 w-3/4 animate-pulse rounded bg-accented" />
            <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
          </div>
        </UCard>
      </template>

      <template v-else>
        <DashboardAttentionCard
          title="Kontrak Akan Habis"
          :count="stats?.expiringSoon?.contracts?.count ?? 0"
          :items="stats?.expiringSoon?.contracts?.items ?? []"
          icon="i-lucide-file-text"
          color-class="text-red-500 bg-red-500/10"
          to="/kontrak"
        />
        <DashboardAttentionCard
          title="Kontrak Vendor"
          :count="stats?.expiringSoon?.vendorContracts?.count ?? 0"
          :items="stats?.expiringSoon?.vendorContracts?.items ?? []"
          icon="i-lucide-building-2"
          color-class="text-orange-500 bg-orange-500/10"
          to="/dokumen-legal/kontrak-vendor"
        />
        <DashboardAttentionCard
          title="Legal Koperasi"
          :count="stats?.expiringSoon?.legalKoperasi?.count ?? 0"
          :items="stats?.expiringSoon?.legalKoperasi?.items ?? []"
          icon="i-lucide-file-signature"
          color-class="text-amber-500 bg-amber-500/10"
          to="/dokumen-legal/legal-koperasi"
        />
        <DashboardAttentionCard
          title="Sertifikasi Akan Expired"
          :count="stats?.expiringSoon?.certifications?.count ?? 0"
          :items="stats?.expiringSoon?.certifications?.items ?? []"
          icon="i-lucide-file-badge"
          color-class="text-sky-500 bg-sky-500/10"
          to="/dokumen/sertifikasi-ijin"
        />
        <DashboardAttentionCard
          title="Surat Peringatan Aktif"
          :count="stats?.expiringSoon?.activeWarnings ?? 0"
          :items="[]"
          icon="i-lucide-alert-triangle"
          color-class="text-purple-500 bg-purple-500/10"
          to="/dokumen/surat-peringatan"
        />
        <DashboardAttentionCard
          title="Notifikasi"
          :count="unreadCount"
          :items="[]"
          icon="i-lucide-bell"
          color-class="text-green-500 bg-green-500/10"
          to="/notifications"
        />
      </template>
    </div>
  </DashboardWidgetShell>
</template>
