<script setup lang="ts">
import type { OperationalVehicleUsage } from '~/utils/vehicle-usage'
import { formatDateTimeWib } from '~/utils/vehicle-usage'

const props = defineProps<{
  open: boolean
  usage: OperationalVehicleUsage | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'cancel': [usage: OperationalVehicleUsage]
}>()

const localOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const isCancelled = computed(() => props.usage?.status === 'BATAL')

const rows = computed(() => {
  const u = props.usage
  if (!u) return []
  return [
    { label: 'Waktu pemakaian', value: formatDateTimeWib(u.usedAt), icon: 'i-lucide-calendar-clock' },
    { label: 'Driver', value: u.driver, icon: 'i-lucide-user-cog' },
    { label: 'Tujuan', value: u.destination, icon: 'i-lucide-map-pin' },
    { label: 'User', value: u.user, icon: 'i-lucide-user-round' },
    { label: 'Requester', value: u.requester, icon: 'i-lucide-user-check' }
  ]
})
</script>

<template>
  <USlideover
    v-model:open="localOpen"
    side="right"
    :ui="{ content: 'max-w-md' }"
  >
    <template #header>
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <UIcon name="i-lucide-clipboard-list" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="truncate text-sm font-semibold text-highlighted">Detail Pemakaian</span>
      </div>
    </template>

    <template #body>
      <div v-if="usage" class="space-y-5">
        <!-- Kendaraan + status -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-elevated/40 p-4">
          <OperasionalVehiclePlate :vehicle-number="usage.vehicleNumber" />
          <UBadge
            :color="isCancelled ? 'error' : 'success'"
            variant="subtle"
            size="sm"
          >
            {{ isCancelled ? 'Batal' : 'Terjadwal' }}
          </UBadge>
        </div>

        <!-- Rincian -->
        <dl class="space-y-3">
          <div v-for="row in rows" :key="row.label" class="flex items-start gap-3">
            <UIcon :name="row.icon" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-muted">
                {{ row.label }}
              </dt>
              <dd class="text-sm font-medium text-highlighted">
                {{ row.value || '-' }}
              </dd>
            </div>
          </div>
        </dl>

        <!-- Jejak pencatatan -->
        <div class="rounded-xl border border-default p-4">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Jejak Pencatatan
          </p>
          <ol class="relative space-y-4 border-l border-default pl-4">
            <li class="relative">
              <span class="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-default" />
              <p class="text-sm font-medium text-highlighted">
                Dicatat
              </p>
              <p class="text-xs text-muted">
                {{ usage.createdByName ?? '-' }}
                <span v-if="usage.createdByRole"> · {{ usage.createdByRole }}</span>
              </p>
            </li>
            <li v-if="isCancelled" class="relative">
              <span class="absolute -left-[21px] top-1 size-2.5 rounded-full bg-error ring-4 ring-default" />
              <p class="text-sm font-medium text-error">
                Dibatalkan
              </p>
              <p class="text-xs text-muted">
                {{ usage.cancelledByName ?? '-' }}
                <span v-if="usage.cancelledByRole"> · {{ usage.cancelledByRole }}</span>
              </p>
              <p class="text-xs text-muted">
                {{ formatDateTimeWib(usage.cancelledAt) }}
              </p>
            </li>
          </ol>
        </div>
      </div>
      <p v-else class="py-8 text-center text-sm text-muted">
        Tidak ada data.
      </p>
    </template>

    <template #footer>
      <div v-if="usage" class="flex w-full items-center justify-between gap-2">
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          @click="localOpen = false"
        />
        <UButton
          v-if="!isCancelled"
          label="Batalkan Pemakaian"
          icon="i-lucide-ban"
          color="error"
          variant="soft"
          @click="emit('cancel', usage)"
        />
      </div>
    </template>
  </USlideover>
</template>
