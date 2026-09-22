<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'

interface Archive { id: number; documentName: string; documentNumber?: string | null; createdDate?: string | null; expiryDate?: string | null; notes?: string | null; fileUrl?: string | null }
const props = defineProps<{ open: boolean; mode: 'add' | 'edit'; initialData?: Archive | null }>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()
const toast = useToast()
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()
const createdDateCal = shallowRef<CalendarDate | null>(null)
const expiryDateCal = shallowRef<CalendarDate | null>(null)
watch(createdDateCal, value => { state.createdDate = fromCalDate(value) })
watch(expiryDateCal, value => { state.expiryDate = fromCalDate(value) })
const schema = z.object({
  documentName: z.string().min(1, 'Nama dokumen wajib diisi'),
  documentNumber: z.string().optional(),
  createdDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})
type Schema = z.output<typeof schema>
const state = reactive<Schema>({ documentName: '', documentNumber: '', createdDate: '', expiryDate: '', notes: '' })
const title = computed(() => props.mode === 'edit' ? 'Edit Arsip Umum' : 'Tambah Arsip Umum')
const hasExistingFile = computed(() => !!props.initialData?.fileUrl)

watch(() => props.open, open => {
  if (!open) return
  const data = props.mode === 'edit' ? props.initialData : null
  state.documentName = data?.documentName ?? ''
  state.documentNumber = data?.documentNumber ?? ''
  state.createdDate = data?.createdDate?.slice(0, 10) ?? ''
  state.expiryDate = data?.expiryDate?.slice(0, 10) ?? ''
  state.notes = data?.notes ?? ''
  createdDateCal.value = toCalDate(state.createdDate)
  expiryDateCal.value = toCalDate(state.expiryDate)
  selectedFile.value = null
}, { immediate: true })

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024 || !file.type.match(/\/(jpg|jpeg|png|webp|pdf)$/)) {
    toast.add({ title: 'File tidak valid', description: 'Gunakan PDF/JPG/PNG/WEBP maksimal 10 MB.', color: 'error' })
    input.value = ''
    return
  }
  selectedFile.value = file
}

function clearSelectedFile() {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function chooseFile() {
  fileInput.value?.click()
}

async function uploadFile(id: number) {
  if (!selectedFile.value) return
  const body = new FormData()
  body.append('file', selectedFile.value)
  await $fetch(`/api/general-archives/${id}/file`, { method: 'POST', body })
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const method = props.mode === 'edit' ? 'PUT' : 'POST'
    const url = props.mode === 'edit' ? `/api/general-archives/${props.initialData!.id}` : '/api/general-archives'
    const result = await $fetch<Archive>(url, { method, body: { ...event.data, documentNumber: event.data.documentNumber || undefined, createdDate: event.data.createdDate || undefined, expiryDate: event.data.expiryDate || undefined, notes: event.data.notes || undefined } })
    if (selectedFile.value) await uploadFile(result.id)
    toast.add({ title: props.mode === 'edit' ? 'Arsip berhasil diperbarui' : 'Arsip berhasil ditambahkan', color: 'success' })
    emit('saved'); emit('update:open', false)
  } catch (error: any) {
    toast.add({ title: 'Gagal menyimpan arsip', description: error?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally { loading.value = false }
}
</script>

<template>
  <UModal :open="open" :title="title" :ui="{ content: 'sm:max-w-lg' }" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nama Dokumen" name="documentName" required><UInput v-model="state.documentName" class="w-full" placeholder="Contoh: Perjanjian Kerja Sama" /></UFormField>
        <UFormField label="Nomor Dokumen" name="documentNumber"><UInput v-model="state.documentNumber" class="w-full" placeholder="Opsional" /></UFormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Tanggal Dibuat" name="createdDate"><UPopover><UButton color="neutral" variant="outline" icon="i-lucide-calendar" class="w-full justify-start font-normal" :class="!createdDateCal && 'text-muted'">{{ createdDateCal ? formatDisplay(createdDateCal) : 'Opsional' }}</UButton><template #content><CalendarPicker v-model="createdDateCal" class="p-2" /></template></UPopover></UFormField>
          <UFormField label="Tanggal Berakhir" name="expiryDate"><UPopover><UButton color="neutral" variant="outline" icon="i-lucide-calendar-clock" class="w-full justify-start font-normal" :class="!expiryDateCal && 'text-muted'">{{ expiryDateCal ? formatDisplay(expiryDateCal) : 'Opsional' }}</UButton><template #content><CalendarPicker v-model="expiryDateCal" class="p-2" /></template></UPopover></UFormField>
        </div>
        <UFormField label="Keterangan" name="notes"><UTextarea v-model="state.notes" class="w-full" :rows="3" placeholder="Keterangan tambahan (opsional)" /></UFormField>
        <UFormField label="File Dokumen" description="Opsional · PDF, JPG, PNG, atau WEBP · Maksimal 10 MB">
          <div class="space-y-2">
            <div v-if="hasExistingFile && !selectedFile" class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2.5 text-sm">
              <UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-muted">File dokumen tersimpan</span>
              <a :href="initialData!.fileUrl!" target="_blank" class="shrink-0 text-primary hover:underline">Unduh</a>
              <UButton label="Ganti" size="xs" color="neutral" variant="subtle" @click="chooseFile" />
            </div>
            <div v-if="selectedFile" class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
              <UIcon name="i-lucide-file-check-2" class="size-4 shrink-0 text-primary" />
              <span class="min-w-0 flex-1 truncate text-highlighted">{{ selectedFile.name }}</span>
              <span class="shrink-0 text-xs text-muted">{{ (selectedFile.size / 1024 / 1024).toFixed(1) }} MB</span>
              <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" aria-label="Hapus file pilihan" @click="clearSelectedFile" />
            </div>
            <button type="button" class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-default bg-elevated/20 px-4 py-4 text-sm text-muted transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary" @click="chooseFile">
              <UIcon name="i-lucide-upload" class="size-4" />
              {{ selectedFile || hasExistingFile ? 'Pilih file pengganti' : 'Pilih file dokumen' }}
            </button>
            <input ref="fileInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" class="hidden" @change="onFileSelected" />
          </div>
        </UFormField>
        <div class="flex justify-end gap-2"><UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" /><UButton type="submit" label="Simpan" color="primary" :loading="loading" /></div>
      </UForm>
    </template>
  </UModal>
</template>
