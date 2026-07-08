<script setup lang="ts">
interface VendorContract {
  id: number
  category: 'CUSTOMER' | 'VENDOR'
  companyId: number
  documentName: string
  documentNumber: string
  documentType: 'DOKUMEN_KONTRAK' | 'DOKUMEN_PERJANJIAN' | 'SURAT_PENAWARAN' | 'ADDENDUM' | 'AMENDMENT' | 'SURAT'
  createdDate: string
  needsRenewal: boolean
  startDate?: string | null
  endDate?: string | null
  status: 'AKTIF' | 'AKAN_BERAKHIR' | 'EXPIRED' | 'TIDAK_AKTIF'
  motherAgreementId?: number | null
  location?: string | null
  notes?: string | null
  fileUrl?: string | null
  company: { id: number; name: string }
  motherAgreement?: { id: number; documentName: string; documentNumber: string } | null
  renewals?: { id: number; documentName: string; documentNumber: string; status: string }[]
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  open: boolean
  contract: VendorContract | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [contract: VendorContract]
}>()

// --- Helpers ---
function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

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

const docTypeLabel: Record<string, string> = {
  DOKUMEN_KONTRAK: 'Dokumen Kontrak',
  DOKUMEN_PERJANJIAN: 'Dokumen Perjanjian',
  SURAT_PENAWARAN: 'Surat Penawaran',
  ADDENDUM: 'Addendum',
  AMENDMENT: 'Amendment',
  SURAT: 'Surat',
}

const renewalStatusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_BERAKHIR: 'Akan Berakhir',
  EXPIRED: 'Expired',
  TIDAK_AKTIF: 'Tidak Aktif',
}

const renewalStatusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_BERAKHIR: 'warning',
  EXPIRED: 'error',
  TIDAK_AKTIF: 'neutral',
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
            {{ contract?.company?.name ?? '-' }}
          </p>
          <div class="flex flex-wrap items-center gap-2 mt-1">
            <UBadge
              v-if="contract?.category"
              :label="contract.category"
              :color="contract.category === 'CUSTOMER' ? 'info' : 'success'"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="contract?.needsRenewal && contract?.status"
              :label="statusLabel[contract.status] ?? contract.status"
              :color="statusColor[contract.status] ?? 'neutral'"
              variant="subtle"
              size="sm"
            />
          </div>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="contract" class="space-y-6 py-2">

        <!-- Main info grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <!-- Left column -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Kategori</p>
              <UBadge
                :label="contract.category"
                :color="contract.category === 'CUSTOMER' ? 'info' : 'success'"
                variant="subtle"
              />
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Perusahaan</p>
              <p class="text-sm text-highlighted">{{ contract.company?.name ?? '-' }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Jenis Dokumen</p>
              <p class="text-sm text-highlighted">{{ docTypeLabel[contract.documentType] ?? contract.documentType }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal Dibuat</p>
              <p class="text-sm text-highlighted">{{ formatDate(contract.createdDate) }}</p>
            </div>

            <div v-if="contract.location">
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Lokasi</p>
              <p class="text-sm text-highlighted">{{ contract.location }}</p>
            </div>
          </div>

          <!-- Right column -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Nama Dokumen</p>
              <p class="text-sm text-highlighted">{{ contract.documentName }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">No. Dokumen</p>
              <p class="text-sm font-mono text-highlighted">{{ contract.documentNumber }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Status</p>
              <template v-if="contract.needsRenewal">
                <UBadge
                  :label="statusLabel[contract.status] ?? contract.status"
                  :color="statusColor[contract.status] ?? 'neutral'"
                  variant="subtle"
                />
              </template>
              <p v-else class="text-sm text-muted">-</p>
            </div>

            <template v-if="contract.needsRenewal">
              <div>
                <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal Mulai</p>
                <p class="text-sm text-highlighted">{{ formatDate(contract.startDate) }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal Berakhir</p>
                <p class="text-sm text-highlighted">{{ formatDate(contract.endDate) }}</p>
              </div>
            </template>
          </div>
        </div>

        <USeparator />

        <!-- Mother Agreement -->
        <div v-if="contract.motherAgreement">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">Mother Agreement</p>
          <div class="rounded-lg border border-default bg-elevated/40 px-3 py-2.5">
            <p class="text-sm font-medium text-highlighted">{{ contract.motherAgreement.documentName }}</p>
            <p class="text-xs font-mono text-muted mt-0.5">{{ contract.motherAgreement.documentNumber }}</p>
          </div>
        </div>

        <!-- Renewal chain -->
        <div v-if="contract.renewals && contract.renewals.length > 0">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
            Perpanjangan ({{ contract.renewals.length }})
          </p>
          <div class="space-y-2">
            <div
              v-for="renewal in contract.renewals"
              :key="renewal.id"
              class="rounded-lg border border-default bg-elevated/40 px-3 py-2.5 flex items-start justify-between gap-2"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-highlighted truncate">{{ renewal.documentName }}</p>
                <p class="text-xs font-mono text-muted mt-0.5">{{ renewal.documentNumber }}</p>
              </div>
              <UBadge
                :label="renewalStatusLabel[renewal.status] ?? renewal.status"
                :color="renewalStatusColor[renewal.status] ?? 'neutral'"
                variant="subtle"
                size="sm"
                class="shrink-0 mt-0.5"
              />
            </div>
          </div>
        </div>

        <!-- Keterangan -->
        <div v-if="contract.notes">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-1">Keterangan</p>
          <p class="text-sm text-highlighted whitespace-pre-wrap">{{ contract.notes }}</p>
        </div>

        <!-- File dokumen -->
        <div v-if="contract.fileUrl">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">File Dokumen</p>
          <a
            :href="contract.fileUrl"
            target="_blank"
            class="inline-flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm text-primary hover:bg-elevated transition-colors"
          >
            <UIcon name="i-lucide-paperclip" class="size-4 shrink-0" />
            Unduh File Dokumen
            <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0 text-muted" />
          </a>
        </div>

        <!-- Metadata -->
        <USeparator />
        <div class="grid grid-cols-2 gap-3 text-xs text-muted">
          <div>
            <span class="font-medium">Dibuat:</span>
            {{ formatDate(contract.createdAt) }}
          </div>
          <div>
            <span class="font-medium">Diperbarui:</span>
            {{ formatDate(contract.updatedAt) }}
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
          v-if="contract"
          label="Edit"
          icon="i-lucide-pencil"
          color="primary"
          @click="emit('edit', contract)"
        />
      </div>
    </template>
  </USlideover>
</template>
