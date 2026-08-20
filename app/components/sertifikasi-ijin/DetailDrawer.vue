<script setup lang="ts">
interface EmployeeDocument {
  id: number
  employeeId: number
  documentTypeId: number
  documentNumber: string
  expiryDate: string
  notes?: string | null
  fileUrl?: string | null
  status: 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED'
  employee: { id: number; employeeNo: string; fullName: string }
  documentType: { id: number; name: string; documentType: string; issuer: string }
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  open: boolean
  document: EmployeeDocument | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [document: EmployeeDocument]
  'renew': [document: EmployeeDocument]
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

type BadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

const statusColor: Record<string, BadgeColor> = {
  AKTIF: 'success',
  AKAN_EXPIRED: 'warning',
  EXPIRED: 'error',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_EXPIRED: 'Akan Expired',
  EXPIRED: 'Expired',
}

const statusIcon: Record<string, string> = {
  AKTIF: 'i-lucide-shield-check',
  AKAN_EXPIRED: 'i-lucide-alert-triangle',
  EXPIRED: 'i-lucide-clock',
}

const statusRingClass: Record<string, string> = {
  AKTIF: 'bg-success/10 text-success',
  AKAN_EXPIRED: 'bg-warning/10 text-warning',
  EXPIRED: 'bg-error/10 text-error',
}

const statusBarClass: Record<string, string> = {
  AKTIF: 'bg-success',
  AKAN_EXPIRED: 'bg-warning',
  EXPIRED: 'bg-error',
}

const statusTextClass: Record<string, string> = {
  AKTIF: 'text-success',
  AKAN_EXPIRED: 'text-warning',
  EXPIRED: 'text-error',
}

const docTypeColor: Record<string, BadgeColor> = {
  SERTIFIKAT: 'info',
  LISENSI: 'success',
  IZIN: 'warning',
  RAHASIA: 'error',
  LAINNYA: 'neutral',
}

const docTypeLabel: Record<string, string> = {
  SERTIFIKAT: 'Sertifikat',
  LISENSI: 'Lisensi',
  IZIN: 'Izin',
  RAHASIA: 'Rahasia',
  LAINNYA: 'Lainnya',
}

// Compute days until expiry
const daysUntilExpiry = computed(() => {
  if (!props.document?.expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(props.document.expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
})

// Total masa berlaku (dari updatedAt → expiryDate) untuk progress bar
const totalDays = computed(() => {
  const d = props.document
  if (!d?.expiryDate || daysUntilExpiry.value === null) return 0
  const start = new Date(d.updatedAt ?? d.createdAt)
  start.setHours(0, 0, 0, 0)
  const expiry = new Date(d.expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const total = Math.ceil((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return total > 0 ? total : 1
})

// Progress 0-100; expired -> 0
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
        <!-- Status ring -->
        <div
          v-if="document"
          class="flex size-11 shrink-0 items-center justify-center rounded-full"
          :class="statusRingClass[document.status] ?? 'bg-elevated text-muted'"
        >
          <UIcon :name="statusIcon[document.status] ?? 'i-lucide-file-badge'" class="size-5" />
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold text-highlighted truncate">
            {{ document?.documentType?.name ?? '-' }}
          </p>
          <div class="flex flex-wrap items-center gap-2 mt-1">
            <UBadge
              v-if="document?.documentType?.documentType"
              :label="docTypeLabel[document.documentType.documentType] ?? document.documentType.documentType"
              :color="docTypeColor[document.documentType.documentType] ?? 'neutral'"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="document?.status"
              :label="statusLabel[document.status] ?? document.status"
              :color="statusColor[document.status] ?? 'neutral'"
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
        <div
          class="rounded-xl border border-default bg-default p-4"
        >
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
              <p v-else class="text-sm text-muted">Tidak ada masa berlaku</p>
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
            <div class="mt-1.5 flex items-center justify-between text-xs text-muted">
              <span>Masa berlaku sampai {{ formatDate(document.expiryDate) }}</span>
            </div>
          </div>
        </div>

        <!-- Info cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Card 1: Karyawan & Penerbit -->
          <div class="rounded-xl border border-default bg-default p-4 space-y-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">Karyawan &amp; Penerbit</p>
            <div>
              <p class="text-sm text-highlighted font-medium">{{ document.employee?.fullName ?? '-' }}</p>
              <p class="text-xs text-muted">{{ document.employee?.employeeNo ?? '-' }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Penerbit</p>
              <p class="text-sm text-highlighted">{{ document.documentType?.issuer ?? '-' }}</p>
            </div>
          </div>

          <!-- Card 2: Dokumen & Status -->
          <div class="rounded-xl border border-default bg-default p-4 space-y-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">Dokumen &amp; Status</p>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Jenis Dokumen</p>
              <UBadge
                :label="docTypeLabel[document.documentType?.documentType] ?? document.documentType?.documentType ?? '-'"
                :color="docTypeColor[document.documentType?.documentType] ?? 'neutral'"
                variant="subtle"
              />
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">No. Dokumen</p>
              <p class="inline-flex items-center gap-1.5 text-sm font-mono text-highlighted">
                <UIcon name="i-lucide-hash" class="size-3.5 text-muted" />
                {{ document.documentNumber ?? '-' }}
              </p>
            </div>
          </div>
        </div>

        <USeparator />

        <!-- Keterangan -->
        <div v-if="document.notes" class="border-l-2 border-default pl-3">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-1">Keterangan</p>
          <p class="text-sm text-highlighted whitespace-pre-wrap">{{ document.notes }}</p>
        </div>

        <!-- File dokumen -->
        <div v-if="document.fileUrl">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">File Dokumen</p>
          <div class="space-y-2">
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
              <!-- PDF preview -->
              <div v-if="isPdf(document.fileUrl)" class="h-[480px]">
                <PdfViewer :src="document.fileUrl" />
              </div>
              <!-- Image preview -->
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
        <UIcon name="i-lucide-file-badge" class="size-10 opacity-40" />
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
            v-if="document && document.status !== 'AKTIF'"
            label="Perpanjang"
            icon="i-lucide-refresh-cw"
            color="success"
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