<script setup lang="ts">
import type { Employee, EmploymentStatus } from '~/types'

const props = defineProps<{
  employee: Employee
}>()

const emit = defineEmits<{
  edit: []
  offboard: []
}>()

const statusColorMap: Record<EmploymentStatus, string> = {
  AKTIF: 'success',
  KONTRAK_EXPIRED: 'warning',
  RESIGN: 'neutral',
  PHK: 'error',
}

const statusLabelMap: Record<EmploymentStatus, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK',
}

const canOffboard = computed(() =>
  props.employee.employmentStatus === 'AKTIF' || props.employee.employmentStatus === 'KONTRAK_EXPIRED'
)

const initials = computed(() =>
  (props.employee?.fullName ?? '').split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
)
</script>

<template>
  <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 bg-default rounded-xl border border-default">
    <!-- Avatar -->
    <div class="w-20 h-20 rounded-full overflow-hidden bg-elevated flex items-center justify-center shrink-0 ring-2 ring-primary/20">
      <img
        v-if="employee.fotoKaryawan"
        :src="employee.fotoKaryawan"
        :alt="employee.fullName"
        class="w-full h-full object-cover"
      />
      <span v-else class="text-2xl font-bold text-primary">{{ initials }}</span>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="flex flex-wrap items-center gap-2 mb-1">
        <h1 class="text-xl font-bold text-highlighted truncate">{{ employee.fullName }}</h1>
        <UBadge
          :color="(statusColorMap[employee.employmentStatus] as any)"
          variant="subtle"
          size="sm"
        >
          {{ statusLabelMap[employee.employmentStatus] }}
        </UBadge>
      </div>
      <p class="text-sm text-muted font-mono mb-1">{{ employee.employeeNo }}</p>
      <div class="flex flex-wrap gap-3 text-sm text-muted">
        <span v-if="employee.email" class="flex items-center gap-1">
          <UIcon name="i-lucide-mail" class="w-4 h-4" />
          {{ employee.email }}
        </span>
        <span v-if="employee.phoneNumber" class="flex items-center gap-1">
          <UIcon name="i-lucide-phone" class="w-4 h-4" />
          {{ employee.phoneNumber }}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 shrink-0">
      <UButton
        label="Kembali"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        to="/karyawan"
      />
      <UButton
        label="Edit Data"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        size="sm"
        @click="emit('edit')"
      />
      <UButton
        v-if="canOffboard"
        label="Offboarding"
        icon="i-lucide-user-x"
        color="error"
        variant="outline"
        size="sm"
        @click="emit('offboard')"
      />
    </div>
  </div>
</template>
