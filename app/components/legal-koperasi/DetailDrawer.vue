<script setup lang="ts">
interface LegalKoperasi {
  id: number
  category: 'IZIN' | 'SERTIFIKAT' | 'KEBIJAKAN' | 'DOKUMEN_INTERNAL' | 'DOKUMEN_B3' | 'LAIN_LAIN'
  documentName: string
  documentNumber: string
  publisher: string
  documentDate: string
  needsRenewal: boolean
  startDate?: string | null
  endDate?: string | null
  status: 'AKTIF' | 'AKAN_BERAKHIR' | 'EXPIRED' | 'TIDAK_AKTIF'
  location?: string | null
  notes?: string | null
  fileUrl?: string | null
  renewedFrom?: { id: number; documentName: string; documentNumber: string; fileUrl?: string | null; documentDate: string } | null
  renewedTo?: { id: number; documentName: string; documentNumber: string; status: string; documentDate: string } | null
  createdAt: string
  updatedAt: string
}

type BadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

const props = defineProps<{
  open: boolean
  document: LegalKoperasi | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [document: LegalKoperasi]
  'renew': [document: LegalKoperasi]
  'open-document': [id: number]
}>()

// --- Helpers ---
function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isPdf(url: string): boolean {
  return url.toLowerCase().includes('.pdf')
}

const previewOpen = ref(false)

// Reset preview when document changes
watch(() => props.document?.id, () => {
  previewOpen.value = false
})

// --- Status maps ---
const statusColor: Record<string, BadgeColor> = {
  AKTIF: 'success',
  AKAN_BERAKHIR: 'warning',
  EXPIRED: 'error',
  TIDAK_AKTIF: 'neutral',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_BERAKHIR: 'Akan Berakhir',
  EXPIRED: 'Expired',
  TIDAK_AKTIF: 'Tidak Aktif',
}

const statusIcon: Record<string, string> = {
  AKTIF: 'i-lucide-shield-check',
  AKAN_BERAKHIR: 'i-lucide-alert-triangle',
  EXPIRED: 'i-lucide-clock',
  TIDAK_AKTIF: 'i-lucide-minus-circle',
}

const statusRingClass: Record<string, string> = {
  AKTIF: 'bg-success/10 text-success',
  AKAN_BERAKHIR: 'bg-warning/10 text-warning',
  EXPIRED: 'bg-error/10 text-error',
  TIDAK_AKTIF: 'bg-muted/10 text-muted',
}

const statusBarClass: Record<string, string> = {
  AKTIF: 'bg-success',
  AKAN_BERAKHIR: 'bg-warning',
  EXPIRED: 'bg-error',
  TIDAK_AKTIF: 'bg-muted',
}

const statusTextClass: Record<string, string> = {
  AKTIF: 'text-success',
  AKAN_BERAKHIR: 'text-warning',
  EXPIRED: 'text-error',
  TIDAK_AKTIF: 'text-muted',
}

// --- Category maps ---
const categoryColor: Record<string, BadgeColor> = {
  IZIN: 'warning',
  SERTIFIKAT: 'info',
  KEBIJAKAN: 'success',
  DOKUMEN_INTERNAL: 'primary',
  DOKUMEN_B3: 'error',
  LAIN_LAIN: 'neutral',
}

const categoryLabel: Record<string, string> = {
  IZIN: 'Izin',
  SERTIFIKAT: 'Sertifikat',
  KEBIJAKAN: 'Kebijakan',
  DOKUMEN_INTERNAL: 'Dokumen Internal',
  DOKUMEN_B3: 'Dokumen B3',
  LAIN_LAIN: 'Lain-lain',
}

const categoryIcon: Record<string, string> = {
  IZIN: 'i-lucide-shield',
  SERTIFIKAT: 'i-lucide-award',
  KEBIJAKAN: 'i-lucide-scroll',
  DOKUMEN_INTERNAL: 'i-lucide-file-code',
  DOKUMEN_B3: 'i-lucide-flask-conical',
  LAIN_LAIN: 'i-lucide-file-text',
}

