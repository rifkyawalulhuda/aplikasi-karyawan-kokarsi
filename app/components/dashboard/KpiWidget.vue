<script setup lang="ts">
import type { DashboardStats } from '~/types/dashboard'
import { DASHBOARD_WIDGET_MAP } from './registry'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const widget = DASHBOARD_WIDGET_MAP.kpi!

const statCards = computed(() => [
  {
    title: 'Total Karyawan',
    icon: 'i-lucide-users',
    value: props.stats?.total ?? 0,
    description: 'Seluruh karyawan terdaftar',
    color: 'text-primary',
    bg: 'bg-primary/10',
    ring: 'ring-primary/20',
    to: '/karyawan'
  },
  {
    title: 'Status Aktif',
    icon: 'i-lucide-user-check',
    value: props.stats?.aktif ?? 0,
    description: 'Karyawan dengan kontrak aktif',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    ring: 'ring-green-500/20',
    to: '/karyawan?status=AKTIF'
  },
  {
    title: 'Kontrak Expired',
    icon: 'i-lucide-file-warning',
    value: props.stats?.kontrakExpired ?? 0,
    description: 'Karyawan tanpa kontrak aktif',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/20',
    to: '/karyawan?status=KONTRAK_EXPIRED'
  },
  {
    title: 'Status Resign',
    icon: 'i-lucide-log-out',
    value: props.stats?.resign ?? 0,
    description: 'Keluar secara resign',
    color: 'text-slate-500',
    bg: 'bg-slate-500/10',
    ring: 'ring-slate-500/20',
    to: '/karyawan?status=RESIGN'
  },
  {
    title: 'Status PHK',
    icon: 'i-lucide-user-round-x',
    value: props.stats?.phk ?? 0,
    description: 'Keluar karena PHK',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    ring: 'ring-rose-500/20',
    to: '/karyawan?status=PHK'
  },
  {
    title: 'Kontrak Akan Habis',
    icon: 'i-lucide-alarm-clock',
    value: props.stats?.expiringContracts ?? 0,
    description: 'Dalam 30 hari ke depan',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    ring: 'ring-red-500/20',
    to: '/kontrak?status=AKAN_HABIS'
  },
  {
    title: 'Sertifikasi Akan Expired',
    icon: 'i-lucide-file-badge',
    value: props.stats?.expiringSoon?.certifications?.count ?? 0,
    description: 'Dalam 30 hari ke depan',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    ring: 'ring-orange-500/20',
    to: '/dokumen/sertifikasi-ijin'
  },
  {
    title: 'SP Aktif',
    icon: 'i-lucide-alert-triangle',
    value: props.stats?.expiringSoon?.activeWarnings ?? 0,
    description: 'Surat peringatan masih berlaku',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    ring: 'ring-purple-500/20',
    to: '/dokumen/surat-peringatan'
  }
])
</script>

<template>
  <DashboardWidgetShell :widget="widget" variant="bare">
    <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-8">
      <template v-if="loading">
        <UCard v-for="i in 8" :key="`skel-${i}`" :ui="{ body: 'p-4 sm:p-5' }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
              <div class="h-8 w-1/2 animate-pulse rounded bg-accented" />
              <div class="h-3 w-3/4 animate-pulse rounded bg-accented" />
            </div>
            <div class="size-10 shrink-0 animate-pulse rounded-xl bg-accented" />
          </div>
        </UCard>
      </template>

      <template v-else>
        <NuxtLink
          v-for="(card, i) in statCards"
          :key="i"
          :to="card.to"
          class="group block cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default"
        >
          <UCard
            class="h-full transition-all duration-200 group-hover:ring-1 group-hover:ring-default"
            :ui="{ body: 'p-4 sm:p-5' }"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-xs font-medium uppercase tracking-wide text-muted">{{ card.title }}</p>
                <p class="mt-1 text-2xl font-bold tabular-nums text-highlighted sm:text-3xl">
                  <DashboardCountUp :value="card.value" />
                </p>
                <p class="mt-1 truncate text-xs text-muted">{{ card.description }}</p>
              </div>
              <div :class="['shrink-0 rounded-xl p-2.5 ring ring-inset', card.bg, card.ring]">
                <UIcon :name="card.icon" :class="['size-5', card.color]" />
              </div>
            </div>
          </UCard>
        </NuxtLink>
      </template>
    </div>
  </DashboardWidgetShell>
</template>
