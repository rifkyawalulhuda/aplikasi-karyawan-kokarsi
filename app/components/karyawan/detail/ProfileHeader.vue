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

// Photo preview
const photoPreview = ref(false)
</script>

<template>
  <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 bg-default rounded-xl border border-default">
    <!-- Avatar -->
    <div class="w-20 h-20 rounded-full overflow-hidden bg-elevated flex items-center justify-center shrink-0 ring-2 ring-primary/20">
      <button
        v-if="employee.fotoKaryawan"
        type="button"
        class="w-full h-full cursor-zoom-in"
        @click="photoPreview = true"
      >
        <img
          :src="employee.fotoKaryawan"
          :alt="employee.fullName"
          class="w-full h-full object-cover hover:opacity-90 transition-opacity"
        />
      </button>
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

  <!-- Photo Preview Modal -->
  <UModal v-model:open="photoPreview" :ui="{ content: 'sm:max-w-sm w-full' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-circle" class="size-5 text-muted" />
        <span class="font-medium text-sm">{{ employee.fullName }}</span>
      </div>
    </template>
    <template #body>
      <div class="flex items-center justify-center p-2">
        <img
          :src="employee.fotoKaryawan!"
          :alt="employee.fullName"
          class="w-full rounded-xl object-contain max-h-[70vh]"
        />
      </div>
    </template>
  </UModal>
</template>
