<script setup lang="ts">
import type { Employee } from '~/types'

const props = defineProps<{
  employee: Employee
}>()

function formatDate(val: string | undefined) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const educationLabelMap: Record<string, string> = {
  SMA: 'SMA/SMK', D3: 'D3', S1: 'S1', S2: 'S2',
}

const genderLabelMap: Record<string, string> = {
  MALE: 'Laki-laki', FEMALE: 'Perempuan',
}

const workItems = computed(() => [
  { label: 'Site', value: props.employee.workLocation?.name ?? '-', icon: 'i-lucide-map-pin' },
  { label: 'Pekerjaan', value: props.employee.jobRole?.name ?? '-', icon: 'i-lucide-briefcase' },
  { label: 'Departemen', value: props.employee.department?.name ?? '-', icon: 'i-lucide-building-2' },
  { label: 'Level Jabatan', value: props.employee.jobLevel?.name ?? '-', icon: 'i-lucide-layers' },
  { label: 'Tgl. Bergabung', value: formatDate(props.employee.joinDate), icon: 'i-lucide-calendar' },
])

const personalItems = computed(() => [
  { label: 'NIK', value: props.employee.nik ?? '-', icon: 'i-lucide-id-card' },
  { label: 'Tempat Lahir', value: props.employee.birthPlace ?? '-', icon: 'i-lucide-map' },
  { label: 'Tgl. Lahir', value: formatDate(props.employee.birthDate), icon: 'i-lucide-cake' },
  { label: 'Jenis Kelamin', value: genderLabelMap[props.employee.gender] ?? props.employee.gender, icon: 'i-lucide-user' },
  { label: 'Pendidikan', value: educationLabelMap[props.employee.educationLevel] ?? props.employee.educationLevel, icon: 'i-lucide-graduation-cap' },
  { label: 'Status Pajak', value: props.employee.taxStatus?.name ?? '-', icon: 'i-lucide-receipt-text' },
  { label: 'Alamat', value: props.employee.address ?? '-', icon: 'i-lucide-home' },
])
</script>

<template>
  <div class="space-y-5">
    <!-- Data Pekerjaan -->
    <div>
      <h2 class="text-base font-semibold text-highlighted mb-3">Data Pekerjaan</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          v-for="item in workItems"
          :key="item.label"
          class="flex items-start gap-3 p-4 rounded-lg bg-default border border-default"
        >
          <UIcon :name="item.icon" class="w-5 h-5 text-muted mt-0.5 shrink-0" />
          <div class="min-w-0">
            <p class="text-xs text-muted mb-0.5">{{ item.label }}</p>
            <p class="text-sm font-medium text-highlighted truncate">{{ item.value }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Pribadi -->
    <div>
      <h2 class="text-base font-semibold text-highlighted mb-3">Data Pribadi</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          v-for="item in personalItems"
          :key="item.label"
          class="flex items-start gap-3 p-4 rounded-lg bg-default border border-default"
          :class="item.label === 'Alamat' ? 'sm:col-span-3' : ''"
        >
          <UIcon :name="item.icon" class="w-5 h-5 text-muted mt-0.5 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="text-xs text-muted mb-0.5">{{ item.label }}</p>
            <p class="text-sm font-medium text-highlighted" :class="item.label === 'Alamat' ? '' : 'truncate'">{{ item.value }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
