<script setup lang="ts">
import type { Contract, Employee } from '~/types'

const props = defineProps<{
  open: boolean
  employee: Employee | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const localOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const loading = ref(false)
const contracts = ref<Contract[]>([])
const loadError = ref('')

async function load() {
  if (!props.employee) return
  loading.value = true
  loadError.value = ''
  try {
    const detail = await $fetch<Employee & { contracts?: Contract[] }>(`/api/employees/${props.employee.id}`)
    contracts.value = [...(detail.contracts ?? [])].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
  } catch (e) {
    contracts.value = []
    loadError.value = apiErrorMessage(e, 'Gagal memuat riwayat kontrak')
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) load()
})

const roleLine = computed(() => {
  const e = props.employee
  if (!e) return ''
  return [e.jobRole?.name, e.workLocation?.name].filter(Boolean).join(' · ')
})

const initials = computed(() =>
  (props.employee?.fullName ?? '')
    .split(' ')
    .map(n => n[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const searchLink = computed(() =>
  `/kontrak?search=${encodeURIComponent(props.employee?.fullName ?? '')}`
)
</script>

<template>
  <UModal v-model:open="localOpen" :ui="{ content: 'max-w-4xl w-full' }">
    <template #header>
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring ring-primary/20">
          <img
            v-if="employee?.fotoKaryawan"
            :src="employee.fotoKaryawan"
            :alt="employee.fullName"
            class="size-full object-cover"
          >
          <span v-else class="text-sm font-semibold text-primary">{{ initials }}</span>
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-highlighted">
            Riwayat Kontrak — {{ employee?.fullName }}
          </p>
          <p class="truncate text-xs text-muted">
            <span v-if="roleLine">{{ roleLine }} · </span>{{ contracts.length }} kontrak
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <!-- Memuat -->
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-10 w-full rounded-lg" />
        <USkeleton class="h-16 w-full rounded-xl" />
        <USkeleton class="h-20 w-full rounded-xl" />
        <USkeleton class="h-20 w-full rounded-xl" />
      </div>

      <!-- Gagal -->
      <div v-else-if="loadError" class="flex flex-col items-center gap-3 py-12 text-center">
        <UIcon name="i-lucide-alert-triangle" class="size-10 text-warning" aria-hidden="true" />
        <p class="text-sm text-muted">
          {{ loadError }}
        </p>
        <UButton
          label="Coba lagi"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="load"
        />
      </div>

      <!-- Kosong -->
      <div v-else-if="!contracts.length" class="flex flex-col items-center gap-3 py-12 text-center">
        <UIcon name="i-lucide-file-signature" class="size-10 text-muted" aria-hidden="true" />
        <div>
          <p class="text-sm font-medium text-highlighted">
            Belum ada kontrak
          </p>
          <p class="mt-0.5 text-sm text-muted">
            {{ employee?.fullName }} belum memiliki riwayat kontrak.
          </p>
        </div>
        <UButton
          label="Buka modul Kontrak"
          icon="i-lucide-arrow-right"
          color="primary"
          variant="subtle"
          size="sm"
          :to="searchLink"
          @click="localOpen = false"
        />
      </div>

      <ContractHistoryTimeline v-else :contracts="contracts" />
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <span class="text-xs text-muted">
          {{ contracts.length }} kontrak tercatat
        </span>
        <UButton
          label="Tutup"
          color="neutral"
          variant="subtle"
          @click="localOpen = false"
        />
      </div>
    </template>
  </UModal>
</template>
