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

type BadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

const props = defineProps<{
  open: boolean
  contract: VendorContract | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [contract: VendorContract]
  'open-contract': [id: number]
}>()

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isPdf(url: string): boolean {
  return url.toLowerCase().includes('.pdf')
}

const previewOpen = ref(false)

watch(() => props.contract?.id, () => {
  previewOpen.value = false
})

const statusColor: Record<string, BadgeColor> = {
  AKTIF: 'success', AKAN_BERAKHIR: 'warning', EXPIRED: 'error', TIDAK_AKTIF: 'neutral',
}
const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif', AKAN_BERAKHIR: 'Akan Berakhir', EXPIRED: 'Expired', TIDAK_AKTIF: 'Tidak Aktif',
}
const statusIcon: Record<string, string> = {
  AKTIF: 'i-lucide-shield-check', AKAN_BERAKHIR: 'i-lucide-alert-triangle', EXPIRED: 'i-lucide-clock', TIDAK_AKTIF: 'i-lucide-minus-circle',
}
const statusRingClass: Record<string, string> = {
  AKTIF: 'bg-success/10 text-success', AKAN_BERAKHIR: 'bg-warning/10 text-warning', EXPIRED: 'bg-error/10 text-error', TIDAK_AKTIF: 'bg-muted/10 text-muted',
}
const statusBarClass: Record<string, string> = {
  AKTIF: 'bg-success', AKAN_BERAKHIR: 'bg-warning', EXPIRED: 'bg-error', TIDAK_AKTIF: 'bg-muted',
}
const statusTextClass: Record<string, string> = {
  AKTIF: 'text-success', AKAN_BERAKHIR: 'text-warning', EXPIRED: 'text-error', TIDAK_AKTIF: 'text-muted',
}

const categoryLabel: Record<string, string> = { CUSTOMER: 'Customer', VENDOR: 'Vendor' }
const categoryColor: Record<string, BadgeColor> = { CUSTOMER: 'info', VENDOR: 'success' }
const categoryIcon: Record<string, string> = { CUSTOMER: 'i-lucide-user-check', VENDOR: 'i-lucide-building-2' }
const categoryRingClass: Record<string, string> = { CUSTOMER: 'bg-info/10 text-info', VENDOR: 'bg-success/10 text-success' }

const docTypeLabel: Record<string, string> = {
  DOKUMEN_KONTRAK: 'Kontrak', DOKUMEN_PERJANJIAN: 'Perjanjian', SURAT_PENAWARAN: 'Penawaran',
  ADDENDUM: 'Addendum', AMENDMENT: 'Amendment', SURAT: 'Surat',
}
const docTypeColor: Record<string, BadgeColor> = {
  DOKUMEN_KONTRAK: 'primary', DOKUMEN_PERJANJIAN: 'info', SURAT_PENAWARAN: 'warning',
  ADDENDUM: 'secondary', AMENDMENT: 'secondary', SURAT: 'neutral',
}

const renewalStatusColor: Record<string, BadgeColor> = {
  AKTIF: 'success', AKAN_BERAKHIR: 'warning', EXPIRED: 'error', TIDAK_AKTIF: 'neutral',
}
const renewalStatusLabel: Record<string, string> = {
  AKTIF: 'Aktif', AKAN_BERAKHIR: 'Akan Berakhir', EXPIRED: 'Expired', TIDAK_AKTIF: 'Tidak Aktif',
}

