<script setup lang="ts">
import type { Employee, EmploymentStatus } from '~/types'

const props = defineProps<{
  employee: Employee
}>()

const emit = defineEmits<{
  edit: []
  offboard: []
  delete: []
}>()

const auth = useAuthStore()

const statusColorMap: Record<EmploymentStatus, string> = {
  AKTIF: 'success',
  KONTRAK_EXPIRED: 'warning',
  RESIGN: 'neutral',
  PHK: 'error'
}

const statusLabelMap: Record<EmploymentStatus, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK'
}

/** Bar aksen & ring avatar mengikuti status — informasi struktural, bukan dekorasi. */
const accentBarMap: Record<EmploymentStatus, string> = {
  AKTIF: 'bg-success',
  KONTRAK_EXPIRED: 'bg-warning',
  RESIGN: 'bg-neutral',
  PHK: 'bg-error'
}

const ringMap: Record<EmploymentStatus, string> = {
  AKTIF: 'ring-success/30',
  KONTRAK_EXPIRED: 'ring-warning/30',
  RESIGN: 'ring-neutral/30',
  PHK: 'ring-error/30'
}

const canOffboard = computed(() =>
  props.employee.employmentStatus === 'AKTIF' || props.employee.employmentStatus === 'KONTRAK_EXPIRED'
)

const initials = computed(() =>
  (props.employee?.fullName ?? '')
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const roleSummary = computed(() =>
  [props.employee.jobRole?.name, props.employee.workLocation?.name, props.employee.department?.name]
    .filter(Boolean)
    .join(' · ')
)

const overflowItems = computed(() => {
  const items: { label: string, icon: string, color?: 'error', onSelect: () => void }[][] = []
  if (auth.canDelete) {
    items.push([
      { label: 'Hapus Karyawan', icon: 'i-lucide-trash', color: 'error', onSelect: () => emit('delete') }
    ])
  }
  return items
})

const photoPreview = ref(false)
</script>

<template>
  <div class="dossier-rise relative overflow-hidden rounded-2xl border border-default bg-default">
    <!-- Bar aksen status -->
    <div class="h-1.5 w-full" :class="accentBarMap[employee.employmentStatus]" />

    <div class="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
      <!-- Avatar -->
      <div
        class="size-24 shrink-0 overflow-hidden rounded-full bg-elevated ring-2 flex items-center justify-center"
        :class="ringMap[employee.employmentStatus]"
      >
        <button
          v-if="employee.fotoKaryawan"
          type="button"
          class="size-full cursor-zoom-in"
          :aria-label="`Perbesar foto ${employee.fullName}`"
          @click="photoPreview = true"
        >
          <img
            :src="employee.fotoKaryawan"
            :alt="employee.fullName"
            class="size-full object-cover transition-opacity hover:opacity-90"
          >
        </button>
        <span v-else class="text-3xl font-bold text-primary">{{ initials }}</span>
      </div>

      <!-- Identitas -->
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-2xl font-bold text-highlighted">
            {{ employee.fullName }}
          </h1>
          <UBadge
            :color="(statusColorMap[employee.employmentStatus] as any)"
            variant="subtle"
            size="sm"
          >
            {{ statusLabelMap[employee.employmentStatus] }}
          </UBadge>
        </div>

        <p v-if="roleSummary" class="mt-1 text-sm font-medium text-toned">
          {{ roleSummary }}
        </p>

        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-id-card" class="size-4" aria-hidden="true" />
            <span class="font-mono">{{ employee.employeeNo }}</span>
          </span>
          <span v-if="employee.memberNo" class="flex items-center gap-1.5">
            <UIcon name="i-lucide-badge" class="size-4" aria-hidden="true" />
            <span class="font-mono">{{ employee.memberNo }}</span>
          </span>
          <a
            v-if="employee.email"
            :href="`mailto:${employee.email}`"
            class="flex items-center gap-1.5 transition-colors hover:text-highlighted"
          >
            <UIcon name="i-lucide-mail" class="size-4" aria-hidden="true" />
            {{ employee.email }}
          </a>
          <a
            v-if="employee.phoneNumber"
            :href="`tel:${employee.phoneNumber}`"
            class="flex items-center gap-1.5 transition-colors hover:text-highlighted"
          >
            <UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" />
            {{ employee.phoneNumber }}
          </a>
        </div>
      </div>

      <!-- Aksi -->
      <div class="flex shrink-0 items-center gap-2">
        <UButton
          label="Edit Data"
          icon="i-lucide-pencil"
          color="primary"
          variant="solid"
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
        <UDropdownMenu v-if="overflowItems.length" :items="overflowItems">
          <UButton
            icon="i-lucide-more-horizontal"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Aksi lainnya"
          />
        </UDropdownMenu>
      </div>
    </div>
  </div>

  <!-- Pratinjau foto -->
  <UModal v-model:open="photoPreview" :ui="{ content: 'sm:max-w-sm w-full' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-circle" class="size-5 text-muted" />
        <span class="text-sm font-medium">{{ employee.fullName }}</span>
      </div>
    </template>
    <template #body>
      <div class="flex items-center justify-center p-2">
        <img
          :src="employee.fotoKaryawan!"
          :alt="employee.fullName"
          class="max-h-[70vh] w-full rounded-xl object-contain"
        >
      </div>
    </template>
  </UModal>
</template>
