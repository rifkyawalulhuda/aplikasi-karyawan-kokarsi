<script setup lang="ts">
import type { Employee } from '~/types'
import { formatDateShortId } from '~/utils/employee-metrics'
import type { EmployeeDocumentLike } from '~/utils/employee-metrics'

const props = defineProps<{
  employee: Employee
  documents?: EmployeeDocumentLike[]
}>()

type TimelineKind = 'contract' | 'warning' | 'certificate' | 'status'

interface TimelineEvent {
  key: string
  kind: TimelineKind
  date: string
  title: string
  subtitle?: string
  badge: { label: string, color: string }
  documentUrl?: string
  chips?: string[]
  details?: { label: string, value: string }[]
}

interface KindMeta {
  label: string
  icon: string
  dotClass: string
  iconClass: string
}

const KIND_META: Record<TimelineKind, KindMeta> = {
  contract: { label: 'Kontrak', icon: 'i-lucide-file-signature', dotClass: 'bg-primary', iconClass: 'text-primary' },
  warning: { label: 'SP', icon: 'i-lucide-alert-triangle', dotClass: 'bg-warning', iconClass: 'text-warning' },
  certificate: { label: 'Sertifikat', icon: 'i-lucide-badge-check', dotClass: 'bg-success', iconClass: 'text-success' },
  status: { label: 'Status', icon: 'i-lucide-arrow-right-left', dotClass: 'bg-info', iconClass: 'text-info' }
}

const KIND_ORDER: TimelineKind[] = ['contract', 'warning', 'certificate', 'status']

const contractStatusLabelMap: Record<string, string> = {
  DRAFT: 'Draft',
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
  SUDAH_DIPERPANJANG: 'Sudah Diperpanjang'
}

const contractStatusColorMap: Record<string, string> = {
  DRAFT: 'neutral',
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'neutral',
  DIBATALKAN: 'neutral',
  SUDAH_DIPERPANJANG: 'info'
}

const warningLevelLabelMap: Record<number, string> = { 1: 'SP 1', 2: 'SP 2', 3: 'SP 3' }
const warningLevelColorMap: Record<number, string> = { 1: 'warning', 2: 'error', 3: 'error' }

const employmentStatusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK'
}

const employmentStatusColorMap: Record<string, string> = {
  AKTIF: 'success',
  KONTRAK_EXPIRED: 'warning',
  RESIGN: 'neutral',
  PHK: 'error'
}

const docStatusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_EXPIRED: 'Akan Expired',
  EXPIRED: 'Expired'
}

const docStatusColorMap: Record<string, string> = {
  AKTIF: 'success',
  AKAN_EXPIRED: 'warning',
  EXPIRED: 'error'
}

