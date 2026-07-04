<script setup lang="ts">
import type { Contract } from '~/types'

const props = defineProps<{
  contracts: Contract[]
}>()

function formatDate(val: string | undefined) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusColorMap: Record<string, string> = {
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'neutral',
  DIBATALKAN: 'neutral',
}

const statusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

const sorted = computed(() =>
  [...props.contracts].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
)
</script>

<template>
  <div>
    <h2 class="text-base font-semibold text-highlighted mb-3">
      Riwayat Kontrak
      <span class="ml-1 text-sm font-normal text-muted">({{ contracts.length }})</span>
    </h2>

    <div v-if="sorted.length === 0" class="text-sm text-muted py-4 text-center">
      Belum ada data kontrak.
    </div>

    <div v-else class="relative">
      <!-- Scrollable container -->
      <div class="max-h-[400px] lg:max-h-[600px] overflow-y-auto pr-2 relative">
        <!-- Timeline line -->
        <div class="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div class="space-y-4 pb-4">
          <div
            v-for="contract in sorted"
            :key="contract.id"
            class="relative pl-10"
          >
            <!-- Timeline dot -->
            <div
              class="absolute left-3 top-4 w-2.5 h-2.5 rounded-full border-2 border-background"
              :class="{
                'bg-success': contract.status === 'AKTIF',
                'bg-warning': contract.status === 'AKAN_HABIS',
                'bg-error': contract.status === 'EXPIRED',
                'bg-muted': contract.status === 'SELESAI' || contract.status === 'DIBATALKAN',
              }"
            />

            <div class="p-4 rounded-lg bg-default border border-default">
              <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <p class="font-mono text-sm font-medium text-highlighted">{{ contract.contractNo }}</p>
                  <p class="text-xs text-muted">{{ contract.contractType?.name ?? 'Tipe tidak diketahui' }}</p>
                </div>
                <UBadge :color="(statusColorMap[contract.status] as any)" variant="subtle" size="sm">
                  {{ statusLabelMap[contract.status] }}
                </UBadge>
              </div>
              <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
                  {{ formatDate(contract.startDate) }} — {{ formatDate(contract.endDate) }}
                </span>
                <a
                  v-if="contract.documentUrl"
                  :href="`http://localhost:3001${contract.documentUrl}`"
                  target="_blank"
                  class="flex items-center gap-1 text-primary hover:underline"
                >
                  <UIcon name="i-lucide-file-text" class="w-3.5 h-3.5" />
                  Dokumen
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Gradient fade indicator -->
      <div class="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-default to-transparent pointer-events-none" />
    </div>
  </div>
</template>
