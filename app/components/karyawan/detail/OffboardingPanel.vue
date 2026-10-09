<script setup lang="ts">
import type { Employee } from '~/types'
import { formatDateId } from '~/utils/employee-metrics'

const props = defineProps<{
  employee: Employee
}>()

const isPhk = computed(() => props.employee.employmentStatus === 'PHK')
</script>

<template>
  <section
    class="dossier-rise overflow-hidden rounded-2xl border"
    :class="isPhk ? 'border-error/30 bg-error/5' : 'border-default bg-elevated/40'"
  >
    <header class="flex items-center gap-2 border-b p-4" :class="isPhk ? 'border-error/20' : 'border-default'">
      <UIcon
        name="i-lucide-user-x"
        class="size-5"
        :class="isPhk ? 'text-error' : 'text-muted'"
        aria-hidden="true"
      />
      <h2 class="text-base font-semibold text-highlighted">
        {{ isPhk ? 'Pemutusan Hubungan Kerja (PHK)' : 'Mengundurkan Diri (Resign)' }}
      </h2>
    </header>

    <template v-if="employee.offboarding">
      <dl class="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-3">
        <div>
          <dt class="text-xs text-muted">
            Jenis Offboarding
          </dt>
          <dd class="mt-0.5">
            <UBadge :color="isPhk ? 'error' : 'neutral'" variant="subtle" size="sm">
              {{ employee.offboarding.terminationType }}
            </UBadge>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Tanggal Efektif
          </dt>
          <dd class="mt-0.5 text-sm font-medium text-highlighted">
            {{ formatDateId(employee.offboarding.terminationDate) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Diproses Oleh
          </dt>
          <dd class="mt-0.5 text-sm font-medium text-highlighted">
            {{ employee.offboarding.processedByName }}
            <span class="font-normal text-muted">({{ employee.offboarding.processedByRole }})</span>
          </dd>
        </div>
        <div v-if="employee.offboarding.reason" class="sm:col-span-3">
          <dt class="text-xs text-muted">
            Alasan / Catatan
          </dt>
          <dd class="mt-0.5 text-sm font-medium text-highlighted">
            {{ employee.offboarding.reason }}
          </dd>
        </div>
      </dl>
      <div class="border-t px-4 py-3" :class="isPhk ? 'border-error/20' : 'border-default'">
        <p class="flex items-center gap-1.5 text-xs text-muted">
          <UIcon name="i-lucide-info" class="size-3.5 shrink-0" aria-hidden="true" />
          Semua kontrak non-dibatalkan telah diubah ke status <strong>Selesai</strong> saat offboarding.
        </p>
      </div>
    </template>
    <p v-else class="p-4 text-sm text-muted">
      Data offboarding tidak ditemukan.
    </p>
  </section>
</template>
