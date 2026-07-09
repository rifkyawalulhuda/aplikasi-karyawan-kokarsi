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

const props = defineProps<{
  open: boolean
  document: LegalKoperasi | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [document: LegalKoperasi]
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

const statusColor: Record<string, string> = {
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

const categoryColor: Record<string, string> = {
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
              v-if="document?.renewedTo"
              label="Sudah Diperpanjang"
              color="info"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-else-if="document?.needsRenewal && document?.status"
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
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Kategori</p>
              <UBadge
                :label="categoryLabel[document.category] ?? document.category"
                :color="categoryColor[document.category] ?? 'neutral'"
                variant="subtle"
              />
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Penerbit</p>
              <p class="text-sm text-highlighted">{{ document.publisher }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal</p>
              <p class="text-sm text-highlighted">{{ formatDate(document.documentDate) }}</p>
            </div>

            <div v-if="document.location">
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Lokasi</p>
              <p class="text-sm text-highlighted">{{ document.location }}</p>
            </div>
          </div>

          <!-- Right column -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Nama Dokumen</p>
              <p class="text-sm text-highlighted">{{ document.documentName }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">No. Dokumen</p>
              <p class="text-sm font-mono text-highlighted">{{ document.documentNumber }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Status</p>
              <template v-if="document.renewedTo">
                <UBadge
                  label="Sudah Diperpanjang"
                  color="info"
                  variant="subtle"
                />
              </template>
              <template v-else-if="document.needsRenewal">
                <UBadge
                  :label="statusLabel[document.status] ?? document.status"
                  :color="statusColor[document.status] ?? 'neutral'"
                  variant="subtle"
                />
              </template>
              <p v-else class="text-sm text-muted">-</p>
            </div>

            <template v-if="document.needsRenewal">
              <div>
                <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal Mulai</p>
                <p class="text-sm text-highlighted">{{ formatDate(document.startDate) }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal Berakhir</p>
                <p class="text-sm text-highlighted">{{ formatDate(document.endDate) }}</p>
              </div>
            </template>
          </div>
        </div>

        <USeparator />

        <!-- Perpanjangan dari (this document is a renewal of an older one) -->
        <div v-if="document.renewedFrom">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">Perpanjangan Dari</p>
          <div class="rounded-lg border border-default bg-elevated/40 px-3 py-2.5">
            <p class="text-sm font-medium text-highlighted">{{ document.renewedFrom.documentName }}</p>
            <p class="text-xs font-mono text-muted mt-0.5">{{ document.renewedFrom.documentNumber }}</p>
            <p class="text-xs text-muted mt-0.5">Dibuat: {{ formatDate(document.renewedFrom.documentDate) }}</p>
            <a
              v-if="document.renewedFrom.fileUrl"
              :href="document.renewedFrom.fileUrl"
              target="_blank"
              class="flex items-center gap-1 text-primary hover:underline text-xs mt-1"
            >
              <UIcon name="i-lucide-paperclip" class="size-3" />
              Dokumen Lama
            </a>
          </div>
        </div>

        <!-- Sudah diperpanjang ke (this document has been renewed) -->
        <div v-if="document.renewedTo">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">Diperpanjang Ke</p>
          <div class="rounded-lg border border-info/20 bg-info/5 px-3 py-2.5">
            <p class="text-sm font-medium text-highlighted">{{ document.renewedTo.documentName }}</p>
            <p class="text-xs font-mono text-muted mt-0.5">{{ document.renewedTo.documentNumber }}</p>
            <p class="text-xs text-muted mt-0.5">Dibuat: {{ formatDate(document.renewedTo.documentDate) }}</p>
            <button
              type="button"
              class="flex items-center gap-1 text-primary hover:underline text-xs mt-1 cursor-pointer"
              @click="emit('open-document', document.renewedTo.id)"
            >
              <UIcon name="i-lucide-arrow-right" class="size-3" />
              Lihat Dokumen Baru
            </button>
          </div>
        </div>

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
        <UButton
          v-if="document"
          label="Edit"
          icon="i-lucide-pencil"
          color="primary"
          @click="emit('edit', document)"
        />
      </div>
    </template>
  </USlideover>
</template>
