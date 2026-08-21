<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'

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
  mode: 'add' | 'edit'
  initialData?: AkteDokumen | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// ── DatePicker CalendarDate refs ─────────────────────────────────────────────
const tanggalCal   = shallowRef<CalendarDate | null>(null)
const tanggalSkCal = shallowRef<CalendarDate | null>(null)

watch(tanggalCal,   val => { state.tanggal   = fromCalDate(val) })
watch(tanggalSkCal, val => { state.tanggalSk = fromCalDate(val) })

const schema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  notaris: z.string().min(1, 'Nama notaris wajib diisi'),
  nomorAkte: z.string().min(1, 'Nomor akte wajib diisi'),
  judulAkte: z.string().min(1, 'Judul akte wajib diisi'),
  nomorSk: z.string().optional(),
  tanggalSk: z.string().optional(),
  keterangan: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  tanggal: '',
  notaris: '',
  nomorAkte: '',
  judulAkte: '',
  nomorSk: '',
  tanggalSk: '',
  keterangan: '',
})

const isEditMode = computed(() => props.mode === 'edit')
const title = computed(() => isEditMode.value ? 'Edit Akte Dokumen' : 'Tambah Akte Dokumen')

// Populate on open
watch(
  () => props.open,
  (val) => {
    if (!val) return
    if (props.mode === 'edit' && props.initialData) {
      const d = props.initialData
      state.tanggal = d.tanggal ? d.tanggal.slice(0, 10) : ''
      state.notaris = d.notaris
      state.nomorAkte = d.nomorAkte
      state.judulAkte = d.judulAkte
      state.nomorSk = d.nomorSk ?? ''
      state.tanggalSk = d.tanggalSk ? d.tanggalSk.slice(0, 10) : ''
      state.keterangan = d.keterangan ?? ''
      tanggalCal.value   = toCalDate(d.tanggal ?? null)
      tanggalSkCal.value = toCalDate(d.tanggalSk ?? null)
    } else {
      state.tanggal = ''
      state.notaris = ''
      state.nomorAkte = ''
      state.judulAkte = ''
      state.nomorSk = ''
      state.tanggalSk = ''
      state.keterangan = ''
      tanggalCal.value   = null
      tanggalSkCal.value = null
    }
    selectedFile.value = null
  },
  { immediate: true },
)

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal 10MB', color: 'error' })
    input.value = ''
    return
  }
  if (!file.type.match(/\/(jpg|jpeg|png|webp|pdf)$/)) {
    toast.add({ title: 'Format tidak didukung', description: 'Gunakan PDF, JPG, PNG, atau WEBP', color: 'error' })
    input.value = ''
    return
  }
  selectedFile.value = file
}

async function uploadFile(id: number) {
  if (!selectedFile.value) return
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  await $fetch(`/api/akte-dokumen/${id}/file`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const body: Record<string, any> = {
      ...event.data,
      nomorSk: event.data.nomorSk || undefined,
      tanggalSk: event.data.tanggalSk || undefined,
      keterangan: event.data.keterangan || undefined,
    }

    let result: any
    if (isEditMode.value && props.initialData) {
      result = await $fetch(`/api/akte-dokumen/${props.initialData.id}`, {
        method: 'PUT',
        body,
        credentials: 'include',
      })
    } else {
      result = await $fetch('/api/akte-dokumen', {
        method: 'POST',
        body,
        credentials: 'include',
      })
    }

    if (selectedFile.value && result?.id) {
      try {
        await uploadFile(result.id)
      } catch {
        toast.add({
          title: isEditMode.value ? 'Akte berhasil diperbarui' : 'Akte berhasil ditambahkan',
          description: 'Namun gagal mengupload file.',
          color: 'warning',
        })
        emit('saved')
        emit('update:open', false)
        return
      }
    }

    toast.add({
      title: isEditMode.value ? 'Akte berhasil diperbarui' : 'Akte berhasil ditambahkan',
      color: 'success',
    })
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    toast.add({
      title: isEditMode.value ? 'Gagal memperbarui akte' : 'Gagal menambahkan akte',
      description: e?.data?.message ?? e?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="open" :title="title" :ui="{ content: 'sm:max-w-lg' }" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Tanggal -->
          <UFormField label="Tanggal" name="tanggal" required>
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!tanggalCal && 'text-muted'"
              >
                {{ tanggalCal ? formatDisplay(tanggalCal) : 'Pilih tanggal' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="tanggalCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>

          <!-- Nomor Akte -->
          <UFormField label="Nomor Akte" name="nomorAkte" required>
            <UInput v-model="state.nomorAkte" placeholder="Contoh: 01/2026" class="w-full" />
          </UFormField>
        </div>

        <!-- Judul Akte -->
        <UFormField label="Judul Akte" name="judulAkte" required>
          <UInput v-model="state.judulAkte" placeholder="Contoh: Akte Pendirian Koperasi" class="w-full" />
        </UFormField>

        <!-- Notaris -->
        <UFormField label="Notaris" name="notaris" required>
          <UInput v-model="state.notaris" placeholder="Nama notaris" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- No. SK -->
          <UFormField label="No. SK" name="nomorSk">
            <UInput v-model="state.nomorSk" placeholder="Nomor SK (opsional)" class="w-full" />
          </UFormField>

          <!-- Tanggal SK -->
          <UFormField label="Tanggal SK" name="tanggalSk">
            <div class="flex items-center gap-2">
              <UPopover class="flex-1">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  class="w-full justify-start font-normal"
                  :class="!tanggalSkCal && 'text-muted'"
                >
                  {{ tanggalSkCal ? formatDisplay(tanggalSkCal) : 'Pilih tanggal SK (opsional)' }}
                </UButton>
                <template #content>
                  <CalendarPicker v-model="tanggalSkCal" class="p-2" />
                </template>
              </UPopover>
              <UButton
                v-if="tanggalSkCal"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="tanggalSkCal = null"
              />
            </div>
          </UFormField>
        </div>

        <!-- Keterangan -->
        <UFormField label="Keterangan" name="keterangan">
          <UTextarea v-model="state.keterangan" placeholder="Keterangan tambahan (opsional)" :rows="3" class="w-full" />
        </UFormField>

        <!-- File Upload -->
        <UFormField label="File Dokumen">
          <div class="space-y-2">
            <input
              ref="fileInput"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              class="hidden"
              @change="onFileSelected"
            >
            <div class="flex items-center gap-2">
              <UButton
                type="button"
                label="Pilih File"
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                size="sm"
                @click="fileInput?.click()"
              />
              <span v-if="selectedFile" class="text-sm text-muted truncate max-w-48">
                {{ selectedFile.name }}
              </span>
              <span v-else-if="isEditMode && initialData?.fileUrl" class="text-sm text-muted">
                File sudah diupload
              </span>
              <span v-else class="text-sm text-muted">Belum ada file dipilih</span>
            </div>
            <p class="text-xs text-muted">PDF, JPG, PNG, atau WEBP. Maksimal 10MB.</p>
          </div>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            type="button"
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="emit('update:open', false)"
          />
          <UButton
            type="submit"
            :label="isEditMode ? 'Simpan Perubahan' : 'Tambah Akte'"
            color="primary"
            :loading="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
