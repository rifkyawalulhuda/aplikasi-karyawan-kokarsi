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

const statusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_EXPIRED: 'warning',
  EXPIRED: 'error',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_EXPIRED: 'Akan Expired',
  EXPIRED: 'Expired',
}

const docTypeColor: Record<string, string> = {
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
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ panel: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-start justify-between gap-3 w-full">
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
      <div v-if="document" class="space-y-6 py-2">

        <!-- Main info grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <!-- Left column -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Nama Karyawan</p>
              <p class="text-sm text-highlighted font-medium">{{ document.employee?.fullName ?? '-' }}</p>
              <p class="text-xs text-muted">{{ document.employee?.employeeNo ?? '-' }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Jenis Dokumen</p>
              <UBadge
                :label="docTypeLabel[document.documentType?.documentType] ?? document.documentType?.documentType ?? '-'"
                :color="docTypeColor[document.documentType?.documentType] ?? 'neutral'"
                variant="subtle"
              />
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Penerbit</p>
              <p class="text-sm text-highlighted">{{ document.documentType?.issuer ?? '-' }}</p>
            </div>
          </div>

          <!-- Right column -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">No. Dokumen</p>
              <p class="text-sm font-mono text-highlighted">{{ document.documentNumber ?? '-' }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Status</p>
              <UBadge
                :label="statusLabel[document.status] ?? document.status"
                :color="statusColor[document.status] ?? 'neutral'"
                variant="subtle"
              />
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Masa Berlaku Sampai</p>
              <p class="text-sm text-highlighted">{{ formatDate(document.expiryDate) }}</p>
              <!-- Days indicator -->
              <p
                v-if="daysUntilExpiry !== null"
                class="text-xs mt-0.5"
                :class="daysUntilExpiry < 0 ? 'text-error' : daysUntilExpiry <= 30 ? 'text-warning' : 'text-muted'"
              >
                <template v-if="daysUntilExpiry < 0">Sudah expired {{ Math.abs(daysUntilExpiry) }} hari lalu</template>
                <template v-else-if="daysUntilExpiry === 0">Expired hari ini</template>
                <template v-else>Sisa {{ daysUntilExpiry }} hari</template>
              </p>
            </div>
          </div>
        </div>

        <USeparator />

        <!-- Keterangan -->
        <div v-if="document.notes">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-1">Keterangan</p>
          <p class="text-sm text-highlighted whitespace-pre-wrap">{{ document.notes }}</p>
        </div>

        <!-- File dokumen -->
        <div v-if="document.fileUrl">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">File Dokumen</p>
          <div class="space-y-2">
            <!-- Download link -->
            <a
              :href="document.fileUrl"
              target="_blank"
              class="inline-flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm text-primary hover:bg-elevated transition-colors"
            >
              <UIcon name="i-lucide-paperclip" class="size-4 shrink-0" />
              Unduh File Dokumen
              <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0 text-muted" />
            </a>
            <!-- Preview toggle -->
            <button
              type="button"
              class="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
              @click="previewOpen = !previewOpen"
            >
              <UIcon :name="previewOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3.5" />
              {{ previewOpen ? 'Sembunyikan Preview' : 'Lihat Preview' }}
            </button>
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
