<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Employee, TerminationType } from '~/types'
import { CalendarDate } from '@internationalized/date'

const props = defineProps<{ employee: Employee | null }>()
const emit = defineEmits<{ saved: [] }>()

const open = defineModel<boolean>({ default: false })
const loading = ref(false)
const toast = useToast()
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// ── DatePicker CalendarDate refs ─────────────────────────────────────────────
const terminationDateCal = shallowRef<CalendarDate | null>(
  toCalDate(new Date().toISOString().slice(0, 10))
)
watch(terminationDateCal, val => { state.terminationDate = fromCalDate(val) })

const schema = z.object({
  terminationType: z.enum(['RESIGN', 'PHK']),
  terminationDate: z.string().min(1, 'Wajib diisi'),
  reason: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  terminationType: 'RESIGN',
  terminationDate: new Date().toISOString().slice(0, 10),
  reason: '',
})

watch(() => open.value, (isOpen) => {
  if (!isOpen) {
    state.terminationType = 'RESIGN'
    state.terminationDate = new Date().toISOString().slice(0, 10)
    state.reason = ''
    terminationDateCal.value = toCalDate(new Date().toISOString().slice(0, 10))
  }
})

const statusLabelMap: Record<TerminationType, string> = {
  RESIGN: 'Resign',
  PHK: 'PHK',
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.employee) return

  loading.value = true
  try {
    await $fetch(`/api/employees/${props.employee.id}/offboarding`, {
      method: 'POST',
      body: event.data,
    })
    toast.add({
      title: 'Offboarding berhasil diproses',
      description: `${props.employee.fullName} ditandai ${statusLabelMap[event.data.terminationType]}.`,
      color: 'success',
    })
    open.value = false
    emit('saved')
  } catch (e: any) {
    toast.add({
      title: 'Gagal memproses offboarding',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Proses Offboarding"
    description="Tandai karyawan sebagai Resign atau PHK. Status kepegawaian dan kontrak akan diperbarui otomatis."
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div v-if="employee" class="space-y-4">
        <div class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="font-medium text-highlighted">{{ employee.fullName }}</p>
          <p class="text-sm text-muted">{{ employee.employeeNo }} • {{ employee.email }}</p>
        </div>

        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField label="Jenis Offboarding" name="terminationType" required>
            <USelect
              v-model="state.terminationType"
              :items="[
                { label: 'Resign', value: 'RESIGN' },
                { label: 'PHK', value: 'PHK' }
              ]"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Tanggal Efektif" name="terminationDate" required>
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!terminationDateCal && 'text-muted'"
              >
                {{ terminationDateCal ? formatDisplay(terminationDateCal) : 'Pilih tanggal efektif' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="terminationDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>

          <UFormField label="Catatan" name="reason">
            <UTextarea
              v-model="state.reason"
              :rows="4"
              placeholder="Opsional. Isi alasan atau catatan proses offboarding."
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton label="Batal" color="neutral" variant="subtle" @click="open = false" />
            <UButton label="Simpan Offboarding" color="error" type="submit" :loading="loading" />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