const daysUntilExpiry = computed(() => {
  if (!props.contract?.needsRenewal || !props.contract?.endDate) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const expiry = new Date(props.contract.endDate); expiry.setHours(0,0,0,0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
})
const totalDays = computed(() => {
  const c = props.contract
  if (!c?.endDate || !c.needsRenewal || daysUntilExpiry.value === null) return 0
  const start = new Date(c.startDate ?? c.createdDate); start.setHours(0,0,0,0)
  const expiry = new Date(c.endDate); expiry.setHours(0,0,0,0)
  const total = Math.ceil((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return total > 0 ? total : 1
})
const progressPercent = computed(() => {
  if (daysUntilExpiry.value === null) return 0
  return Math.min(100, Math.max(0, (daysUntilExpiry.value / totalDays.value) * 100))
})
function daysText(): string {
  const d = daysUntilExpiry.value
  if (d === null) return ''
  if (d < 0) return `Expired ${Math.abs(d)} hari lalu`
  if (d === 0) return 'Expired hari ini'
  return `Sisa ${d} hari`
}
const displayStatus = computed(() => {
  if (!props.contract) return null
  if (props.contract.renewedTo) return 'SUDAH_DIPERPANJANG'
  return props.contract.status
})
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <!-- HEADER -->
    <template #header>
      <div class="flex items-center gap-3 w-full min-w-0">
        <div
          v-if="contract"
          class="flex size-11 shrink-0 items-center justify-center rounded-full"
          :class="categoryRingClass[contract.category] ?? 'bg-elevated text-muted'"
        >
          <UIcon :name="categoryIcon[contract.category] ?? 'i-lucide-file-text'" class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold text-highlighted truncate">
            {{ contract?.documentName ?? '-' }}
          </p>
          <div class="flex flex-wrap items-center gap-1.5 mt-1">
            <UBadge v-if="contract?.category" :label="categoryLabel[contract.category] ?? contract.category" :color="categoryColor[contract.category] ?? 'neutral'" variant="subtle" size="sm" />
            <UBadge v-if="contract?.documentType" :label="docTypeLabel[contract.documentType] ?? contract.documentType" :color="docTypeColor[contract.documentType] ?? 'neutral'" variant="subtle" size="sm" />
            <UBadge v-if="contract?.status" :label="displayStatus === 'SUDAH_DIPERPANJANG' ? 'Sudah Diperpanjang' : (statusLabel[contract.status] ?? contract.status)" :color="displayStatus === 'SUDAH_DIPERPANJANG' ? 'info' : (statusColor[contract.status] ?? 'neutral')" variant="subtle" size="sm" />
          </div>
          <div v-if="contract?.company" class="mt-1 flex items-center gap-1 text-xs text-muted">
            <UIcon name="i-lucide-building-2" class="size-3 shrink-0" />
            {{ contract.company.name }}
          </div>
        </div>
      </div>
    </template>

    <!-- BODY -->
    <template #body>
      <div v-if="contract" class="space-y-5 py-2">

        <!-- Expiry Status Card (4 kondisi) -->
        <div class="rounded-xl border border-default bg-default p-4">
          <template v-if="!contract.needsRenewal">
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
          <template v-else-if="contract.renewedTo">
            <div class="flex items-center gap-4">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                <UIcon name="i-lucide-check-circle-2" class="size-6" />
              </div>
              <div>
                <p class="text-sm font-semibold text-highlighted">Sudah Diperpanjang</p>
                <p class="text-sm text-muted">Kontrak ini telah diperpanjang. Lihat dokumen baru di bawah.</p>
              </div>
            </div>
          </template>
          <template v-else-if="contract.status === 'TIDAK_AKTIF'">
            <div class="flex items-center gap-4">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted/10 text-muted">
                <UIcon name="i-lucide-minus-circle" class="size-6" />
              </div>
              <div>
                <p class="text-sm font-semibold text-highlighted">Tidak Aktif</p>
                <p class="text-sm text-muted">Kontrak ini berstatus tidak aktif</p>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-4">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-full" :class="statusRingClass[contract.status] ?? 'bg-elevated text-muted'">
                <UIcon :name="statusIcon[contract.status] ?? 'i-lucide-file-text'" class="size-6" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-highlighted">{{ statusLabel[contract.status] ?? contract.status }}</p>
                <p v-if="daysUntilExpiry !== null" class="text-lg font-bold tabular-nums leading-tight" :class="statusTextClass[contract.status] ?? 'text-highlighted'">{{ daysText() }}</p>
              </div>
            </div>
            <div v-if="daysUntilExpiry !== null" class="mt-3">
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                <div class="h-full rounded-full transition-all duration-300" :class="statusBarClass[contract.status] ?? 'bg-primary'" :style="{ width: `${progressPercent}%` }" />
              </div>
              <div class="mt-1.5 text-xs text-muted">Berlaku sampai {{ formatDate(contract.endDate) }}</div>
            </div>
          </template>
        </div>

        <!-- 2 Kartu info -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-default bg-default p-4 space-y-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">Dokumen</p>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">No. Dokumen</p>
              <p class="inline-flex items-center gap-1.5 text-sm font-mono text-highlighted">
                <UIcon name="i-lucide-hash" class="size-3.5 text-muted" />{{ contract.documentNumber || '-' }}
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Jenis Dokumen</p>
              <UBadge :label="docTypeLabel[contract.documentType] ?? contract.documentType" :color="docTypeColor[contract.documentType] ?? 'neutral'" variant="subtle" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Tanggal Dibuat</p>
              <p class="text-sm text-highlighted">{{ formatDate(contract.createdDate) }}</p>
            </div>
          </div>
          <div class="rounded-xl border border-default bg-default p-4 space-y-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">Perusahaan</p>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Nama</p>
              <p class="text-sm font-medium text-highlighted flex items-center gap-1.5">
                <UIcon name="i-lucide-building-2" class="size-3.5 shrink-0 text-muted" />{{ contract.company?.name ?? '-' }}
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-muted mb-0.5">Kategori</p>
              <UBadge :label="categoryLabel[contract.category] ?? contract.category" :color="categoryColor[contract.category] ?? 'neutral'" variant="subtle" />
            </div>
            <div v-if="contract.location">
              <p class="text-xs font-medium text-muted mb-0.5">Lokasi</p>
              <p class="text-sm text-highlighted">{{ contract.location }}</p>
            </div>
          </div>
        </div>

        <!-- Mother Agreement card (Perjanjian Payung) -->
        <div v-if="contract.motherAgreement" class="rounded-xl border-l-4 border-l-primary bg-primary/5 p-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-anchor" class="size-5 shrink-0 text-primary mt-0.5" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-primary uppercase tracking-wide mb-1">Perjanjian Payung</p>
              <p class="text-sm font-semibold text-highlighted truncate">{{ contract.motherAgreement.documentName }}</p>
              <p class="text-xs font-mono text-muted mt-0.5">{{ contract.motherAgreement.documentNumber }}</p>
              <button type="button" class="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" @click="emit('open-contract', contract.motherAgreement!.id)">
                <UIcon name="i-lucide-arrow-up-right" class="size-3" /> Lihat Perjanjian Payung
              </button>
            </div>
          </div>
        </div>

        <!-- Renewal Chain Timeline -->
        <div v-if="contract.renewedFrom || contract.renewedTo" class="space-y-2">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Rantai Perpanjangan</p>
          <div class="relative pl-5">
            <div class="absolute left-1.5 top-2.5 bottom-2.5 border-l-2 border-dashed border-default" />
            <div v-if="contract.renewedFrom" class="relative mb-4">
              <div class="absolute -left-3.5 top-1.5 size-2.5 rounded-full border-2 border-default bg-elevated" />
              <div class="rounded-lg border border-default bg-elevated/40 p-3">
                <p class="text-xs font-medium text-muted mb-0.5">Perpanjangan Dari</p>
                <p class="text-sm font-medium text-highlighted truncate">{{ contract.renewedFrom.documentName }}</p>
                <p class="text-xs font-mono text-muted">{{ contract.renewedFrom.documentNumber }}</p>
                <p class="text-xs text-muted mt-1">{{ formatDate(contract.renewedFrom.createdDate) }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <a v-if="contract.renewedFrom.fileUrl" :href="contract.renewedFrom.fileUrl" target="_blank" class="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <UIcon name="i-lucide-download" class="size-3" /> Unduh
                  </a>
                  <button type="button" class="inline-flex items-center gap-1 text-xs text-primary hover:underline" @click="emit('open-contract', contract.renewedFrom!.id)">
                    <UIcon name="i-lucide-arrow-up-right" class="size-3" /> Lihat Detail
                  </button>
                </div>
              </div>
            </div>
            <div class="relative mb-4">
              <div class="absolute -left-3.5 top-1.5 size-3 rounded-full bg-primary" />
              <div class="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p class="text-xs font-medium text-primary mb-0.5">Kontrak Ini</p>
                <p class="text-sm font-medium text-highlighted truncate">{{ contract.documentName }}</p>
                <p class="text-xs font-mono text-muted">{{ contract.documentNumber }}</p>
              </div>
            </div>
            <div v-if="contract.renewedTo" class="relative">
              <div class="absolute -left-3.5 top-1.5 size-2.5 rounded-full border-2 border-default bg-elevated" />
              <div class="rounded-lg border border-default bg-elevated/40 p-3">
                <p class="text-xs font-medium text-muted mb-0.5">Diperpanjang Ke</p>
                <p class="text-sm font-medium text-highlighted truncate">{{ contract.renewedTo.documentName }}</p>
                <p class="text-xs font-mono text-muted">{{ contract.renewedTo.documentNumber }}</p>
                <p class="text-xs text-muted mt-1">{{ formatDate(contract.renewedTo.createdDate) }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <UBadge :label="renewalStatusLabel[contract.renewedTo.status] ?? contract.renewedTo.status" :color="renewalStatusColor[contract.renewedTo.status] ?? 'neutral'" variant="subtle" size="sm" />
                  <button type="button" class="inline-flex items-center gap-1 text-xs text-primary hover:underline" @click="emit('open-contract', contract.renewedTo!.id)">
                    <UIcon name="i-lucide-arrow-right" class="size-3" /> Lihat Dokumen Baru
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Riwayat Perpanjangan (flat list) -->
        <div v-if="contract.renewals && contract.renewals.length > 0" class="space-y-2">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Riwayat Perpanjangan ({{ contract.renewals.length }})</p>
          <div class="space-y-2">
            <div v-for="renewal in contract.renewals" :key="renewal.id" class="flex items-center gap-3 rounded-lg border border-default bg-elevated/30 p-3">
              <UIcon name="i-lucide-refresh-cw" class="size-4 shrink-0 text-muted" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-highlighted truncate">{{ renewal.documentName }}</p>
                <p class="text-xs font-mono text-muted">{{ renewal.documentNumber }}</p>
                <p v-if="renewal.endDate" class="text-xs text-muted mt-0.5">Berakhir {{ formatDate(renewal.endDate) }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <UBadge :label="renewalStatusLabel[renewal.status] ?? renewal.status" :color="renewalStatusColor[renewal.status] ?? 'neutral'" variant="subtle" size="sm" />
                <button type="button" class="text-primary hover:text-primary/80 transition-colors" @click="emit('open-contract', renewal.id)">
                  <UIcon name="i-lucide-arrow-up-right" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Keterangan -->
        <template v-if="contract.notes">
          <USeparator />
          <div class="border-l-2 border-default pl-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide mb-1">Keterangan</p>
            <p class="text-sm text-highlighted whitespace-pre-wrap">{{ contract.notes }}</p>
          </div>
        </template>

        <!-- File dokumen -->
        <template v-if="contract.fileUrl">
          <USeparator v-if="!contract.notes" />
          <div>
            <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">File Dokumen</p>
            <div class="flex items-center gap-2">
              <a :href="contract.fileUrl" target="_blank" class="inline-flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm text-primary hover:bg-elevated transition-colors">
                <UIcon name="i-lucide-download" class="size-4 shrink-0" /> Unduh
              </a>
              <button type="button" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-primary hover:bg-elevated/60 transition-colors" @click="previewOpen = !previewOpen">
                <UIcon name="i-lucide-eye" class="size-4" />
                {{ previewOpen ? 'Sembunyikan Preview' : 'Lihat Preview' }}
              </button>
            </div>
            <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-1">
              <div v-if="previewOpen" class="mt-2 rounded-lg border border-default overflow-hidden">
                <div v-if="isPdf(contract.fileUrl)" class="h-[480px]">
                  <PdfViewer :src="contract.fileUrl" />
                </div>
                <img v-else :src="contract.fileUrl" alt="Preview Dokumen" class="w-full object-contain max-h-96" />
              </div>
            </Transition>
          </div>
        </template>

        <!-- Metadata -->
        <USeparator />
        <div class="grid grid-cols-2 gap-3 text-xs text-muted">
          <div><span class="font-medium">Dibuat:</span> {{ formatDate(contract.createdAt) }}</div>
          <div><span class="font-medium">Diperbarui:</span> {{ formatDate(contract.updatedAt) }}</div>
        </div>

      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center gap-3 py-20 text-muted">
        <div class="size-12 rounded-xl bg-elevated flex items-center justify-center">
          <UIcon name="i-lucide-file-text" class="size-6 opacity-40" />
        </div>
        <p class="text-sm">Tidak ada data yang dipilih</p>
      </div>
    </template>

    <!-- FOOTER -->
    <template #footer>
      <div class="flex items-center justify-between gap-2 w-full">
        <UButton label="Tutup" color="neutral" variant="ghost" @click="emit('update:open', false)" />
        <UButton v-if="contract" label="Edit" icon="i-lucide-pencil" color="primary" @click="emit('edit', contract)" />
      </div>
    </template>
  </USlideover>
</template>
