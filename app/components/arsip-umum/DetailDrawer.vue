<script setup lang="ts">
interface Archive { id: number; documentName: string; documentNumber?: string | null; createdDate?: string | null; expiryDate?: string | null; notes?: string | null; fileUrl?: string | null; createdAt?: string; updatedAt?: string }
const props = defineProps<{ open: boolean; archive: Archive | null }>()
const emit = defineEmits<{ 'update:open': [boolean]; edit: [Archive] }>()
const previewOpen = ref(false)
watch(() => props.archive?.id, () => { previewOpen.value = false })
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' }
function isPdf(url?: string | null) { return !!url && url.toLowerCase().includes('.pdf') }
</script>

<template>
  <USlideover :open="open" title="Detail Arsip Umum" side="right" :ui="{ content: 'max-w-xl' }" @update:open="emit('update:open', $event)">
    <template #body>
      <div v-if="archive" class="space-y-5">
        <div class="rounded-xl border border-default bg-elevated/40 p-4"><div class="flex items-start gap-3"><div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UIcon name="i-lucide-archive" class="size-5" /></div><div class="min-w-0"><p class="font-semibold text-highlighted">{{ archive.documentName }}</p><p class="text-sm text-muted">{{ archive.documentNumber || 'Nomor dokumen tidak tersedia' }}</p></div></div></div>
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><dt class="text-xs text-muted">Tanggal Dibuat</dt><dd class="text-sm text-highlighted">{{ formatDate(archive.createdDate) }}</dd></div><div><dt class="text-xs text-muted">Tanggal Berakhir</dt><dd class="text-sm text-highlighted">{{ formatDate(archive.expiryDate) }}</dd></div></dl>
        <div><p class="mb-1 text-xs text-muted">Keterangan</p><p class="whitespace-pre-wrap text-sm text-highlighted">{{ archive.notes || '-' }}</p></div>
        <div v-if="archive.fileUrl" class="border-t border-default pt-4"><div class="flex flex-wrap items-center gap-2"><a :href="archive.fileUrl" target="_blank" class="inline-flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm text-primary hover:bg-elevated"><UIcon name="i-lucide-download" class="size-4" />Unduh File</a><button type="button" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-primary" @click="previewOpen = !previewOpen"><UIcon name="i-lucide-eye" class="size-4" />{{ previewOpen ? 'Sembunyikan Preview' : 'Lihat Preview' }}</button></div><div v-if="previewOpen" class="mt-3 overflow-hidden rounded-lg border border-default bg-elevated/20"><div v-if="isPdf(archive.fileUrl)" class="h-[480px]"><PdfViewer :src="archive.fileUrl" /></div><img v-else :src="archive.fileUrl" alt="Preview Arsip Umum" class="max-h-[480px] w-full object-contain" /></div></div>
        <div class="flex justify-end border-t border-default pt-4"><UButton label="Edit Arsip" icon="i-lucide-pencil" color="primary" @click="emit('edit', archive)" /></div>
      </div>
      <div v-else class="flex items-center justify-center py-12 text-sm text-muted">Arsip tidak ditemukan.</div>
    </template>
  </USlideover>
</template>
