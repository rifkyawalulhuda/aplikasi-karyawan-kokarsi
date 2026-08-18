<script setup lang="ts">
import type { WarningLetter } from '~/types'

const props = defineProps<{
  open: boolean
  letter: WarningLetter | null
  history: WarningLetter[]
  historyLoading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [letter: WarningLetter]
  'delete': [id: number]
  'switch': [letter: WarningLetter]
  'generate-pdf': [letter: WarningLetter]
}>()

// --- Helpers ---
function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateLong(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Reset preview when letter changes
const previewOpen = ref(false)
const previewPdfSrc = ref('')
const previewLoading = ref(false)

watch(() => props.letter?.id, () => {
  previewOpen.value = false
  previewPdfSrc.value = ''
})

// --- SP Level Maps ---
type BadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

const levelColor: Record<number, BadgeColor> = {
  1: 'info',
  2: 'warning',
  3: 'error',
}

const levelIcon: Record<number, string> = {
  1: 'i-lucide-alert-circle',
  2: 'i-lucide-alert-triangle',
  3: 'i-lucide-alert-octagon',
}

const levelLabel: Record<number, string> = {
  1: 'Surat Peringatan 1',
  2: 'Surat Peringatan 2',
  3: 'Surat Peringatan 3',
}

const levelRingClass: Record<number, string> = {
  1: 'bg-info/10 text-info',
  2: 'bg-warning/10 text-warning',
  3: 'bg-error/10 text-error',
}

const levelBarClass: Record<number, string> = {
  1: 'bg-info',
  2: 'bg-warning',
  3: 'bg-error',
}

const levelTextClass: Record<number, string> = {
  1: 'text-info',
  2: 'text-warning',
  3: 'text-error',
}

const levelBorderClass: Record<number, string> = {
  1: 'border-info/40',
  2: 'border-warning/40',
  3: 'border-error/40',
}

// --- Validity countdown ---
const daysUntilExpiry = computed(() => {
  if (!props.letter?.validUntil) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(props.letter.validUntil)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
})

const totalDays = computed(() => {
  const l = props.letter
  if (!l?.letterDate || !l?.validUntil) return 1
  const start = new Date(l.letterDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(l.validUntil)
  end.setHours(0, 0, 0, 0)
  const total = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return total > 0 ? total : 1
})

const progressPercent = computed(() => {
  if (daysUntilExpiry.value === null) return 0
  const raw = (daysUntilExpiry.value / totalDays.value) * 100
  return Math.min(100, Math.max(0, raw))
})

function daysText(): string {
  const d = daysUntilExpiry.value
  if (d === null) return ''
  if (d < 0) return `Berakhir ${Math.abs(d)} hari lalu`
  if (d === 0) return 'Berakhir hari ini'
  return `Sisa ${d} hari berlaku`
}

// --- Escalation timeline ---
// All SP levels this employee has received (from history)
const employeeSpLevels = computed(() => {
  const set = new Set(props.history.map(h => h.warningLevel))
  return set
})

// SP riwayat lain (exclude current letter)
const otherHistory = computed(() =>
  props.history
    .filter(h => h.id !== props.letter?.id)
    .sort((a, b) => new Date(b.letterDate).getTime() - new Date(a.letterDate).getTime())
)

// --- Preview PDF ---
async function openPreview() {
  if (!props.letter) return
  previewLoading.value = true
  previewOpen.value = true
  try {
    const blob = await $fetch<Blob>(`/api/warning-letters/${props.letter.id}/preview`, {
      responseType: 'blob',
      credentials: 'include',
    })
    previewPdfSrc.value = URL.createObjectURL(blob)
  } catch {
    previewOpen.value = false
  } finally {
    previewLoading.value = false
  }
}

async function handleGeneratePDF() {
  if (!props.letter) return
  emit('generate-pdf', props.letter)
}

const { confirmDeleteToast } = useConfirmDeleteToast()
function handleDelete() {
  if (!props.letter) return
  confirmDeleteToast({
    title: `Hapus SP ${props.letter.warningLevel}?`,
    description: `Surat Peringatan ${props.letter.letterNumber} untuk ${props.letter.employee?.fullName} akan dihapus permanen.`,
    confirmLabel: 'Hapus SP',
    onConfirm: () => {
      emit('delete', props.letter!.id)
      emit('update:open', false)
    },
  })
}
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div v-if="letter" class="flex items-center gap-3 w-full min-w-0">
        <!-- Level ring icon -->
        <div
          class="flex size-11 shrink-0 items-center justify-center rounded-full"
          :class="levelRingClass[letter.warningLevel] ?? 'bg-elevated text-muted'"
        >
          <UIcon :name="levelIcon[letter.warningLevel] ?? 'i-lucide-file-warning'" class="size-5" />
        </div>

        <!-- Title -->
        <div class="min-w-0 flex-1">
          <p class="text-base font-semibold text-highlighted truncate font-mono">
            {{ letter.letterNumber }}
          </p>
          <div class="flex items-center gap-2 mt-0.5">
            <UBadge :color="levelColor[letter.warningLevel]" variant="subtle" size="sm">
              SP {{ letter.warningLevel }}
            </UBadge>
            <span class="text-xs text-muted truncate">{{ letter.employee?.fullName }}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            size="sm"
            title="Edit SP"
            @click="emit('edit', letter)"
          />
          <UButton
            icon="i-lucide-file-text"
            variant="ghost"
            color="neutral"
            size="sm"
            title="Generate PDF"
            @click="handleGeneratePDF"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="sm"
            title="Hapus SP"
            @click="handleDelete"
          />
        </div>
      </div>

      <div v-else class="flex items-center gap-3">
        <div class="flex size-11 items-center justify-center rounded-full bg-elevated">
          <UIcon name="i-lucide-file-warning" class="size-5 text-muted" />
        </div>
        <p class="text-base font-semibold text-muted">Tidak ada data</p>
      </div>
    </template>

    <template #body>
      <div v-if="letter" class="space-y-5 py-2">

        <!-- ── A. SP Escalation Timeline (signature) ──────────────── -->
        <div
          class="rounded-xl border p-4"
          :class="levelBorderClass[letter.warningLevel] ?? 'border-default'"
          :style="{ background: 'var(--ui-bg)' }"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Eskalasi Peringatan</p>

          <!-- 3-node timeline -->
          <div class="flex items-center gap-0">
            <template v-for="lvl in [1, 2, 3]" :key="lvl">
              <!-- Node -->
              <div class="flex flex-col items-center gap-1.5 flex-1">
                <div
                  class="flex size-10 items-center justify-center rounded-full border-2 transition-all"
                  :class="employeeSpLevels.has(lvl)
                    ? [levelRingClass[lvl], 'border-current ring-2 ring-offset-2', `ring-${lvl === 1 ? 'info' : lvl === 2 ? 'warning' : 'error'}-400/30`]
                    : 'bg-elevated text-muted border-default'"
                >
                  <UIcon
                    :name="levelIcon[lvl]"
                    :class="employeeSpLevels.has(lvl) ? 'size-4.5' : 'size-4.5 opacity-40'"
                  />
                </div>
                <span
                  class="text-xs font-semibold"
                  :class="employeeSpLevels.has(lvl) ? levelTextClass[lvl] : 'text-muted opacity-50'"
                >
                  SP {{ lvl }}
                </span>
              </div>

              <!-- Connector (between nodes) -->
              <div
                v-if="lvl < 3"
                class="h-0.5 flex-1 -mt-5 mx-1"
                :class="employeeSpLevels.has(lvl) && employeeSpLevels.has(lvl + 1)
                  ? (lvl === 1 ? 'bg-info/60' : 'bg-warning/60')
                  : 'bg-default'"
              />
            </template>
          </div>

          <!-- Summary -->
          <p class="text-xs text-muted mt-3 text-center">
            <span v-if="employeeSpLevels.size === 0">Belum ada riwayat SP</span>
            <span v-else-if="employeeSpLevels.size === 3" class="text-error font-medium">
              Karyawan ini telah menerima semua level SP
            </span>
            <span v-else>
              Karyawan ini telah menerima
              <span class="font-semibold text-highlighted">{{ employeeSpLevels.size }} dari 3</span>
              level SP
            </span>
          </p>
        </div>

        <!-- ── B. Validity Countdown (signature) ─────────────────── -->
        <div class="rounded-xl border border-default bg-default p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Masa Berlaku</p>

          <div class="flex items-start gap-3 mb-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-full"
              :class="levelRingClass[letter.warningLevel]"
            >
              <UIcon name="i-lucide-clock" class="size-5" />
            </div>
            <div class="flex-1">
              <p
                class="text-2xl font-bold tabular-nums leading-tight"
                :class="daysUntilExpiry !== null && daysUntilExpiry < 0 ? 'text-muted' : levelTextClass[letter.warningLevel]"
              >
                {{ daysUntilExpiry !== null ? (daysUntilExpiry < 0 ? Math.abs(daysUntilExpiry) : daysUntilExpiry) : '-' }}
                <span class="text-sm font-normal text-muted">hari</span>
              </p>
              <p class="text-sm text-muted">{{ daysText() }}</p>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="relative h-2 rounded-full bg-elevated overflow-hidden mb-2">
            <div
              class="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              :class="levelBarClass[letter.warningLevel]"
              :style="{ width: `${progressPercent}%`, opacity: daysUntilExpiry !== null && daysUntilExpiry < 0 ? 0.3 : 1 }"
            />
          </div>

          <!-- Date range -->
          <div class="flex justify-between text-xs text-muted mt-1">
            <span>{{ formatDate(letter.letterDate) }}</span>
            <span>{{ formatDate(letter.validUntil) }}</span>
          </div>
        </div>

        <!-- ── C. Jenis Pelanggaran (chips) ──────────────────────── -->
        <div class="rounded-xl border border-default bg-default p-4">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-lucide-tag" class="size-4 text-muted" />
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">Jenis Pelanggaran</p>
          </div>

          <div v-if="letter.violationType?.length" class="flex flex-wrap gap-2">
            <UBadge
              v-for="(vtype, idx) in letter.violationType"
              :key="idx"
              :color="levelColor[letter.warningLevel]"
              variant="subtle"
              class="text-sm"
            >
              {{ vtype }}
            </UBadge>
          </div>
          <p v-else class="text-sm text-muted italic">Tidak ada jenis pelanggaran tercatat</p>
        </div>

        <!-- ── D. Info Card (2-kolom) ─────────────────────────────── -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Karyawan -->
          <div class="rounded-xl border border-default bg-default p-4 space-y-2">
            <div class="flex items-center gap-1.5 mb-1">
              <UIcon name="i-lucide-user" class="size-3.5 text-muted" />
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">Karyawan</p>
            </div>
            <div>
              <p class="text-sm font-semibold text-highlighted">{{ letter.employee?.fullName ?? '-' }}</p>
              <p class="text-xs text-muted font-mono">{{ letter.employee?.employeeNo ?? '-' }}</p>
            </div>
            <p v-if="letter.employee?.jobRole?.name" class="text-xs text-muted">
              {{ letter.employee.jobRole.name }}
            </p>
          </div>

          <!-- Pengurus -->
          <div class="rounded-xl border border-default bg-default p-4 space-y-2">
            <div class="flex items-center gap-1.5 mb-1">
              <UIcon name="i-lucide-shield-check" class="size-3.5 text-muted" />
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">Pengurus</p>
            </div>
            <div>
              <p class="text-sm font-semibold text-highlighted">{{ letter.processedByName || '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted">Tanggal surat</p>
              <p class="text-xs font-medium text-highlighted">{{ formatDateLong(letter.letterDate) }}</p>
            </div>
          </div>
        </div>

        <!-- ── E. Dokumen ──────────────────────────────────────────── -->
        <div class="rounded-xl border border-default bg-default p-4">
          <div class="flex items-center gap-1.5 mb-3">
            <UIcon name="i-lucide-paperclip" class="size-4 text-muted" />
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">Dokumen</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <!-- Preview PDF -->
            <UButton
              label="Preview PDF"
              icon="i-lucide-eye"
              color="neutral"
              variant="subtle"
              size="sm"
              :loading="previewLoading"
              @click="openPreview"
            />

            <!-- Generate & Download PDF -->
            <UButton
              label="Unduh PDF"
              icon="i-lucide-download"
              color="neutral"
              variant="subtle"
              size="sm"
              @click="handleGeneratePDF"
            />

            <!-- Download scan dokumen -->
            <UButton
              v-if="letter.documentUrl"
              label="Unduh Dokumen Scan"
              icon="i-lucide-file-down"
              color="neutral"
              variant="subtle"
              size="sm"
              :to="letter.documentUrl"
              target="_blank"
            />
          </div>
        </div>

        <!-- ── F. Riwayat SP Karyawan ─────────────────────────────── -->
        <div>
          <div class="flex items-center gap-2 mb-3 pt-1 border-t border-default">
            <UIcon name="i-lucide-history" class="size-4 text-muted mt-3" />
            <div class="mt-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                Riwayat SP — {{ letter.employee?.fullName }}
              </p>
            </div>
            <UBadge
              v-if="!historyLoading && otherHistory.length > 0"
              color="neutral"
              variant="subtle"
              size="xs"
              class="mt-3 ml-auto"
            >
              {{ otherHistory.length }}
            </UBadge>
          </div>

          <!-- Loading skeleton -->
          <div v-if="historyLoading" class="space-y-2">
            <div v-for="i in 2" :key="i" class="h-14 rounded-xl bg-elevated animate-pulse" />
          </div>

          <!-- Empty state -->
          <div
            v-else-if="otherHistory.length === 0"
            class="flex flex-col items-center gap-2 py-6 text-muted rounded-xl border border-dashed border-default"
          >
            <UIcon name="i-lucide-clipboard-list" class="size-8 opacity-30" />
            <p class="text-sm">Belum ada riwayat SP lain</p>
          </div>

          <!-- History list -->
          <div v-else class="space-y-2">
            <button
              v-for="hist in otherHistory"
              :key="hist.id"
              class="w-full text-left rounded-xl border border-default bg-default p-3 hover:bg-elevated/60 transition-colors group"
              @click="emit('switch', hist)"
            >
              <div class="flex items-center gap-3">
                <!-- Level icon -->
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-full"
                  :class="levelRingClass[hist.warningLevel] ?? 'bg-elevated text-muted'"
                >
                  <UIcon :name="levelIcon[hist.warningLevel] ?? 'i-lucide-file-warning'" class="size-3.5" />
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <UBadge :color="levelColor[hist.warningLevel]" variant="subtle" size="xs">
                      SP {{ hist.warningLevel }}
                    </UBadge>
                    <span class="text-xs font-mono text-muted truncate">{{ hist.letterNumber }}</span>
                  </div>
                  <p class="text-xs text-muted mt-0.5">{{ formatDate(hist.letterDate) }}</p>
                </div>

                <!-- Arrow on hover -->
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </div>
            </button>
          </div>
        </div>

      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center gap-3 py-16 text-muted">
        <UIcon name="i-lucide-file-warning" class="size-12 opacity-20" />
        <p class="text-sm">Pilih surat peringatan untuk melihat detail</p>
      </div>
    </template>
  </USlideover>

  <!-- Preview Modal -->
  <UModal
    v-model:open="previewOpen"
    title="Preview Surat Peringatan"
    :ui="{ content: 'max-w-4xl' }"
  >
    <template #body>
      <div class="h-[75vh]">
        <PdfViewer v-if="previewPdfSrc" :src="previewPdfSrc" />
        <div v-else class="flex items-center justify-center h-full text-muted">
          <UIcon name="i-lucide-loader-2" class="size-8 animate-spin" />
        </div>
      </div>
    </template>
  </UModal>
</template>
