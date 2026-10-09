<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'
import type { OrgPeriod } from '~/types/org-structure'

const props = defineProps<{
  open: boolean
  mode: 'add' | 'edit'
  initialData?: OrgPeriod | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

const startDateCal = shallowRef<CalendarDate | null>(null)
const endDateCal   = shallowRef<CalendarDate | null>(null)

watch(startDateCal, val => { state.startDate = fromCalDate(val) })
watch(endDateCal,   val => { state.endDate   = fromCalDate(val) })

const schema = z.object({
  name: z.string().min(1, 'Nama periode wajib diisi'),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().optional(),
  isActive: z.boolean(),
  notes: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive({
  name: '',
  startDate: '',
  endDate: '',
  isActive: true,
  notes: '',
})

const isEditMode = computed(() => props.mode === 'edit')
const title = computed(() => isEditMode.value ? 'Edit Periode' : 'Tambah Periode')

watch(() => props.open, (open) => {
  if (!open) return
  const d = props.initialData
  if (isEditMode.value && d) {
    state.name = d.name
    state.startDate = d.startDate ? d.startDate.slice(0, 10) : ''
    state.endDate = d.endDate ? d.endDate.slice(0, 10) : ''
    state.isActive = d.isActive
    state.notes = d.notes ?? ''
  } else {
    state.name = ''
    state.startDate = ''
    state.endDate = ''
    state.isActive = true
    state.notes = ''
  }
  startDateCal.value = state.startDate ? toCalDate(state.startDate) : null
  endDateCal.value = state.endDate ? toCalDate(state.endDate) : null
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const payload = {
      name: event.data.name,
      startDate: event.data.startDate,
      endDate: event.data.endDate || undefined,
      isActive: event.data.isActive,
      notes: event.data.notes || undefined,
    }
    if (isEditMode.value && props.initialData) {
      await $fetch(`/api/org-structure/periods/${props.initialData.id}`, {
        method: 'PUT',
        body: payload,
        credentials: 'include',
      })
    } else {
      await $fetch('/api/org-structure/periods', {
        method: 'POST',
        body: payload,
        credentials: 'include',
      })
    }
    toast.add({ title: isEditMode.value ? 'Periode diperbarui' : 'Periode ditambahkan', color: 'success' })
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    toast.add({ title: 'Gagal menyimpan periode', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{ wrapper: 'items-start sm:items-center', content: 'w-full max-w-md' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nama Periode" name="name" required>
          <UInput v-model="state.name" placeholder="Contoh: Periode 2024–2027" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Tanggal Mulai" name="startDate" required>
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!startDateCal && 'text-muted'"
              >
                {{ startDateCal ? formatDisplay(startDateCal) : 'Mulai' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="startDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
          <UFormField label="Tanggal Selesai" name="endDate">
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!endDateCal && 'text-muted'"
              >
                {{ endDateCal ? formatDisplay(endDateCal) : 'Selesai' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="endDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
        </div>

        <UFormField label="Status Periode">
          <div class="flex items-center gap-2">
            <USwitch v-model="state.isActive" />
            <span class="text-sm text-muted">{{ state.isActive ? 'Aktif' : 'Tidak Aktif' }}</span>
          </div>
        </UFormField>

        <UFormField label="Keterangan" name="notes">
          <UTextarea v-model="state.notes" placeholder="Catatan tambahan (opsional)" :rows="2" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton type="submit" label="Simpan" color="primary" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