function formatDateTime(val?: string | null) {
  if (!val) return '-'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isExpired(validUntil?: string) {
  if (!validUntil) return false
  const d = new Date(validUntil)
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
}

/** Satu event per baris; "Sudah Diperpanjang" bila kontrak punya anak. */
function contractDisplayStatus(contractId: number): string {
  const contracts = props.employee.contracts ?? []
  const hasChild = contracts.some(c => c.parentContractId === contractId || c.parentContract?.id === contractId)
  if (hasChild) return 'SUDAH_DIPERPANJANG'
  return contracts.find(c => c.id === contractId)?.status ?? 'DRAFT'
}

const events = computed<TimelineEvent[]>(() => {
  const list: TimelineEvent[] = []

  for (const c of props.employee.contracts ?? []) {
    const status = contractDisplayStatus(c.id)
    list.push({
      key: `contract-${c.id}`,
      kind: 'contract',
      date: c.startDate,
      title: c.contractNo,
      subtitle: c.contractType?.name ?? 'Tipe tidak diketahui',
      badge: { label: contractStatusLabelMap[status] ?? status, color: contractStatusColorMap[status] ?? 'neutral' },
      documentUrl: c.documentUrl,
      details: [
        { label: 'Mulai', value: formatDateShortId(c.startDate) },
        { label: 'Selesai', value: formatDateShortId(c.endDate) }
      ]
    })
  }

  for (const w of props.employee.warningLetters ?? []) {
    const expired = isExpired(w.validUntil)
    list.push({
      key: `warning-${w.id}`,
      kind: 'warning',
      date: w.letterDate,
      title: w.letterNumber,
      subtitle: `Oleh: ${w.processedByName}`,
      badge: {
        label: warningLevelLabelMap[w.warningLevel] ?? `SP ${w.warningLevel}`,
        color: warningLevelColorMap[w.warningLevel] ?? 'neutral'
      },
      documentUrl: w.documentUrl ?? undefined,
      chips: Array.isArray(w.violationType) ? w.violationType : [],
      details: [
        { label: 'Tanggal', value: formatDateShortId(w.letterDate) },
        { label: 'Berlaku s/d', value: `${formatDateShortId(w.validUntil)}${expired ? ' (expired)' : ''}` }
      ]
    })
  }

  for (const d of props.documents ?? []) {
    list.push({
      key: `cert-${d.id}`,
      kind: 'certificate',
      date: d.expiryDate ?? '',
      title: d.documentType?.name ?? '-',
      subtitle: d.documentNumber ? `No. ${d.documentNumber}` : undefined,
      badge: {
        label: docStatusLabelMap[d.status ?? ''] ?? d.status ?? '-',
        color: docStatusColorMap[d.status ?? ''] ?? 'neutral'
      },
      documentUrl: d.fileUrl,
      chips: [d.documentType?.documentType, d.documentType?.issuer].filter(Boolean) as string[],
      details: [{ label: 'Berlaku s/d', value: formatDateShortId(d.expiryDate) }]
    })
  }

  for (const h of props.employee.statusHistory ?? []) {
    list.push({
      key: `status-${h.id}`,
      kind: 'status',
      date: h.changedAt,
      title: 'Perubahan status kepegawaian',
      subtitle: `Oleh: ${h.changedByName} (${h.changedByRole})`,
      badge: {
        label: employmentStatusLabelMap[h.newStatus] ?? h.newStatus,
        color: employmentStatusColorMap[h.newStatus] ?? 'neutral'
      },
      details: [
        { label: 'Dari', value: employmentStatusLabelMap[h.oldStatus] ?? h.oldStatus },
        { label: 'Ke', value: employmentStatusLabelMap[h.newStatus] ?? h.newStatus },
        { label: 'Waktu', value: formatDateTime(h.changedAt) }
      ],
      chips: h.notes ? [h.notes] : []
    })
  }

  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const kindCounts = computed(() => {
  const counts = { contract: 0, warning: 0, certificate: 0, status: 0 } as Record<TimelineKind, number>
  for (const e of events.value) counts[e.kind] += 1
  return counts
})

const activeKinds = ref<Set<TimelineKind>>(new Set(KIND_ORDER))

function toggleKind(kind: TimelineKind) {
  const next = new Set(activeKinds.value)
  if (next.has(kind)) next.delete(kind)
  else next.add(kind)
  activeKinds.value = next
}

function showAllKinds() {
  activeKinds.value = new Set(KIND_ORDER)
}

const allActive = computed(() => activeKinds.value.size === KIND_ORDER.length)

const filtered = computed(() =>
  events.value.filter(e => activeKinds.value.has(e.kind))
)

// Gradient fade hanya ditampilkan bila konten benar-benar meluap (bisa di-scroll).
const scrollEl = ref<HTMLElement | null>(null)
const hasOverflow = ref(false)

function updateOverflow() {
  const el = scrollEl.value
  if (!el) return
  hasOverflow.value = el.scrollHeight > el.clientHeight + 1
}

let overflowObserver: ResizeObserver | null = null

onMounted(() => {
  updateOverflow()
  if (typeof ResizeObserver !== 'undefined' && scrollEl.value) {
    overflowObserver = new ResizeObserver(updateOverflow)
    overflowObserver.observe(scrollEl.value)
  }
})

onBeforeUnmount(() => {
  overflowObserver?.disconnect()
  overflowObserver = null
})

watch(filtered, () => nextTick(updateOverflow))

const moduleLinks = computed(() => [
  [
    {
      label: 'Riwayat kontrak',
      icon: 'i-lucide-file-signature',
      to: `/kontrak?search=${encodeURIComponent(props.employee.fullName)}`
    },
    {
      label: 'Surat peringatan',
      icon: 'i-lucide-alert-triangle',
      to: `/dokumen/surat-peringatan?search=${encodeURIComponent(props.employee.fullName)}`
    },
    {
      label: 'Sertifikasi & ijin',
      icon: 'i-lucide-badge-check',
      to: `/dokumen/sertifikasi-ijin?search=${encodeURIComponent(props.employee.fullName)}`
    }
  ]
])
</script>

<template>
  <section class="rounded-2xl border border-default bg-default">
    <!-- Header -->
    <header class="flex items-center justify-between gap-2 border-b border-default p-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-history" class="size-4 text-muted" aria-hidden="true" />
        <h2 class="text-base font-semibold text-highlighted">
          Jejak Karier
        </h2>
        <span class="text-sm font-normal text-muted">({{ events.length }})</span>
      </div>
      <UDropdownMenu :items="moduleLinks">
        <UButton
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Buka modul terkait"
        />
      </UDropdownMenu>
    </header>

    <!-- Filter chips -->
    <div class="flex flex-wrap gap-2 border-b border-default p-4">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="allActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-default text-muted hover:bg-elevated/60 hover:text-highlighted'"
        :aria-pressed="allActive"
        @click="showAllKinds"
      >
        Semua
        <span class="tabular-nums opacity-70">{{ events.length }}</span>
      </button>
      <button
        v-for="kind in KIND_ORDER"
        :key="kind"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="activeKinds.has(kind)
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-default text-muted hover:bg-elevated/60 hover:text-highlighted'"
        :aria-pressed="activeKinds.has(kind)"
        @click="toggleKind(kind)"
      >
        <span class="size-2 rounded-full" :class="KIND_META[kind].dotClass" />
        {{ KIND_META[kind].label }}
        <span class="tabular-nums opacity-70">{{ kindCounts[kind] }}</span>
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="filtered.length === 0" class="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <UIcon name="i-lucide-inbox" class="size-10 text-muted" aria-hidden="true" />
      <p class="text-sm text-muted">
        {{ events.length === 0 ? 'Belum ada riwayat untuk karyawan ini.' : 'Tidak ada riwayat pada filter yang dipilih.' }}
      </p>
      <UButton
        v-if="events.length > 0 && !allActive"
        label="Tampilkan semua"
        color="neutral"
        variant="subtle"
        size="xs"
        @click="showAllKinds"
      />
    </div>

    <!-- Timeline -->
    <div v-else class="relative">
      <div ref="scrollEl" class="max-h-[600px] overflow-y-auto overscroll-contain">
        <div class="relative p-4">
          <div class="absolute left-[27px] top-6 bottom-6 w-px bg-border" aria-hidden="true" />
          <ol class="space-y-3">
            <li
              v-for="(ev, i) in filtered"
              :key="ev.key"
              class="dossier-rise relative pl-11"
              :style="{ animationDelay: `${Math.min(i, 8) * 30}ms` }"
            >
              <!-- Node -->
              <div class="absolute left-2 top-3 flex size-5 items-center justify-center rounded-full border border-default bg-default">
                <UIcon
                  :name="KIND_META[ev.kind].icon"
                  class="size-3"
                  :class="KIND_META[ev.kind].iconClass"
                  aria-hidden="true"
                />
              </div>

              <article class="rounded-xl border border-default bg-default p-4 transition-colors hover:border-primary/40">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-highlighted">
                      {{ ev.title }}
                    </p>
                    <p v-if="ev.subtitle" class="mt-0.5 text-xs text-muted">
                      {{ ev.subtitle }}
                    </p>
                  </div>
                  <UBadge :color="(ev.badge.color as any)" variant="subtle" size="sm">
                    {{ ev.badge.label }}
                  </UBadge>
                </div>

                <div v-if="ev.chips?.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="(chip, ci) in ev.chips"
                    :key="ci"
                    class="inline-flex items-center rounded-md bg-elevated px-2 py-0.5 text-xs text-muted"
                  >
                    {{ chip }}
                  </span>
                </div>

                <dl v-if="ev.details?.length" class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                  <div v-for="d in ev.details" :key="d.label" class="flex items-center gap-1">
                    <dt class="opacity-80">
                      {{ d.label }}:
                    </dt>
                    <dd class="font-medium text-toned">
                      {{ d.value }}
                    </dd>
                  </div>
                </dl>

                <a
                  v-if="ev.documentUrl"
                  :href="ev.documentUrl"
                  target="_blank"
                  rel="noopener"
                  class="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <UIcon name="i-lucide-file-text" class="size-3.5" aria-hidden="true" />
                  Lihat dokumen
                </a>
              </article>
            </li>
          </ol>
        </div>
      </div>

      <!-- Gradient fade bawah: isyarat konten masih bisa di-scroll -->
      <div
        v-show="hasOverflow"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-default to-transparent"
        aria-hidden="true"
      />
    </div>
  </section>
</template>
