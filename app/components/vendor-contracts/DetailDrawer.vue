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
  renewals?: { id: number; documentName: string; documentNumber: string; status: string; fileUrl?: string | null; endDate?: string | null }[]
  renewedFrom?: { id: number; documentName: string; documentNumber: string; fileUrl?: string | null; createdDate: string } | null
  renewedTo?: { id: number; documentName: string; documentNumber: string; status: string; createdDate: string } | null
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
  'open-contract': [id: number]
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

// Reset preview when contract changes
watch(() => props.contract?.id, () => {
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
  SUDAH_DIPERPANJANG: 'Sudah Diperpanjang',
}

const renewalStatusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_BERAKHIR: 'warning',
  EXPIRED: 'error',
  TIDAK_AKTIF: 'neutral',
}

// --- Progress bar untuk periode berlaku ---
const contractProgress = computed(() => {
  if (!props.contract?.needsRenewal || !props.contract?.startDate || !props.contract?.endDate) return null
  const start = new Date(props.contract.startDate).getTime()
  const end = new Date(props.contract.endDate).getTime()
  const now = Date.now()
  if (end <= start) return null
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  return Math.round(pct)
})

const progressBarColor = computed(() => {
  if (!props.contract) return 'bg-success'
  if (props.contract.renewedTo) return 'bg-info'
  const s = props.contract.status
  if (s === 'EXPIRED') return 'bg-error'
  if (s === 'AKAN_BERAKHIR') return 'bg-warning'
  if (s === 'TIDAK_AKTIF') return 'bg-neutral-400'
  return 'bg-success'
})

