<script setup lang="ts">
interface AkteDokumen {
  id: number
  tanggal: string
  notaris: string
  nomorAkte: string
  judulAkte: string
  nomorSk?: string | null
  tanggalSk?: string | null
  keterangan?: string | null
  fileUrl?: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  open: boolean
  document: AkteDokumen | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [document: AkteDokumen]
}>()

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isPdf(url: string): boolean {
  return url.toLowerCase().includes('.pdf')
}

const previewOpen = ref(false)

watch(() => props.document?.id, () => {
  previewOpen.value = false
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
        <!-- Icon ring primary -->
        <div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UIcon name="i-lucide-file-signature" class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold text-highlighted truncate">
            {{ document?.judulAkte ?? '-' }}
          </p>
          <p class="mt-0.5 font-mono text-xs text-muted truncate">
            {{ document?.nomorAkte ?? '' }}
          </p>
        </div>
      </div>
    </template>

    <!-- BODY -->
    <template #body>
      <div v-if="document" class="space-y-5 py-2">

        <!-- Notaris Card (signature element) -->
        <div class="rounded-xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/50 p-4 dark:border-amber-800 dark:border-l-amber-500 dark:bg-amber-950/20">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-scale-3" class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">Notaris</p>
              <p class="text-base font-bold text-highlighted">{{ document.notaris }}</p>
              <p class="mt-0.5 text-xs text-muted">Disahkan pada {{ formatDate(document.tanggal) }}</p>
            </div>
          </div>
        </div>

        <!-- Kartu Detail Akte -->
        <div class="rounded-xl border border-default bg-default p-4 space-y-3">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Detail Akte</p>
          <div>
            <p class="text-xs font-medium text-muted mb-0.5">No. Akte</p>
            <p class="inline-flex items-center gap-1.5 text-sm font-mono text-highlighted">
              <UIcon name="i-lucide-hash" class="size-3.5 text-muted" />
              {{ document.nomorAkte || '-' }}
            </p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted mb-0.5">Tanggal Akte</p>
            <p class="text-sm text-highlighted">{{ formatDate(document.tanggal) }}</p>
          </div>
        </div>

        <!-- SK Terkait (kondisional, hanya jika ada nomorSk) -->
        <div v-if="document.nomorSk" class="rounded-xl border border-default bg-elevated/30 p-4 space-y-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-file-check-2" class="size-4 shrink-0 text-muted" />
            <p class="text-xs font-medium text-muted uppercase tracking-wide">Surat Keputusan Terkait</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted mb-0.5">No. SK</p>
            <p class="inline-flex items-center gap-1.5 text-sm font-mono text-highlighted">
              <UIcon name="i-lucide-hash" class="size-3.5 text-muted" />
              {{ document.nomorSk }}
            </p>
          </div>
          <div v-if="document.tanggalSk">
            <p class="text-xs font-medium text-muted mb-0.5">Tanggal SK</p>
            <p class="text-sm text-highlighted">{{ formatDate(document.tanggalSk) }}</p>
          </div>
        </div>

        <!-- Keterangan -->
        <template v-if="document.keterangan">
          <USeparator />
          <div class="border-l-2 border-default pl-3">
            <p class="text-xs font-medium text-muted uppercase tracking-wide mb-1">Keterangan</p>
            <p class="text-sm text-highlighted whitespace-pre-wrap">{{ document.keterangan }}</p>
          </div>
        </template>

        <!-- File dokumen -->
        <template v-if="document.fileUrl">
          <USeparator v-if="!document.keterangan" />
          <div>
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
        </template>

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
        <UIcon name="i-lucide-file-signature" class="size-10 opacity-40" />
        <p class="text-sm">Tidak ada data yang dipilih</p>
      </div>
    </template>

    <!-- FOOTER -->
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