// --- Expiry calculations ---
const daysUntilExpiry = computed(() => {
  if (!props.document?.needsRenewal || !props.document?.endDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(props.document.endDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
})

const totalDays = computed(() => {
  const d = props.document
  if (!d?.endDate || !d.needsRenewal || daysUntilExpiry.value === null) return 0
  const start = new Date(d.startDate ?? d.createdAt)
  start.setHours(0, 0, 0, 0)
  const expiry = new Date(d.endDate)
  expiry.setHours(0, 0, 0, 0)
  const total = Math.ceil((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return total > 0 ? total : 1
})

const progressPercent = computed(() => {
  if (daysUntilExpiry.value === null || daysUntilExpiry.value < 0) return 0
  const raw = (daysUntilExpiry.value / totalDays.value) * 100
  return Math.min(100, Math.max(0, raw))
})

function daysText(): string {
  const d = daysUntilExpiry.value
  if (d === null) return ''
  if (d < 0) return 'Masa berlaku telah berakhir'
  if (d === 0) return 'Expired hari ini'
  return `Sisa ${d} hari`
}

// Display status — jika sudah diperpanjang, tampilkan "Sudah Diperpanjang"
const displayStatus = computed(() => {
  if (!props.document) return null
  if (props.document.renewedTo) return 'SUDAH_DIPERPANJANG'
  return props.document.status
})
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-center gap-3 w-full min-w-0">
        <!-- Kategori ring -->
        <div
          v-if="document"
          class="flex size-11 shrink-0 items-center justify-center rounded-full"
          :class="categoryColor[document.category] ? `bg-${categoryColor[document.category]}/10 text-${categoryColor[document.category]}` : 'bg-elevated text-muted'"
        >
          <UIcon :name="categoryIcon[document.category] ?? 'i-lucide-file-text'" class="size-5" />
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold text-highlighted truncate">
            {{ document?.documentName ?? '-' }}
          </p>
          <div class="flex flex-wrap items-center gap-2 mt-1">
            <UBadge
              v-if="document?.category"
              :label="categoryLabel[document.category] ?? document.category"
              :color="categoryColor[document.category] ?? 'neutral'"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="document?.status"
              :label="displayStatus === 'SUDAH_DIPERPANJANG' ? 'Sudah Diperpanjang' : (statusLabel[document.status] ?? document.status)"
              :color="displayStatus === 'SUDAH_DIPERPANJANG' ? 'info' : (statusColor[document.status] ?? 'neutral')"
              variant="subtle"
              size="sm"
            />
          </div>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="document" class="space-y-5 py-2">

        <!-- Expiry Status Card (signature) -->
        <div class="rounded-xl border border-default bg-default p-4">

          <!-- Kondisi: tidak memerlukan perpanjangan -->
          <template v-if="!document.needsRenewal">
            <div class="flex items-center gap-4">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UIcon name="i-lucide-infinity" class="size-6" />
              </div>
              <div>
                <p class="text-sm font-semibold text-highlighted">Tidak Memerlukan Perpanjangan</p>
                <p class="text-sm text-muted">Dokumen ini berlaku tanpa batas waktu atau tidak memerlukan pembaruan</p>
              </div>
            </div>
          </template>

          <!-- Kondisi: sudah diperpanjang -->
          <template v-else-if="document.renewedTo">
            <div class="flex items-center gap-4">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                <UIcon name="i-lucide-check-circle-2" class="size-6" />
              </div>
              <div>
                <p class="text-sm font-semibold text-highlighted">Sudah Diperpanjang</p>
                <p class="text-sm text-muted">Dokumen ini telah diperpanjang. Lihat dokumen baru di bawah.</p>
              </div>
            </div>
          </template>

          <!-- Kondisi: tidak aktif -->
          <template v-else-if="document.status === 'TIDAK_AKTIF'">
            <div class="flex items-center gap-4">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted/10 text-muted">
                <UIcon name="i-lucide-minus-circle" class="size-6" />
              </div>
              <div>
                <p class="text-sm font-semibold text-highlighted">Tidak Aktif</p>
                <p class="text-sm text-muted">Dokumen ini berstatus tidak aktif</p>
              </div>
            </div>
          </template>

          <!-- Kondisi: aktif / akan berakhir / expired dengan countdown -->
          <template v-else>
            <div class="flex items-center gap-4">
              <div
                class="flex size-12 shrink-0 items-center justify-center rounded-full"
                :class="statusRingClass[document.status] ?? 'bg-elevated text-muted'"
              >
                <UIcon :name="statusIcon[document.status] ?? 'i-lucide-file-badge'" class="size-6" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-highlighted">
                  {{ statusLabel[document.status] ?? document.status }}
                </p>
                <p
                  v-if="document.status === 'EXPIRED'"
                  class="text-lg font-bold tabular-nums leading-tight text-error"
                >
                  Masa berlaku telah berakhir
                </p>
                <p
                  v-else-if="daysUntilExpiry !== null"
                  class="text-lg font-bold tabular-nums leading-tight"
                  :class="statusTextClass[document.status] ?? 'text-highlighted'"
                >
                  {{ daysText() }}
                </p>
              </div>
            </div>

            <!-- Progress bar -->
            <div v-if="daysUntilExpiry !== null" class="mt-3">
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="statusBarClass[document.status] ?? 'bg-primary'"
                  :style="{ width: `${progressPercent}%` }"
                />
              </div>
              <div class="mt-1.5 text-xs text-muted">
                Berlaku sampai {{ formatDate(document.endDate) }}
              </div>
            </div>
          </template>
        </div>

        <!-- Info cards: 2 kartu bersih -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Kartu 1: Dokumen -->
          <div class="rounded-xl border border-default bg-default p-4 space-y-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">Dokumen</p>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">No. Dokumen</p>
              <p class="inline-flex items-center gap-1.5 text-sm font-mono text-highlighted">
                <UIcon name="i-lucide-hash" class="size-3.5 text-muted" />
                {{ document.documentNumber || '-' }}
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Tanggal Dokumen</p>
              <p class="text-sm text-highlighted">{{ formatDate(document.documentDate) }}</p>
            </div>
            <div v-if="document.needsRenewal && document.startDate">
              <p class="text-xs font-medium text-muted mb-0.5">Tanggal Mulai</p>
              <p class="text-sm text-highlighted">{{ formatDate(document.startDate) }}</p>
            </div>
            <div v-if="document.location">
              <p class="text-xs font-medium text-muted mb-0.5">Lokasi</p>
              <p class="text-sm text-highlighted">{{ document.location }}</p>
            </div>
          </div>

          <!-- Kartu 2: Penerbitan -->
          <div class="rounded-xl border border-default bg-default p-4 space-y-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">Penerbitan</p>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Penerbit</p>
              <p class="text-sm text-highlighted">{{ document.publisher || '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Kategori</p>
              <UBadge
                :label="categoryLabel[document.category] ?? document.category"
                :color="categoryColor[document.category] ?? 'neutral'"
                variant="subtle"
              />
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Dibuat</p>
              <p class="text-xs text-muted">{{ formatDate(document.createdAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Renewal Chain Timeline (signature element) -->
        <div v-if="document.renewedFrom || document.renewedTo" class="space-y-2">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Rantai Perpanjangan</p>
          <div class="relative pl-5">
            <!-- Garis konektor vertikal -->
            <div class="absolute left-1.5 top-2.5 bottom-2.5 border-l-2 border-dashed border-default" />

            <!-- Node: Dokumen Lama (renewedFrom) -->
            <div v-if="document.renewedFrom" class="relative mb-4">
              <div class="absolute -left-3.5 top-1.5 size-2.5 rounded-full border-2 border-default bg-elevated" />
              <div class="rounded-lg border border-default bg-elevated/40 p-3">
                <p class="text-xs font-medium text-muted mb-0.5">Perpanjangan Dari</p>
                <p class="text-sm font-medium text-highlighted truncate">{{ document.renewedFrom.documentName }}</p>
                <p class="text-xs font-mono text-muted">{{ document.renewedFrom.documentNumber }}</p>
                <p class="text-xs text-muted mt-1">{{ formatDate(document.renewedFrom.documentDate) }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <a
                    v-if="document.renewedFrom.fileUrl"
                    :href="document.renewedFrom.fileUrl"
                    target="_blank"
                    class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <UIcon name="i-lucide-download" class="size-3" /> Unduh
                  </a>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    @click="emit('open-document', document.renewedFrom!.id)"
                  >
                    <UIcon name="i-lucide-arrow-up-right" class="size-3" /> Lihat Detail
                  </button>
                </div>
              </div>
            </div>

            <!-- Node: Dokumen Ini (aktif/center) -->
            <div class="relative mb-4">
              <div class="absolute -left-3.5 top-1.5 size-3 rounded-full bg-primary" />
              <div class="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p class="text-xs font-medium text-primary mb-0.5">Dokumen Ini</p>
                <p class="text-sm font-medium text-highlighted truncate">{{ document.documentName }}</p>
                <p class="text-xs font-mono text-muted">{{ document.documentNumber }}</p>
              </div>
            </div>

            <!-- Node: Dokumen Baru (renewedTo) -->
            <div v-if="document.renewedTo" class="relative">
              <div class="absolute -left-3.5 top-1.5 size-2.5 rounded-full border-2 border-default bg-elevated" />
              <div class="rounded-lg border border-default bg-elevated/40 p-3">
                <p class="text-xs font-medium text-muted mb-0.5">Diperpanjang Ke</p>
                <p class="text-sm font-medium text-highlighted truncate">{{ document.renewedTo.documentName }}</p>
                <p class="text-xs font-mono text-muted">{{ document.renewedTo.documentNumber }}</p>
                <p class="text-xs text-muted mt-1">{{ formatDate(document.renewedTo.documentDate) }}</p>
                <button
                  type="button"
                  class="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  @click="emit('open-document', document.renewedTo!.id)"
                >
                  <UIcon name="i-lucide-arrow-right" class="size-3" /> Lihat Dokumen Baru
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Keterangan -->
        <div v-if="document.notes">
          <USeparator />
          <div class="mt-4 border-l-2 border-default pl-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide mb-1">Keterangan</p>
            <p class="text-sm text-highlighted whitespace-pre-wrap">{{ document.notes }}</p>
          </div>
        </div>

        <!-- File dokumen -->
        <div v-if="document.fileUrl">
          <USeparator v-if="!document.notes" />
          <div class="mt-4">
            <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">File Dokumen</p>
            <div class="flex items-center gap-2">
              <a
                :href="document.fileUrl"
                target="_blank"
                class="inline-flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm text-primary hover:bg-elevated transition-colors"
              >
                <UIcon name="i-lucide-download" class="size-4 shrink-0" />
                Unduh
              </a>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-primary hover:bg-elevated/60 transition-colors"
                @click="previewOpen = !previewOpen"
              >
                <UIcon name="i-lucide-eye" class="size-4" />
                {{ previewOpen ? 'Sembunyikan Preview' : 'Lihat Preview' }}
              </button>
            </div>
            <!-- Preview area -->
            <div v-if="previewOpen" class="mt-2 rounded-lg border border-default overflow-hidden">
              <div v-if="isPdf(document.fileUrl)" class="h-[480px]">
                <PdfViewer :src="document.fileUrl" />
              </div>
              <img
                v-else
                :src="document.fileUrl"
                alt="Preview Dokumen"
                class="w-full object-contain max-h-96"
              />
            </div>
          </div>
        </div>

        <!-- Metadata -->
        <USeparator />
        <div class="grid grid-cols-2 gap-3 text-xs text-muted">
          <div>
            <span class="font-medium">Dibuat:</span>
            {{ formatDate(document.createdAt) }}
          </div>
          <div>
            <span class="font-medium">Diperbarui:</span>
            {{ formatDate(document.updatedAt) }}
          </div>
        </div>

      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center gap-2 py-16 text-muted">
        <UIcon name="i-lucide-file-text" class="size-10 opacity-40" />
        <p class="text-sm">Tidak ada data yang dipilih</p>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-2 w-full">
        <UButton
          label="Tutup"
          color="neutral"
          variant="subtle"
          @click="emit('update:open', false)"
        />
        <div class="flex items-center gap-2">
          <UButton
            v-if="document?.needsRenewal && (document?.status === 'AKAN_BERAKHIR' || document?.status === 'EXPIRED') && !document?.renewedTo"
            label="Perpanjang"
            icon="i-lucide-refresh-cw"
            color="warning"
            variant="outline"
            @click="emit('renew', document)"
          />
          <UButton
            v-if="document"
            label="Edit"
            icon="i-lucide-pencil"
            color="primary"
            @click="emit('edit', document)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
