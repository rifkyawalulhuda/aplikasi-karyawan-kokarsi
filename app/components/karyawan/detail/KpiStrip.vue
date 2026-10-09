<script setup lang="ts">
import type { Employee } from '~/types'
import { computeEmployeeMetrics, formatDateShortId } from '~/utils/employee-metrics'
import type { EmployeeDocumentLike } from '~/utils/employee-metrics'

const props = defineProps<{
  employee: Employee
  documents?: EmployeeDocumentLike[]
}>()

const metrics = computed(() =>
  computeEmployeeMetrics(props.employee, props.documents ?? [])
)

const contract = computed(() => metrics.value.current)

const contractRingColor = computed(() => {
  if (!contract.value.isLive) return 'text-muted'
  if (contract.value.expired) return 'text-error'
  if (contract.value.status === 'AKAN_HABIS') return 'text-warning'
  return 'text-success'
})

const contractHint = computed(() => {
  if (!contract.value.isLive) {
    return contract.value.endDate
      ? `Berakhir ${formatDateShortId(contract.value.endDate)}`
      : 'Tidak ada kontrak berjalan'
  }
  return `dari ${contract.value.totalDays ?? 0} hari kontrak`
})

const contractHeadline = computed(() => {
  if (!contract.value.isLive) return contract.value.status === 'EXPIRED' ? 'Habis' : '—'
  const days = Math.max(0, contract.value.daysRemaining ?? 0)
  return String(days)
})

// Ring SVG: r=18 → keliling ≈ 113.1
const RING_C = 2 * Math.PI * 18
const ringOffset = computed(() => RING_C * (1 - (contract.value.isLive ? contract.value.progress : 1)))
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- Masa Kerja -->
    <div class="dossier-rise dossier-lift rounded-xl border border-default bg-default p-4" style="animation-delay: 0ms">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-muted">Masa Kerja</span>
        <UIcon name="i-lucide-calendar-clock" class="size-4 text-muted" aria-hidden="true" />
      </div>
      <p class="mt-2 text-2xl font-bold tabular-nums text-highlighted">
        <DashboardCountUp :value="metrics.tenureDays" />
        <span class="ml-1 text-sm font-normal text-muted">hari</span>
      </p>
      <p class="mt-1 text-xs text-muted">
        ≈ {{ metrics.tenureLabel }}
        <span v-if="metrics.tenureFrozen" class="text-muted">· dibekukan</span>
      </p>
    </div>

    <!-- Sisa Kontrak -->
    <div class="dossier-rise dossier-lift rounded-xl border border-default bg-default p-4" style="animation-delay: 40ms">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-muted">Sisa Kontrak</span>
        <UIcon name="i-lucide-file-clock" class="size-4 text-muted" aria-hidden="true" />
      </div>
      <div class="mt-2 flex items-center gap-3">
        <div class="relative shrink-0">
          <svg
            viewBox="0 0 44 44"
            class="size-12 -rotate-90"
            role="img"
            :aria-label="`Progres kontrak ${Math.round(contract.progress * 100)} persen`"
          >
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--ui-border)"
              stroke-width="5"
            />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="currentColor"
              stroke-width="5"
              stroke-linecap="round"
              :class="contractRingColor"
              :stroke-dasharray="RING_C"
              :stroke-dashoffset="ringOffset"
              class="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
            />
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-bold leading-none tabular-nums text-highlighted">
            {{ contractHeadline }}
          </p>
          <p class="mt-1 truncate text-xs text-muted">
            {{ contractHint }}
          </p>
        </div>
      </div>
    </div>

    <!-- SP Aktif -->
    <div class="dossier-rise dossier-lift rounded-xl border border-default bg-default p-4" style="animation-delay: 80ms">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-muted">SP Aktif</span>
        <UIcon
          name="i-lucide-alert-triangle"
          class="size-4"
          :class="metrics.sp.count > 0 ? 'text-warning' : 'text-muted'"
          aria-hidden="true"
        />
      </div>
      <p
        class="mt-2 text-2xl font-bold tabular-nums"
        :class="metrics.sp.count > 0 ? 'text-warning' : 'text-highlighted'"
      >
        <DashboardCountUp :value="metrics.sp.count" />
        <span class="ml-1 text-sm font-normal text-muted">aktif</span>
      </p>
      <p class="mt-1 text-xs text-muted">
        <template v-if="metrics.sp.count > 0 && metrics.sp.highestLevel">
          Level tertinggi SP {{ metrics.sp.highestLevel }} · total {{ metrics.sp.total }}
        </template>
        <template v-else>
          Tidak ada surat peringatan aktif
        </template>
      </p>
    </div>

    <!-- Sertifikat -->
    <div class="dossier-rise dossier-lift rounded-xl border border-default bg-default p-4" style="animation-delay: 120ms">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-muted">Sertifikat</span>
        <UIcon
          name="i-lucide-badge-check"
          class="size-4"
          :class="metrics.certs.expiring > 0 ? 'text-warning' : 'text-muted'"
          aria-hidden="true"
        />
      </div>
      <p class="mt-2 text-2xl font-bold tabular-nums text-highlighted">
        <DashboardCountUp :value="metrics.certs.active" />
        <span class="ml-1 text-sm font-normal text-muted">/ {{ metrics.certs.total }}</span>
      </p>
      <p class="mt-1 text-xs text-muted">
        <template v-if="metrics.certs.expiring > 0">
          <span class="font-medium text-warning">{{ metrics.certs.expiring }} akan expired</span>
        </template>
        <template v-else-if="metrics.certs.expired > 0">
          {{ metrics.certs.expired }} sudah expired
        </template>
        <template v-else>
          {{ metrics.certs.total }} dokumen aktif
        </template>
      </p>
    </div>
  </div>
</template>
