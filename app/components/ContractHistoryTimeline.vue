<script setup lang="ts">
import type { Contract } from '~/types'
import {
  buildContractTimeline,
  CONTRACT_STATUS_BAR,
  CONTRACT_STATUS_COLOR,
  CONTRACT_STATUS_LABEL,
  formatContractDate,
  formatCurrency
} from '~/utils/contract-timeline'

const props = withDefaults(defineProps<{
  contracts: Contract[]
  selectedContractId?: number | null
  showCompensation?: boolean
  showDocLinks?: boolean
}>(), {
  selectedContractId: null,
  showCompensation: false,
  showDocLinks: true
})

const reducedMotion = usePreferredReducedMotion()

const STATUS_ORDER = ['AKTIF', 'AKAN_HABIS', 'EXPIRED', 'SELESAI', 'DIBATALKAN', 'DRAFT']

const activeStatuses = ref<Set<string>>(new Set())
const hoveredId = ref<number | null>(null)
const detailScrollRef = ref<HTMLElement | null>(null)

// ── Filter status ────────────────────────────────────────────────────────────
const statusCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const contract of props.contracts) {
    counts[contract.status] = (counts[contract.status] ?? 0) + 1
  }
  return counts
})

const presentStatuses = computed(() => STATUS_ORDER.filter(status => (statusCounts.value[status] ?? 0) > 0))

const noFilter = computed(() => activeStatuses.value.size === 0)

function toggleStatus(status: string) {
  const next = new Set(activeStatuses.value)
  if (next.has(status)) next.delete(status)
  else next.add(status)
  activeStatuses.value = next
}

function clearStatuses() {
  activeStatuses.value = new Set()
}

const filteredContracts = computed(() =>
  noFilter.value ? props.contracts : props.contracts.filter(c => activeStatuses.value.has(c.status))
)

// ── Rentang karier (signature) ───────────────────────────────────────────────
const timeline = computed(() => buildContractTimeline(props.contracts))

function durationOf(id: number) {
  return timeline.value.segments.find(s => s.contract.id === id)?.durationLabel ?? '-'
}

function isCurrent(id: number) {
  return timeline.value.segments.find(s => s.contract.id === id)?.isCurrent ?? false
}

function daysRemainingOf(id: number) {
  return timeline.value.segments.find(s => s.contract.id === id)?.daysRemaining ?? null
}

// ── Rantai perpanjangan ──────────────────────────────────────────────────────
const parentIds = computed(() => {
  const ids = new Set<number>()
  for (const contract of props.contracts) {
    if (contract.parentContractId) ids.add(contract.parentContractId)
  }
  return ids
})

function hasSuccessor(id: number) {
  return parentIds.value.has(id)
}

function parentOf(contract: Contract) {
  return contract.parentContractId
    ? props.contracts.find(c => c.id === contract.parentContractId) ?? null
    : null
}

function isDimmed(status: string) {
  return !noFilter.value && !activeStatuses.value.has(status)
}

function scrollToContract(id: number) {
  const el = detailScrollRef.value?.querySelector<HTMLElement>(`[data-contract-id="${id}"]`)
  if (!el) return
  hoveredId.value = id
  el.scrollIntoView({
    behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth',
    block: 'nearest'
  })
}

// Sorot & gulir ke kontrak yang barisnya tadi diklik di tabel.
function focusSelected() {
  if (props.selectedContractId == null) return
  nextTick(() => scrollToContract(props.selectedContractId as number))
}

onMounted(focusSelected)
watch(() => props.selectedContractId, focusSelected)
</script>

