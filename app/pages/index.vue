<script setup lang="ts">
import type { DashboardStat, Employee } from '~/types'

const { data: employeesRes } = await useFetch<{ data: Employee[] }>('/api/employees', { lazy: true })

const employees = computed<Employee[]>(() => employeesRes.value?.data ?? [])

const stats = computed<DashboardStat[]>(() => {
  const list = employees.value ?? []
  const total = list.length
  const mitra = list.filter(e => e.employmentStatus === 'MITRA').length
  const kontrak = list.filter(e => e.employmentStatus === 'KONTRAK').length

  return [
    {
      title: 'Total Karyawan',
      icon: 'i-lucide-users',
      value: total,
      description: 'Seluruh karyawan terdaftar',
      color: 'primary'
    },
    {
      title: 'Status MITRA',
      icon: 'i-lucide-user-check',
      value: mitra,
      description: 'Karyawan berstatus Mitra',
      color: 'success'
    },
    {
      title: 'Status KONTRAK',
      icon: 'i-lucide-file-text',
      value: kontrak,
      description: 'Karyawan berstatus Kontrak',
      color: 'warning'
    },
    {
      title: 'Kontrak Akan Habis',
      icon: 'i-lucide-alarm-clock',
      value: 0,
      description: 'Dalam 30 hari ke depan',
      color: 'error'
    }
  ]
})

// Distribusi per lokasi kerja
const locationDist = computed(() => {
  const list = employees.value ?? []
  const map: Record<string, number> = {}
  for (const e of list) {
    const loc = e.workLocation?.name ?? 'Tidak Diketahui'
    map[loc] = (map[loc] ?? 0) + 1
  }
  return Object.entries(map).map(([name, count]) => ({ name, count }))
})

// Distribusi per job level
const levelDist = computed(() => {
  const list = employees.value
  const map: Record<string, number> = {}
  for (const e of list) {
    const level = e.jobLevel?.name ?? 'Tidak Diketahui'
    map[level] = (map[level] ?? 0) + 1
  }
  return Object.entries(map).map(([name, count]) => ({ name, count }))
})

const colorMap: Record<string, string> = {
  primary: 'bg-primary/10 ring-primary/25 text-primary',
  success: 'bg-green-500/10 ring-green-500/25 text-green-500',
  warning: 'bg-amber-500/10 ring-amber-500/25 text-amber-500',
  error: 'bg-red-500/10 ring-red-500/25 text-red-500'
}
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Dashboard" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Stats -->
      <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px mb-6">
        <UPageCard
          v-for="(stat, index) in stats"
          :key="index"
          :icon="stat.icon"
          :title="stat.title"
          variant="subtle"
          :ui="{
            container: 'gap-y-1.5',
            wrapper: 'items-start',
            leading: `p-2.5 rounded-full ring ring-inset flex-col ${colorMap[stat.color ?? 'primary']}`,
            title: 'font-normal text-muted text-xs uppercase'
          }"
          class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
        >
          <div class="flex items-center gap-2">
            <span class="text-2xl font-semibold text-highlighted">
              {{ stat.value }}
            </span>
          </div>
          <p class="text-xs text-muted mt-1">{{ stat.description }}</p>
        </UPageCard>
      </UPageGrid>

      <!-- Distribusi -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Lokasi Kerja -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-map-pin" class="size-4 text-muted" />
              <span class="font-semibold text-sm">Distribusi Lokasi Kerja</span>
            </div>
          </template>
          <div class="space-y-3">
            <div
              v-for="item in locationDist"
              :key="item.name"
              class="flex items-center gap-3"
            >
              <span class="text-sm text-highlighted w-24 shrink-0">{{ item.name }}</span>
              <div class="flex-1 bg-accented rounded-full h-2">
                <div
                  class="bg-primary h-2 rounded-full transition-all"
                  :style="{ width: `${(item.count / (employees?.length || 1)) * 100}%` }"
                />
              </div>
              <span class="text-sm font-medium text-highlighted w-6 text-right">{{ item.count }}</span>
            </div>
          </div>
        </UCard>

        <!-- Job Level -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-bar-chart-2" class="size-4 text-muted" />
              <span class="font-semibold text-sm">Distribusi Level Jabatan</span>
            </div>
          </template>
          <div class="space-y-3">
            <div
              v-for="item in levelDist"
              :key="item.name"
              class="flex items-center gap-3"
            >
              <span class="text-sm text-highlighted w-24 shrink-0">{{ item.name }}</span>
              <div class="flex-1 bg-accented rounded-full h-2">
                <div
                  class="bg-primary h-2 rounded-full transition-all"
                  :style="{ width: `${(item.count / (employees?.length || 1)) * 100}%` }"
                />
              </div>
              <span class="text-sm font-medium text-highlighted w-6 text-right">{{ item.count }}</span>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
