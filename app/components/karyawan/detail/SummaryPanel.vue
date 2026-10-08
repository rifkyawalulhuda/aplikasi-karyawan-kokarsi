<script setup lang="ts">
import type { Employee } from '~/types'
import { formatDateId } from '~/utils/employee-metrics'

const props = defineProps<{
  employee: Employee
}>()

const educationLabelMap: Record<string, string> = {
  SMA: 'SMA/SMK', D3: 'D3', S1: 'S1', S2: 'S2'
}

const genderLabelMap: Record<string, string> = {
  MALE: 'Laki-laki', FEMALE: 'Perempuan'
}

const workItems = computed(() => [
  { label: 'Site', value: props.employee.workLocation?.name ?? '-', icon: 'i-lucide-map-pin' },
  { label: 'Pekerjaan', value: props.employee.jobRole?.name ?? '-', icon: 'i-lucide-briefcase' },
  { label: 'Departemen', value: props.employee.department?.name ?? '-', icon: 'i-lucide-building-2' },
  { label: 'Level Jabatan', value: props.employee.jobLevel?.name ?? '-', icon: 'i-lucide-layers' },
  { label: 'Tgl. Bergabung', value: formatDateId(props.employee.joinDate), icon: 'i-lucide-calendar' }
])

const personalItems = computed(() => [
  { label: 'NIK', value: props.employee.nik ?? '-', icon: 'i-lucide-id-card' },
  { label: 'No. Anggota', value: props.employee.memberNo ?? '-', icon: 'i-lucide-badge' },
  { label: 'Tempat Lahir', value: props.employee.birthPlace ?? '-', icon: 'i-lucide-map' },
  { label: 'Tgl. Lahir', value: formatDateId(props.employee.birthDate), icon: 'i-lucide-cake' },
  { label: 'Jenis Kelamin', value: genderLabelMap[props.employee.gender] ?? props.employee.gender, icon: 'i-lucide-user' },
  { label: 'Pendidikan', value: educationLabelMap[props.employee.educationLevel] ?? props.employee.educationLevel, icon: 'i-lucide-graduation-cap' },
  { label: 'Status Pajak', value: props.employee.taxStatus?.name ?? '-', icon: 'i-lucide-receipt-text' },
  { label: 'Rekening', value: props.employee.bankAccountNumber ?? '-', icon: 'i-lucide-credit-card' }
])
</script>

<template>
  <div class="space-y-4">
    <!-- Data Pekerjaan -->
    <section class="dossier-rise rounded-2xl border border-default bg-default">
      <header class="flex items-center gap-2 border-b border-default p-4">
        <UIcon name="i-lucide-briefcase" class="size-4 text-muted" aria-hidden="true" />
        <h2 class="text-base font-semibold text-highlighted">
          Data Pekerjaan
        </h2>
      </header>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
        <div v-for="item in workItems" :key="item.label" class="flex items-start gap-3">
          <UIcon :name="item.icon" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <div class="min-w-0">
            <dt class="text-xs text-muted">
              {{ item.label }}
            </dt>
            <dd class="truncate text-sm font-medium text-highlighted">
              {{ item.value }}
            </dd>
          </div>
        </div>
      </dl>
    </section>

    <!-- Data Pribadi -->
    <section class="dossier-rise rounded-2xl border border-default bg-default" style="animation-delay: 60ms">
      <header class="flex items-center gap-2 border-b border-default p-4">
        <UIcon name="i-lucide-user-round" class="size-4 text-muted" aria-hidden="true" />
        <h2 class="text-base font-semibold text-highlighted">
          Data Pribadi
        </h2>
      </header>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
        <div v-for="item in personalItems" :key="item.label" class="flex items-start gap-3">
          <UIcon :name="item.icon" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <div class="min-w-0">
            <dt class="text-xs text-muted">
              {{ item.label }}
            </dt>
            <dd class="truncate text-sm font-medium text-highlighted">
              {{ item.value }}
            </dd>
          </div>
        </div>
        <!-- Alamat -->
        <div class="flex items-start gap-3 sm:col-span-2">
          <UIcon name="i-lucide-home" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <div class="min-w-0">
            <dt class="text-xs text-muted">
              Alamat
            </dt>
            <dd class="text-sm font-medium text-highlighted">
              {{ employee.address ?? '-' }}
            </dd>
          </div>
        </div>
      </dl>
    </section>
  </div>
</template>
