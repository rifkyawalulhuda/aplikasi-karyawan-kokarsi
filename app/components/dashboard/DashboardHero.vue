<script setup lang="ts">
import type { DashboardLayoutPreset } from '~/composables/useDashboardLayout'

const props = withDefaults(defineProps<{
  loading?: boolean
  refreshing?: boolean
  lastUpdated?: Date | null
  agendaCount?: number
}>(), {
  loading: false,
  refreshing: false,
  lastUpdated: null,
  agendaCount: 0
})

const emit = defineEmits<{ refresh: [] }>()

const auth = useAuthStore()
const { editing, reset, applyPreset } = useDashboardLayout()

// Jam & label waktu hanya dirender setelah mount supaya SSR dan hydration
// identik (waktu server selalu berbeda dengan waktu klien).
const mounted = useMounted()
const now = useNow({ interval: 1000 })

const jamWib = computed(() =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now.value)
)

const tanggalWib = computed(() =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(now.value)
)

const greeting = computed(() => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false
  }).format(now.value))
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
})

const firstName = computed(() => {
  const name = auth.admin?.fullName ?? ''
  return name.split(' ')[0] || 'Pengguna'
})

const updatedLabel = useTimeAgo(computed(() => props.lastUpdated ?? new Date()), { updateInterval: 30000 })

const presets: { id: DashboardLayoutPreset, label: string }[] = [
  { id: 'ringkas', label: 'Ringkas' },
  { id: 'standar', label: 'Standar' },
  { id: 'lengkap', label: 'Lengkap' }
]
</script>

<template>
  <section class="flex flex-col gap-4 rounded-xl border border-default bg-elevated/40 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">
          {{ tanggalWib }}
        </p>
        <h1 class="mt-1 text-xl font-bold text-highlighted sm:text-2xl">
          {{ greeting }}, {{ firstName }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          Koperasi Karyawan PT. Sankyu
        </p>
      </div>

      <div class="flex flex-col items-end gap-2">
        <div class="flex items-center gap-2">
          <span
            class="rounded-lg bg-default px-3 py-1.5 text-lg font-semibold tabular-nums text-highlighted ring ring-default"
            aria-label="Waktu Indonesia Barat"
          >
            {{ mounted ? jamWib : '--:--:--' }}
            <span class="text-xs font-normal text-muted">WIB</span>
          </span>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-refresh-cw" class="size-3.5" aria-hidden="true" />
          <span>{{ refreshing ? 'Memperbarui…' : (mounted ? `Diperbarui ${updatedLabel}` : 'Memuat waktu…') }}</span>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        icon="i-lucide-refresh-cw"
        label="Muat ulang"
        color="neutral"
        variant="subtle"
        size="sm"
        :loading="refreshing"
        @click="emit('refresh')"
      />

      <UButton
        :icon="editing ? 'i-lucide-check' : 'i-lucide-sliders-horizontal'"
        :label="editing ? 'Selesai' : 'Atur widget'"
        :color="editing ? 'primary' : 'neutral'"
        :variant="editing ? 'solid' : 'subtle'"
        size="sm"
        :aria-pressed="editing"
        @click="editing = !editing"
      />

      <UButton
        v-if="agendaCount > 0"
        icon="i-lucide-calendar-days"
        :label="`${agendaCount} agenda hari ini`"
        color="primary"
        variant="subtle"
        size="sm"
        to="/kalender"
      />

      <div class="ml-auto flex items-center gap-2">
        <template v-if="editing">
          <span class="hidden text-xs text-muted sm:inline">Preset:</span>
          <UButton
            v-for="preset in presets"
            :key="preset.id"
            :label="preset.label"
            color="neutral"
            variant="outline"
            size="xs"
            @click="applyPreset(preset.id)"
          />
          <UButton
            icon="i-lucide-rotate-ccw"
            label="Reset"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="reset"
          />
        </template>
      </div>
    </div>
  </section>
</template>
