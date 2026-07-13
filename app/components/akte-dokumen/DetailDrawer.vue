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
    :ui="{ panel: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-start justify-between gap-3 w-full">
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold text-highlighted truncate">
            {{ document?.judulAkte ?? '-' }}
          </p>
          <p class="text-sm text-muted mt-0.5 font-mono">{{ document?.nomorAkte ?? '' }}</p>
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
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Judul Akte</p>
              <p class="text-sm text-highlighted">{{ document.judulAkte }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Nomor Akte</p>
              <p class="text-sm font-mono text-highlighted">{{ document.nomorAkte }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal</p>
              <p class="text-sm text-highlighted">{{ formatDate(document.tanggal) }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Notaris</p>
              <p class="text-sm text-highlighted">{{ document.notaris }}</p>
            </div>
          </div>

          <!-- Right column -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">No. SK</p>
              <p class="text-sm font-mono text-highlighted">{{ document.nomorSk ?? '-' }}</p>
            </div>

            <div>
              <p class="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">Tanggal SK</p>
              <p class="text-sm text-highlighted">{{ document.tanggalSk ? formatDate(document.tanggalSk) : '-' }}</p>
            </div>
          </div>
        </div>

        <USeparator />

        <!-- Keterangan -->
        <div v-if="document.keterangan">
          <p class="text-xs font-medium text-muted uppercase tracking-wide mb-1">Keterangan</p>
          <p class="text-sm text-highlighted whitespace-pre-wrap">{{ document.keterangan }}</p>
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

        <USeparator />

        <!-- Metadata -->
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
