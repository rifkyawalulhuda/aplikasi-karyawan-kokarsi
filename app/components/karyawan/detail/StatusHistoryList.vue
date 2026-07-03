<script setup lang="ts">
import type { EmployeeStatusHistory } from '~/types'

const props = defineProps<{
  history: EmployeeStatusHistory[]
}>()

function formatDate(val: string) {
  return new Date(val).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const statusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK',
}

const statusColorMap: Record<string, string> = {
  AKTIF: 'success',
  KONTRAK_EXPIRED: 'warning',
  RESIGN: 'neutral',
  PHK: 'error',
}

const sorted = computed(() =>
  [...props.history].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
)
</script>

<template>
  <div>
    <h2 class="text-base font-semibold text-highlighted mb-3">
      Riwayat Status
      <span class="ml-1 text-sm font-normal text-muted">({{ history.length }})</span>
    </h2>

    <div v-if="sorted.length === 0" class="text-sm text-muted py-4 text-center">
      Belum ada riwayat perubahan status.
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in sorted"
        :key="item.id"
        class="flex items-start gap-3 p-4 rounded-lg bg-default border border-default"
      >
        <UIcon name="i-lucide-arrow-right-left" class="w-4 h-4 text-muted mt-0.5 shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <UBadge :color="(statusColorMap[item.oldStatus] ?? 'neutral') as any" variant="subtle" size="sm">
              {{ statusLabelMap[item.oldStatus] ?? item.oldStatus }}
            </UBadge>
            <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-muted" />
            <UBadge :color="(statusColorMap[item.newStatus] ?? 'neutral') as any" variant="subtle" size="sm">
              {{ statusLabelMap[item.newStatus] ?? item.newStatus }}
            </UBadge>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
            <span>{{ formatDate(item.changedAt) }}</span>
            <span>Oleh: {{ item.changedByName }} ({{ item.changedByRole }})</span>
          </div>
          <p v-if="item.notes" class="text-xs text-muted mt-1 italic">{{ item.notes }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
