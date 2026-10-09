<script setup lang="ts">
import type { Contract, ContractHistoryResponse } from '~/types'
import {
  CONTRACT_STATUS_COLOR,
  CONTRACT_STATUS_LABEL,
  daysUntil,
  formatContractDate,
  formatSpan,
  pickCurrentContract
} from '~/utils/contract-timeline'

const props = withDefaults(defineProps<{
  open: boolean
  employeeId: number | null
  selectedContractId?: number | null
}>(), {
  selectedContractId: null
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [contract: Contract]
  'preview': [contract: Contract]
  'renew': [contract: Contract]
  'generate': [contract: Contract]
  'download-pdf': [contract: Contract]
}>()

const localOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const loading = ref(false)
const loadError = ref('')
const employee = ref<ContractHistoryResponse['employee'] | null>(null)
const contracts = ref<Contract[]>([])

async function load() {
  if (props.employeeId === null) return
  loading.value = true
  loadError.value = ''
  employee.value = null
  contracts.value = []
  try {
    const res = await $fetch<ContractHistoryResponse>(`/api/contracts/history/${props.employeeId}`)
    employee.value = res.employee
    contracts.value = res.contracts
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Gagal memuat riwayat kontrak')
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) load()
})

const initials = computed(() =>
  (employee.value?.fullName ?? '')
    .split(' ')
    .map(n => n[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

// ── Hero kontrak aktif ───────────────────────────────────────────────────────
const currentContract = computed(() => pickCurrentContract(contracts.value))

const currentIsLive = computed(() =>
  currentContract.value?.status === 'AKTIF' || currentContract.value?.status === 'AKAN_HABIS'
)

const currentRemaining = computed(() => daysUntil(currentContract.value?.endDate))

const currentSpan = computed(() => {
  const c = currentContract.value
  if (!c) return ''
  return formatSpan(new Date(c.startDate), new Date(c.endDate))
})

const currentMeta = computed(() => {
  const c = currentContract.value
  if (!c) return ''
  return [c.contractType?.name, c.positionLabel, c.workLocationLabel].filter(Boolean).join(' · ')
})

// ── Rantai perpanjangan & aksi ───────────────────────────────────────────────
function hasSuccessor(id: number) {
  return contracts.value.some(c => c.parentContractId === id)
}

function canRenew(contract: Contract) {
  return (contract.status === 'AKAN_HABIS' || contract.status === 'EXPIRED') && !hasSuccessor(contract.id)
}

/** Aksi utama kontekstual: EXPIRED belum diperpanjang → Perpanjang, lainnya → Preview. */
function primaryIsRenew(contract: Contract) {
  return contract.status === 'EXPIRED' && canRenew(contract)
}

function onPrimary(contract: Contract) {
  if (primaryIsRenew(contract)) emit('renew', contract)
  else emit('preview', contract)
}

// ── Context menu klik-kanan pada kartu kontrak ───────────────────────────────
// Menggantikan dropdown "Opsi" (⋯). Pola sama dengan context menu tabel di
// `app/pages/kontrak.vue`: Teleport ke body + posisi sadar viewport.
const contractMenu = ref(false)
const contractMenuX = ref(0)
const contractMenuY = ref(0)
const contractMenuTarget = ref<Contract | null>(null)

/** Kartu pemicu (untuk memposisikan menu dari keyboard & memulihkan fokus). */
function contractCardEl(contract: Contract): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-contract-id="${contract.id}"]`)
}

async function openContractMenu(contract: Contract, event: MouseEvent) {
  contractMenuTarget.value = contract
  contractMenu.value = true
  await nextTick()
  const menuEl = document.querySelector('[data-contract-menu]') as HTMLElement | null
  const menuWidth = menuEl?.offsetWidth ?? 208
  const menuHeight = menuEl?.offsetHeight ?? 260

  // Posisi: dari titik klik (mouse), atau dari kartu pemicu bila dibuka lewat
  // keyboard (Shift+F10 / tombol Menu) — event keyboard memberi clientX/Y = 0.
  let x = event.clientX
  let y = event.clientY
  if (x === 0 && y === 0) {
    const rect = contractCardEl(contract)?.getBoundingClientRect()
    x = rect ? rect.left : 8
    y = rect ? rect.top : 8
  }
  // Clamp ke viewport, dengan lantai 8px agar tidak pernah negatif.
  contractMenuX.value = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8))
  contractMenuY.value = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8))

  // Fokus ke item pertama supaya menu bisa dioperasikan lewat keyboard.
  menuEl?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
}

/**
 * Tutup menu. `restoreFocus` dimatikan saat memilih item (aksi bisa membuka
 * modal lain) agar fokus tidak "melompat" ke kartu di belakang.
 */
function closeContractMenu(restoreFocus = true) {
  const contract = contractMenuTarget.value
  contractMenu.value = false
  if (restoreFocus && contract) {
    nextTick(() => contractCardEl(contract)?.focus())
  }
}

/** Navigasi keyboard di dalam menu (panah/Home/End). */
function onContractMenuKeydown(event: KeyboardEvent) {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-contract-menu] [role="menuitem"]'))
  if (items.length === 0) return
  const idx = items.indexOf(document.activeElement as HTMLElement)
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    items[(idx + 1 + items.length) % items.length]?.focus()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    items[(idx - 1 + items.length) % items.length]?.focus()
  } else if (event.key === 'Home') {
    event.preventDefault()
    items[0]?.focus()
  } else if (event.key === 'End') {
    event.preventDefault()
    items[items.length - 1]?.focus()
  }
}

function onContractContextMenu(payload: { contract: Contract, event: MouseEvent }) {
  openContractMenu(payload.contract, payload.event)
}

/** Item menu kontekstual per kontrak; urutan & syarat sama dengan dropdown lama. */
function contractMenuItems(contract: Contract) {
  const items: { label: string, icon: string, onSelect: () => void }[] = []

  if (primaryIsRenew(contract)) {
    items.push({ label: 'Preview', icon: 'i-lucide-file-search', onSelect: () => emit('preview', contract) })
  }
  if (canRenew(contract) && !primaryIsRenew(contract)) {
    items.push({ label: 'Perpanjang', icon: 'i-lucide-refresh-cw', onSelect: () => emit('renew', contract) })
  }
  if (contract.documentUrl) {
    items.push({
      label: 'Unduh Dokumen',
      icon: 'i-lucide-download',
      onSelect: () => window.open(contract.documentUrl!, '_blank', 'noopener,noreferrer')
    })
  }
  items.push({ label: 'Unduh PDF', icon: 'i-lucide-file-down', onSelect: () => emit('download-pdf', contract) })
  items.push({ label: 'Generate Dokumen', icon: 'i-lucide-file-cog', onSelect: () => emit('generate', contract) })
  items.push({ label: 'Edit Kontrak', icon: 'i-lucide-pencil', onSelect: () => emit('edit', contract) })

  return items
}

function onContractMenuSelect(item: { onSelect: () => void }) {
  item.onSelect()
  closeContractMenu(false)
}

function primaryLabel(contract: Contract) {
  return primaryIsRenew(contract) ? 'Perpanjang' : 'Preview'
}

function primaryIcon(contract: Contract) {
  return primaryIsRenew(contract) ? 'i-lucide-refresh-cw' : 'i-lucide-file-search'
}
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
            Riwayat Kontrak — {{ employee?.fullName ?? 'Karyawan' }}
          </p>
          <p class="truncate text-xs text-muted">
            <span v-if="employee?.employeeNo" class="font-mono">{{ employee.employeeNo }} · </span>{{ contracts.length }} kontrak
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <!-- Memuat -->
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-10 w-full rounded-lg" />
        <USkeleton class="h-28 w-full rounded-xl" />
        <USkeleton class="h-16 w-full rounded-xl" />
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
            {{ employee?.fullName ?? 'Karyawan ini' }} belum memiliki riwayat kontrak.
          </p>
        </div>
      </div>

      <div v-else class="space-y-5">
        <!-- Hero kontrak aktif -->
        <div
          class="rounded-xl border p-4"
          :class="currentIsLive ? 'border-primary/30 bg-primary/5' : 'border-default bg-elevated/40'"
        >
          <div class="mb-2 flex items-center gap-2">
            <UIcon
              name="i-lucide-file-signature"
              class="size-4"
              :class="currentIsLive ? 'text-primary' : 'text-muted'"
              aria-hidden="true"
            />
            <span
              class="text-xs font-semibold uppercase tracking-wide"
              :class="currentIsLive ? 'text-primary' : 'text-muted'"
            >
              {{ currentIsLive ? 'Kontrak Aktif' : 'Kontrak Terakhir' }}
            </span>
          </div>

          <template v-if="currentContract">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-mono text-sm font-semibold text-highlighted">
                {{ currentContract.contractNo }}
              </p>
              <UBadge
                :color="(CONTRACT_STATUS_COLOR[currentContract.status] ?? 'neutral') as any"
                variant="subtle"
                size="sm"
              >
                {{ CONTRACT_STATUS_LABEL[currentContract.status] ?? currentContract.status }}
              </UBadge>
            </div>
            <p class="mt-1 text-xs text-muted">
              {{ formatContractDate(currentContract.startDate) }} – {{ formatContractDate(currentContract.endDate) }}
              <span v-if="currentSpan"> · {{ currentSpan }}</span>
            </p>
            <p v-if="currentMeta" class="mt-0.5 text-xs text-muted">
              {{ currentMeta }}
            </p>

            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p v-if="currentIsLive && currentRemaining !== null" class="text-sm">
                <span class="font-bold tabular-nums text-highlighted">{{ Math.max(0, currentRemaining) }}</span>
                <span class="text-muted"> hari tersisa</span>
              </p>
              <p v-else-if="currentRemaining !== null && currentRemaining < 0" class="text-sm text-error">
                Berakhir {{ Math.abs(currentRemaining) }} hari lalu
              </p>
              <span v-else />

              <UButton
                :label="primaryLabel(currentContract)"
                :icon="primaryIcon(currentContract)"
                :color="primaryIsRenew(currentContract) ? 'success' : 'primary'"
                variant="solid"
                size="sm"
                @click="onPrimary(currentContract)"
              />
            </div>
          </template>
          <p v-else class="text-sm text-muted">
            Tidak ada data kontrak.
          </p>
        </div>

        <!-- Rentang karier + detail + aksi per kontrak -->
        <ContractHistoryTimeline
          :contracts="contracts"
          :selected-contract-id="selectedContractId"
          show-compensation
          :show-doc-links="false"
          context-menu-enabled
          @contract-contextmenu="onContractContextMenu"
        >
          <template #actions="{ contract }">
            <UButton
              :label="primaryLabel(contract)"
              :icon="primaryIcon(contract)"
              :color="primaryIsRenew(contract) ? 'success' : 'primary'"
              variant="subtle"
              size="xs"
              @click="onPrimary(contract)"
            />
          </template>
        </ContractHistoryTimeline>
      </div>
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

  <!-- Context Menu klik-kanan kartu kontrak (menggantikan dropdown Opsi) -->
  <!--
    `@pointerdown.stop` WAJIB: menu di-Teleport ke body (di luar UModal), dan
    Reka Dialog mendengarkan `pointerdown` di document untuk menutup modal saat
    klik di luar. Tanpa stop, memilih salah satu opsi ikut menutup modal
    Riwayat Kontrak. `pointer-events-auto` juga wajib karena Reka menyetel
    `pointer-events: none` pada body saat modal terbuka.
  -->
  <Teleport to="body">
    <div
      v-if="contractMenu && contractMenuTarget"
      class="pointer-events-auto fixed inset-0 z-[100]"
      @pointerdown.stop
      @click="closeContractMenu()"
      @contextmenu.prevent="closeContractMenu()"
      @keydown.esc.stop="closeContractMenu()"
    >
      <div
        data-contract-menu
        role="menu"
        :aria-label="`Aksi untuk ${contractMenuTarget.contractNo}`"
        class="pointer-events-auto absolute z-[100] min-w-48 overflow-hidden rounded-xl border border-default bg-default py-1 shadow-xl"
        :style="{ top: `${contractMenuY}px`, left: `${contractMenuX}px` }"
        @pointerdown.stop
        @click.stop
        @keydown="onContractMenuKeydown"
      >
        <button
          v-for="item in contractMenuItems(contractMenuTarget)"
          :key="item.label"
          type="button"
          role="menuitem"
          tabindex="-1"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60 focus-visible:bg-elevated/60 focus-visible:outline-none"
          @click="onContractMenuSelect(item)"
        >
          <UIcon :name="item.icon" class="size-4 shrink-0 text-muted" />
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
