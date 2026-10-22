<script setup lang="ts">
const props = defineProps<{
  contractNo?: string
  loading?: boolean
  employee?: string
  period?: string
  duration?: string
  compensation?: string
  statusLabel?: string
  statusColor?: string
}>()

const toast = useToast()
const copied = ref(false)

const stats = computed(() => [
  { label: 'Karyawan', value: props.employee || 'Belum dipilih', icon: 'i-lucide-user-round' },
  { label: 'Periode', value: props.period || 'Belum lengkap', icon: 'i-lucide-calendar-range' },
  { label: 'Durasi', value: props.duration || '—', icon: 'i-lucide-hourglass' },
  { label: 'Kompensasi', value: props.compensation || '—', icon: 'i-lucide-wallet' }
])

async function copyContractNo() {
  if (!props.contractNo) return
  try {
    await navigator.clipboard.writeText(props.contractNo)
    copied.value = true
    toast.add({ title: 'Nomor kontrak disalin', color: 'success' })
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    toast.add({ title: 'Gagal menyalin nomor kontrak', color: 'error' })
  }
}
</script>

<template>
  <div class="relative overflow-hidden rounded-xl border border-default bg-elevated/30">
    <div class="absolute inset-y-0 start-0 w-1 bg-primary" aria-hidden="true" />

    <div class="space-y-4 p-4 ps-5 sm:p-5 sm:ps-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Nomor Kontrak
          </p>
          <div class="mt-1 flex min-h-7 items-center gap-1.5">
            <span v-if="loading" class="flex items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
              Menyiapkan nomor...
            </span>
            <template v-else>
              <span class="truncate font-mono text-lg font-semibold tracking-tight text-highlighted">
                {{ contractNo || '—' }}
              </span>
              <UButton
                v-if="contractNo"
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                color="neutral"
                variant="ghost"
                square
                class="size-8"
                :aria-label="copied ? 'Nomor kontrak tersalin' : 'Salin nomor kontrak'"
                @click="copyContractNo"
              />
            </template>
          </div>
        </div>

        <UBadge
          v-if="statusLabel"
          :color="(statusColor as any) ?? 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ statusLabel }}
        </UBadge>
      </div>

      <dl class="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-default/70 pt-3 sm:grid-cols-4">
        <div v-for="stat in stats" :key="stat.label" class="min-w-0">
          <dt class="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <UIcon :name="stat.icon" class="size-3.5" aria-hidden="true" />
            {{ stat.label }}
          </dt>
          <dd class="mt-0.5 truncate text-sm font-medium text-highlighted" :title="stat.value">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