<template>
  <div class="space-y-5">
    <!-- Filter status -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="noFilter
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-default text-muted hover:bg-elevated/60 hover:text-highlighted'"
        :aria-pressed="noFilter"
        @click="clearStatuses"
      >
        Semua
        <span class="tabular-nums opacity-70">{{ contracts.length }}</span>
      </button>
      <button
        v-for="status in presentStatuses"
        :key="status"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="activeStatuses.has(status)
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-default text-muted hover:bg-elevated/60 hover:text-highlighted'"
        :aria-pressed="activeStatuses.has(status)"
        @click="toggleStatus(status)"
      >
        <span class="size-2 rounded-full" :class="CONTRACT_STATUS_BAR[status] ?? 'bg-accented'" />
        {{ CONTRACT_STATUS_LABEL[status] ?? status }}
        <span class="tabular-nums opacity-70">{{ statusCounts[status] }}</span>
      </button>
    </div>

    <!-- Rentang karier -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">
          Rentang Karier
        </p>
        <p v-if="timeline.totalDays" class="text-xs text-muted">
          {{ Math.round(timeline.totalDays / 365.25 * 10) / 10 }} tahun
        </p>
      </div>

      <div class="relative h-14 rounded-lg bg-elevated/50 ring-1 ring-default">
        <!-- Celah antar-kontrak -->
        <div
          v-for="(gap, gi) in timeline.gaps"
          :key="`gap-${gi}`"
          class="absolute inset-y-2 rounded-md bg-[repeating-linear-gradient(45deg,var(--ui-border)_0,var(--ui-border)_1px,transparent_1px,transparent_5px)]"
          :style="{ left: `${gap.leftPct}%`, width: `${gap.widthPct}%` }"
          :title="`Jeda ${gap.days} hari`"
        />

        <!-- Segmen kontrak -->
        <button
          v-for="(seg, si) in timeline.segments"
          :key="seg.contract.id"
          type="button"
          class="contract-seg-in group absolute inset-y-2 rounded-md ring-1 ring-black/5 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="[
            CONTRACT_STATUS_BAR[seg.status] ?? 'bg-accented',
            isDimmed(seg.status) ? 'opacity-25' : 'opacity-100',
            hoveredId === seg.contract.id || selectedContractId === seg.contract.id ? 'ring-2 ring-primary/60' : ''
          ]"
          :style="{ left: `${seg.leftPct}%`, width: `max(${seg.widthPct}%, 10px)`, animationDelay: `${si * 60}ms` }"
          :aria-label="`Kontrak ${seg.contract.contractNo}, ${seg.durationLabel}`"
          :title="`${seg.contract.contractNo} · ${seg.durationLabel}`"
          @mouseenter="hoveredId = seg.contract.id"
          @mouseleave="hoveredId = null"
          @click="scrollToContract(seg.contract.id)"
        >
          <span
            class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-default bg-default px-2.5 py-1.5 text-left text-xs shadow-lg group-hover:block"
          >
            <span class="block font-mono font-medium text-highlighted">{{ seg.contract.contractNo }}</span>
            <span class="block text-muted">{{ seg.durationLabel }} · {{ CONTRACT_STATUS_LABEL[seg.status] ?? seg.status }}</span>
          </span>
        </button>

        <!-- Penanda hari ini -->
        <div
          v-if="timeline.nowPct !== null"
          class="pointer-events-none absolute inset-y-0 z-10 w-px bg-highlighted/40"
          :style="{ left: `${timeline.nowPct}%` }"
          title="Hari ini"
        />
      </div>

      <!-- Sumbu tahun -->
      <div class="relative mt-1 h-4">
        <span
          v-for="year in timeline.years"
          :key="year.year"
          class="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted"
          :style="{ left: `${year.leftPct}%` }"
        >
          {{ year.year }}
        </span>
      </div>
    </div>

    <!-- Detail per kontrak -->
    <div ref="detailScrollRef" class="max-h-[42vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
      <article
        v-for="(contract, index) in filteredContracts"
        :key="contract.id"
        :data-contract-id="contract.id"
        class="dossier-rise rounded-xl border bg-default p-4 transition-colors"
        :class="[
          hoveredId === contract.id ? 'border-primary/60 ring-1 ring-primary/30' : 'border-default',
          selectedContractId === contract.id ? 'border-primary ring-1 ring-primary/40' : ''
        ]"
        :style="{ animationDelay: `${Math.min(index, 8) * 30}ms` }"
        @mouseenter="hoveredId = contract.id"
        @mouseleave="hoveredId = null"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-mono text-sm font-semibold text-highlighted">
                {{ contract.contractNo }}
              </p>
              <UBadge
                :color="(CONTRACT_STATUS_COLOR[contract.status] ?? 'neutral') as any"
                variant="subtle"
                size="sm"
              >
                {{ CONTRACT_STATUS_LABEL[contract.status] ?? contract.status }}
              </UBadge>
              <UBadge
                v-if="selectedContractId === contract.id"
                color="primary"
                variant="subtle"
                size="sm"
              >
                <UIcon name="i-lucide-crosshair" class="size-3" aria-hidden="true" />
                Dipilih
              </UBadge>
              <UBadge
                v-if="hasSuccessor(contract.id)"
                color="info"
                variant="subtle"
                size="sm"
              >
                <UIcon name="i-lucide-arrow-right" class="size-3" aria-hidden="true" />
                Diperpanjang
              </UBadge>
            </div>
            <p class="mt-1 text-xs text-muted">
              {{ contract.contractType?.name ?? 'Tipe tidak diketahui' }}
              <template v-if="contract.template?.name">
                · {{ contract.template.name }}
              </template>
              <template v-if="parentOf(contract)">
                · Perpanjangan dari <span class="font-mono">{{ parentOf(contract)?.contractNo }}</span>
              </template>
            </p>
          </div>
        </div>

        <dl class="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <div class="flex items-center gap-1.5">
            <dt class="text-muted">
              Periode:
            </dt>
            <dd class="font-medium text-toned">
              {{ formatContractDate(contract.startDate) }} – {{ formatContractDate(contract.endDate) }}
            </dd>
          </div>
          <div class="flex items-center gap-1.5">
            <dt class="text-muted">
              Durasi:
            </dt>
            <dd class="font-medium text-toned">
              {{ durationOf(contract.id) }}
            </dd>
          </div>
          <div v-if="contract.signedDate" class="flex items-center gap-1.5">
            <dt class="text-muted">
              Ditandatangani:
            </dt>
            <dd class="font-medium text-toned">
              {{ formatContractDate(contract.signedDate) }}
            </dd>
          </div>
          <div v-if="contract.positionLabel" class="flex items-center gap-1.5">
            <dt class="text-muted">
              Jabatan:
            </dt>
            <dd class="font-medium text-toned">
              {{ contract.positionLabel }}
            </dd>
          </div>
          <div v-if="contract.workLocationLabel" class="flex items-center gap-1.5">
            <dt class="text-muted">
              Lokasi:
            </dt>
            <dd class="font-medium text-toned">
              {{ contract.workLocationLabel }}
            </dd>
          </div>
          <div v-if="showCompensation" class="flex items-center gap-1.5">
            <dt class="text-muted">
              Kompensasi:
            </dt>
            <dd class="font-medium text-toned">
              {{ formatCurrency(contract.baseCompensation) }}
            </dd>
          </div>
          <div v-if="isCurrent(contract.id) && daysRemainingOf(contract.id) !== null" class="flex items-center gap-1.5">
            <dt class="text-muted">
              Sisa:
            </dt>
            <dd class="font-semibold text-warning">
              {{ daysRemainingOf(contract.id) }} hari
            </dd>
          </div>
        </dl>

        <!-- Tautan dokumen + aksi khusus modal -->
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div v-if="showDocLinks" class="flex flex-wrap gap-3">
            <a
              v-if="contract.documentUrl"
              :href="contract.documentUrl"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <UIcon name="i-lucide-file-text" class="size-3.5" aria-hidden="true" />
              Dokumen
            </a>
            <a
              v-if="contract.generatedPdfUrl"
              :href="contract.generatedPdfUrl"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <UIcon name="i-lucide-file-down" class="size-3.5" aria-hidden="true" />
              PDF
            </a>
          </div>

          <div class="ml-auto flex flex-wrap items-center gap-1.5">
            <slot name="actions" :contract="contract" />
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