// Efektif status untuk display (sudah diperpanjang override)
const effectiveStatus = computed(() => {
  if (!props.contract) return null
  if (props.contract.renewedTo) return { label: 'Sudah Diperpanjang', color: 'info' }
  if (props.contract.needsRenewal) return {
    label: statusLabel[props.contract.status] ?? props.contract.status,
    color: statusColor[props.contract.status] ?? 'neutral',
  }
  return null
})
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ panel: 'max-w-xl' }"
    @update:open="emit('update:open', $event)"
  >
    <!-- ─── HEADER ─── -->
    <template #header>
      <div class="flex items-start gap-3 w-full min-w-0">
        <!-- Icon -->
        <div class="shrink-0 mt-0.5 size-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <UIcon name="i-lucide-file-text" class="size-4.5 text-primary" />
        </div>

        <!-- Title block -->
        <div class="min-w-0 flex-1">
          <p v-if="contract" class="text-base font-semibold text-highlighted leading-snug truncate">
            {{ contract.documentName }}
          </p>
          <p v-else class="text-base font-semibold text-muted">—</p>

          <p v-if="contract" class="text-xs font-mono text-muted mt-0.5 truncate">
            {{ contract.documentNumber }}
          </p>

          <div v-if="contract" class="flex flex-wrap items-center gap-1.5 mt-2">
            <!-- Perusahaan -->
            <span class="inline-flex items-center gap-1 text-xs text-muted">
              <UIcon name="i-lucide-building-2" class="size-3" />
              {{ contract.company?.name ?? '-' }}
            </span>
            <span class="text-muted/30 text-xs">·</span>
            <!-- Badge kategori -->
            <UBadge
              :label="contract.category"
              :color="contract.category === 'CUSTOMER' ? 'info' : 'success'"
              variant="subtle"
              size="xs"
            />
            <!-- Badge status -->
            <UBadge
              v-if="effectiveStatus"
              :label="effectiveStatus.label"
              :color="effectiveStatus.color"
              variant="subtle"
              size="xs"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ─── BODY ─── -->
    <template #body>
      <div v-if="contract" class="space-y-0 divide-y divide-default">

        <!-- ── Informasi Dokumen ── -->
        <section class="py-5 space-y-4">
          <p class="text-[11px] font-semibold text-muted uppercase tracking-widest">Informasi Dokumen</p>

          <div class="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p class="text-[11px] text-muted mb-1">Jenis Dokumen</p>
              <p class="text-sm text-highlighted font-medium">
                {{ docTypeLabel[contract.documentType] ?? contract.documentType }}
              </p>
            </div>

            <div>
              <p class="text-[11px] text-muted mb-1">Tanggal Dibuat</p>
              <p class="text-sm text-highlighted font-medium">{{ formatDate(contract.createdDate) }}</p>
            </div>

            <div v-if="contract.location">
              <p class="text-[11px] text-muted mb-1">Lokasi</p>
              <p class="text-sm text-highlighted font-medium">{{ contract.location }}</p>
            </div>

            <div v-if="!contract.needsRenewal">
              <p class="text-[11px] text-muted mb-1">Perlu Perpanjangan</p>
              <p class="text-sm text-muted">Tidak</p>
            </div>
          </div>
        </section>

        <!-- ── Periode Berlaku (hanya jika needsRenewal) ── -->
        <section v-if="contract.needsRenewal" class="py-5 space-y-4">
          <p class="text-[11px] font-semibold text-muted uppercase tracking-widest">Periode Berlaku</p>

          <!-- Tanggal row -->
          <div class="flex items-center justify-between text-sm">
            <div>
              <p class="text-[11px] text-muted mb-0.5">Mulai</p>
              <p class="font-medium text-highlighted">{{ formatDate(contract.startDate) }}</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="size-4 text-muted/50 shrink-0" />
            <div class="text-right">
              <p class="text-[11px] text-muted mb-0.5">Berakhir</p>
              <p class="font-medium text-highlighted">{{ formatDate(contract.endDate) }}</p>
            </div>
          </div>

          <!-- Progress bar -->
          <div v-if="contractProgress !== null" class="space-y-1.5">
            <div class="h-1.5 w-full rounded-full bg-default overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="progressBarColor"
                :style="{ width: contractProgress + '%' }"
              />
            </div>
            <div class="flex items-center justify-between">
              <p class="text-[11px] text-muted">
                {{ contractProgress }}% sudah berjalan
              </p>
              <UBadge
                v-if="effectiveStatus"
                :label="effectiveStatus.label"
                :color="effectiveStatus.color"
                variant="subtle"
                size="xs"
              />
            </div>
          </div>
          <!-- Fallback jika tanggal tidak lengkap -->
          <div v-else class="flex items-center gap-2 text-xs text-muted">
            <UIcon name="i-lucide-calendar-x" class="size-3.5" />
            Tanggal tidak lengkap
          </div>
        </section>

        <!-- ── Relasi Dokumen ── -->
        <section
          v-if="contract.motherAgreement || contract.renewedFrom || contract.renewedTo || (contract.renewals && contract.renewals.length)"
          class="py-5 space-y-3"
        >
          <p class="text-[11px] font-semibold text-muted uppercase tracking-widest">Relasi Dokumen</p>

          <!-- Mother Agreement -->
          <div v-if="contract.motherAgreement" class="rounded-lg border border-default border-l-2 border-l-primary bg-elevated/30 px-3.5 py-3 space-y-2">
            <p class="text-[11px] font-semibold text-primary uppercase tracking-wide">Mother Agreement</p>
            <p class="text-sm font-medium text-highlighted leading-snug">{{ contract.motherAgreement.documentName }}</p>
            <p class="text-xs font-mono text-muted">{{ contract.motherAgreement.documentNumber }}</p>
            <UButton
              size="xs"
              variant="ghost"
              color="primary"
              icon="i-lucide-arrow-right"
              trailing
              label="Lihat Dokumen"
              @click="emit('open-contract', contract.motherAgreement!.id)"
            />
          </div>

          <!-- Perpanjangan Dari -->
          <div v-if="contract.renewedFrom" class="rounded-lg border border-default border-l-2 border-l-neutral-400 bg-elevated/30 px-3.5 py-3 space-y-2">
            <p class="text-[11px] font-semibold text-muted uppercase tracking-wide">Perpanjangan Dari</p>
            <p class="text-sm font-medium text-highlighted leading-snug">{{ contract.renewedFrom.documentName }}</p>
            <p class="text-xs font-mono text-muted">{{ contract.renewedFrom.documentNumber }}</p>
            <div class="flex items-center justify-between">
              <p class="text-xs text-muted">Dibuat: {{ formatDate(contract.renewedFrom.createdDate) }}</p>
              <a
                v-if="contract.renewedFrom.fileUrl"
                :href="contract.renewedFrom.fileUrl"
                target="_blank"
                class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <UIcon name="i-lucide-paperclip" class="size-3" />
                Dokumen Lama
              </a>
            </div>
          </div>

          <!-- Diperpanjang Ke -->
          <div v-if="contract.renewedTo" class="rounded-lg border border-info/25 border-l-2 border-l-info bg-info/5 px-3.5 py-3 space-y-2">
            <p class="text-[11px] font-semibold text-info uppercase tracking-wide">Diperpanjang Ke</p>
            <p class="text-sm font-medium text-highlighted leading-snug">{{ contract.renewedTo.documentName }}</p>
            <p class="text-xs font-mono text-muted">{{ contract.renewedTo.documentNumber }}</p>
            <div class="flex items-center justify-between">
              <p class="text-xs text-muted">Dibuat: {{ formatDate(contract.renewedTo.createdDate) }}</p>
              <UBadge
                :label="renewalStatusLabel[contract.renewedTo.status] ?? contract.renewedTo.status"
                :color="renewalStatusColor[contract.renewedTo.status] ?? 'neutral'"
                variant="subtle"
                size="xs"
              />
            </div>
            <UButton
              size="xs"
              variant="ghost"
              color="info"
              icon="i-lucide-arrow-right"
              trailing
              label="Lihat Dokumen Baru"
              @click="emit('open-contract', contract.renewedTo!.id)"
            />
          </div>

          <!-- Daftar Renewals -->
          <div v-if="contract.renewals && contract.renewals.length" class="space-y-2">
            <p class="text-[11px] text-muted font-medium">Riwayat Perpanjangan ({{ contract.renewals.length }})</p>
            <div class="space-y-2">
              <div
                v-for="renewal in contract.renewals"
                :key="renewal.id"
                class="rounded-lg border border-default border-l-2 border-l-success bg-elevated/30 px-3.5 py-2.5 flex items-start justify-between gap-3"
              >
                <div class="min-w-0 flex-1 space-y-0.5">
                  <p class="text-sm font-medium text-highlighted truncate">{{ renewal.documentName }}</p>
                  <p class="text-xs font-mono text-muted">{{ renewal.documentNumber }}</p>
                  <p v-if="renewal.endDate" class="text-xs text-muted">Berakhir: {{ formatDate(renewal.endDate) }}</p>
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <UBadge
                    :label="renewalStatusLabel[renewal.status] ?? renewal.status"
                    :color="renewalStatusColor[renewal.status] ?? 'neutral'"
                    variant="subtle"
                    size="xs"
                  />
                  <button
                    class="text-xs text-primary hover:underline flex items-center gap-0.5"
                    @click="emit('open-contract', renewal.id)"
                  >
                    <UIcon name="i-lucide-arrow-right" class="size-3" />
                    Lihat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Catatan ── -->
        <section v-if="contract.notes" class="py-5 space-y-3">
          <p class="text-[11px] font-semibold text-muted uppercase tracking-widest">Catatan</p>
          <div class="rounded-lg bg-elevated/50 border border-default px-3.5 py-3 flex gap-2.5">
            <UIcon name="i-lucide-sticky-note" class="size-4 text-muted shrink-0 mt-0.5" />
            <p class="text-sm text-default leading-relaxed whitespace-pre-wrap">{{ contract.notes }}</p>
          </div>
        </section>

        <!-- ── Dokumen File ── -->
        <section v-if="contract.fileUrl" class="py-5 space-y-3">
          <p class="text-[11px] font-semibold text-muted uppercase tracking-widest">Dokumen File</p>

          <!-- Card file -->
          <div class="rounded-lg border border-default bg-elevated/30 px-3.5 py-3">
            <div class="flex items-center gap-3">
              <div class="shrink-0 size-8 rounded-md bg-primary/10 flex items-center justify-center">
                <UIcon
                  :name="isPdf(contract.fileUrl) ? 'i-lucide-file-text' : 'i-lucide-file'"
                  class="size-4 text-primary"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-highlighted truncate">
                  {{ isPdf(contract.fileUrl) ? 'File PDF' : 'File Dokumen' }}
                </p>
                <p class="text-xs text-muted truncate">{{ contract.fileUrl.split('/').pop() }}</p>
              </div>
              <a
                :href="contract.fileUrl"
                target="_blank"
                class="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium px-2.5 py-1.5 transition-colors"
              >
                <UIcon name="i-lucide-download" class="size-3.5" />
                Unduh
              </a>
            </div>

            <!-- Preview toggle -->
            <button
              type="button"
              class="mt-3 flex items-center gap-1.5 text-xs text-muted hover:text-default transition-colors w-full"
              @click="previewOpen = !previewOpen"
            >
              <UIcon :name="previewOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3.5" />
              {{ previewOpen ? 'Sembunyikan Preview' : 'Tampilkan Preview' }}
            </button>
          </div>

          <!-- Preview area -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div v-if="previewOpen" class="rounded-lg overflow-hidden border border-default">
              <div v-if="isPdf(contract.fileUrl)" class="h-[480px]">
                <PdfViewer :src="contract.fileUrl" />
              </div>
              <img
                v-else
                :src="contract.fileUrl"
                class="w-full object-contain max-h-96"
                alt="Preview Dokumen"
              />
            </div>
          </Transition>
        </section>

        <!-- ── Meta ── -->
        <section class="py-4">
          <p class="text-[11px] text-muted/60">
            Dibuat {{ formatDate(contract.createdAt) }}
            <span class="mx-1.5">·</span>
            Diperbarui {{ formatDate(contract.updatedAt) }}
          </p>
        </section>

      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center gap-3 py-20 text-muted">
        <div class="size-12 rounded-xl bg-elevated flex items-center justify-center">
          <UIcon name="i-lucide-file-text" class="size-6 opacity-40" />
        </div>
        <p class="text-sm">Tidak ada data yang dipilih</p>
      </div>
    </template>

    <!-- ─── FOOTER ─── -->
    <template #footer>
      <div class="flex items-center justify-between gap-2 w-full">
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
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
