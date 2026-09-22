<script setup lang="ts">
interface Archive {
  id: number
  documentName: string
  documentNumber?: string | null
  createdDate?: string | null
  expiryDate?: string | null
  notes?: string | null
  fileUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

const props = defineProps<{ open: boolean; archive: Archive | null }>()
const emit = defineEmits<{
  'update:open': [boolean]
  'edit': [Archive]
}>()

const previewOpen = ref(false)

watch(() => props.archive?.id, () => {
  previewOpen.value = false
})

const expiryState = computed(() => {
  if (!props.archive?.expiryDate) return { label: 'Tanpa batas waktu', color: 'neutral' as const, icon: 'i-lucide-infinity' }
  const expiry = new Date(props.archive.expiryDate)
  if (expiry.getTime() < Date.now()) return { label: 'Sudah berakhir', color: 'error' as const, icon: 'i-lucide-circle-alert' }
  return { label: 'Masih berlaku', color: 'success' as const, icon: 'i-lucide-circle-check' }
})

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-'
}

function isPdf(url?: string | null) {
  return !!url && url.toLowerCase().includes('.pdf')
}
</script>

<template>
  <USlideover
    :open="open"
    title="Detail Arsip Umum"
    side="right"
    :ui="{ content: 'max-w-xl', body: 'p-0' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="archive" class="flex min-h-full flex-col">
        <div class="border-b border-default bg-elevated/30 px-5 py-5 sm:px-6">
          <div class="flex items-start gap-3">
            <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <UIcon name="i-lucide-archive" class="size-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium uppercase tracking-wide text-muted">Arsip Umum</p>
              <h2 class="mt-1 break-words text-lg font-semibold leading-snug text-highlighted">{{ archive.documentName }}</h2>
              <p class="mt-1 break-all font-mono text-xs text-muted">{{ archive.documentNumber || 'Nomor dokumen tidak tersedia' }}</p>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <UBadge :label="expiryState.label" :color="expiryState.color" variant="subtle" size="sm">
              <template #leading><UIcon :name="expiryState.icon" class="size-3.5" /></template>
            </UBadge>
            <span v-if="archive.expiryDate" class="text-xs text-muted">Berakhir {{ formatDate(archive.expiryDate) }}</span>
          </div>
        </div>

        <div class="flex-1 space-y-5 px-5 py-5 sm:px-6">
          <section>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Informasi Dokumen</h3>
            <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="rounded-lg border border-default bg-default px-3 py-2.5">
                <dt class="text-xs text-muted">Tanggal Dibuat</dt>
                <dd class="mt-1 text-sm font-medium tabular-nums text-highlighted">{{ formatDate(archive.createdDate) }}</dd>
              </div>
              <div class="rounded-lg border border-default bg-default px-3 py-2.5">
                <dt class="text-xs text-muted">Tanggal Berakhir</dt>
                <dd class="mt-1 text-sm font-medium tabular-nums text-highlighted">{{ formatDate(archive.expiryDate) }}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Keterangan</h3>
            <div class="min-h-20 rounded-lg border border-default bg-elevated/20 px-3 py-3">
              <p class="whitespace-pre-wrap text-sm leading-relaxed text-highlighted">{{ archive.notes || 'Tidak ada keterangan.' }}</p>
            </div>
          </section>

          <section v-if="archive.fileUrl">
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">File Dokumen</h3>
              <span class="text-xs text-muted">Preview langsung</span>
            </div>
            <div class="overflow-hidden rounded-xl border border-default bg-elevated/20">
              <div class="flex items-center gap-3 border-b border-default px-3 py-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UIcon :name="isPdf(archive.fileUrl) ? 'i-lucide-file-text' : 'i-lucide-image'" class="size-4.5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">{{ isPdf(archive.fileUrl) ? 'Dokumen PDF' : 'Gambar Dokumen' }}</p>
                  <p class="text-xs text-muted">File terlampir pada arsip</p>
                </div>
                <a :href="archive.fileUrl" target="_blank" rel="noopener noreferrer" class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-primary" aria-label="Unduh file">
                  <UIcon name="i-lucide-download" class="size-4" />
                </a>
              </div>
              <div class="px-3 py-3">
                <div v-if="previewOpen" class="overflow-hidden rounded-lg border border-default bg-default">
                  <div v-if="isPdf(archive.fileUrl)" class="h-[420px] sm:h-[480px]"><PdfViewer :src="archive.fileUrl" /></div>
                  <img v-else :src="archive.fileUrl" :alt="`Preview ${archive.documentName}`" class="max-h-[420px] w-full object-contain sm:max-h-[480px]" />
                </div>
                <button v-else type="button" class="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-default text-sm text-muted transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary" @click="previewOpen = true">
                  <UIcon name="i-lucide-eye" class="size-5" />
                  Lihat Preview Dokumen
                </button>
                <button v-if="previewOpen" type="button" class="mt-2 text-xs font-medium text-primary hover:underline" @click="previewOpen = false">
                  Sembunyikan Preview
                </button>
              </div>
            </div>
          </section>
          <section v-else class="rounded-xl border border-dashed border-default px-4 py-5 text-center">
            <UIcon name="i-lucide-file-question" class="mx-auto size-6 text-muted" />
            <p class="mt-2 text-sm font-medium text-highlighted">Belum ada file dokumen</p>
            <p class="mt-1 text-xs text-muted">Tambahkan file melalui tombol Edit Arsip.</p>
          </section>
        </div>

        <div class="sticky bottom-0 border-t border-default bg-default/95 px-5 py-4 backdrop-blur-sm sm:px-6">
          <UButton label="Edit Arsip" icon="i-lucide-pencil" color="primary" block @click="emit('edit', archive)" />
        </div>
      </div>
      <div v-else class="flex min-h-64 items-center justify-center px-6 text-sm text-muted">Arsip tidak ditemukan.</div>
    </template>
  </USlideover>
</template>
