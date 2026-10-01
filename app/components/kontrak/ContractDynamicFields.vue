<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { ContractInputField } from '~/types'

/**
 * Renderer field dinamis kontrak (`CONTRACT_INPUT`) berdasarkan `dataType`.
 *
 * Field berasal dari `GET /api/contract-templates/:id/fields`, yaitu
 * `fieldDefinitions` versi PUBLISHED template — sumber yang sama dengan yang
 * divalidasi server. Karena itu nilai dikirim dengan key **polos** (tanpa prefix
 * `custom.`); resolver backend (`template-value-resolver.helpers.ts`) yang
 * menambahkan prefix itu saat mencocokkan placeholder.
 *
 * Validasi `required` sengaja dilakukan di modal pemanggil, bukan di sini, agar
 * pesan errornya bisa ditampilkan bersamaan dengan field kontrak lain di `UForm`
 * yang sama. Komponen ini hanya menerima peta `errors` untuk ditampilkan.
 */
const props = withDefaults(defineProps<{
  fields: ContractInputField[]
  modelValue: Record<string, any>
  /** Pesan error per key field, dihitung modal pemanggil saat submit. */
  errors?: Record<string, string>
  /** Mode baca-saja (dipakai modal Perpanjang: nilai diwarisi dari kontrak induk). */
  readonly?: boolean
}>(), {
  errors: () => ({}),
  readonly: false
})

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, any>] }>()

const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// Popover tanggal bekerja dengan `CalendarDate`, sementara yang dikirim ke
// server adalah string `YYYY-MM-DD` (format yang diterima backend pertama kali).
const dateValues = reactive<Record<string, CalendarDate | null>>({})

watch(
  () => props.fields.map(field => `${field.key}:${props.modelValue?.[field.key] ?? ''}`).join('|'),
  () => {
    for (const field of props.fields) {
      if (field.dataType !== 'DATE') continue
      const raw = props.modelValue?.[field.key]
      dateValues[field.key] = toCalDate(typeof raw === 'string' ? raw : null)
    }
  },
  { immediate: true }
)

function update(key: string, value: unknown) {
  emit('update:modelValue', { ...(props.modelValue ?? {}), [key]: value })
}

function onDateSelect(field: ContractInputField, value: CalendarDate | null) {
  dateValues[field.key] = value
  update(field.key, fromCalDate(value))
}

/** Opsi DROPDOWN bisa berupa string langsung atau `{ label, value }`. */
function selectItems(field: ContractInputField) {
  const options = Array.isArray(field.options) ? field.options : []
  return options.map((option) => {
    const value = option && typeof option === 'object'
      ? (option as { value?: unknown, label?: unknown }).value ?? (option as { label?: unknown }).label
      : option
    return { label: String(value ?? ''), value: String(value ?? '') }
  })
}
</script>

<template>
  <div v-if="fields.length" class="space-y-4 rounded-xl border border-default bg-elevated/40 p-4">
    <div class="flex items-start gap-2">
      <UIcon name="i-lucide-list-plus" class="w-4 h-4 text-muted shrink-0 mt-0.5" />
      <div>
        <p class="text-sm font-medium text-highlighted">
          Data Tambahan Template
        </p>
        <p class="text-xs text-muted">
          Field di bawah berasal dari template yang dipilih dan ikut tercetak di dokumen kontrak.
        </p>
      </div>
    </div>

    <template v-for="field in fields" :key="field.key">
      <UFormField :label="field.label" :required="field.required" :error="errors[field.key]">
        <UInput
          v-if="field.dataType === 'TEXT'"
          :model-value="modelValue?.[field.key] ?? ''"
          :disabled="readonly"
          :placeholder="`Isi ${field.label}...`"
          class="w-full"
          @update:model-value="update(field.key, $event)"
        />

        <UInput
          v-else-if="field.dataType === 'NUMBER'"
          :model-value="modelValue?.[field.key] ?? ''"
          :disabled="readonly"
          type="number"
          :placeholder="`Isi ${field.label}...`"
          class="w-full"
          @update:model-value="update(field.key, $event)"
        />

        <UPopover v-else-if="field.dataType === 'DATE'" :content="{ side: 'bottom', align: 'start' }">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-calendar"
            class="w-full justify-start font-normal"
            :class="!dateValues[field.key] ? 'text-muted' : ''"
            :disabled="readonly"
          >
            {{ dateValues[field.key] ? formatDisplay(dateValues[field.key]) : `Pilih ${field.label}...` }}
          </UButton>
          <template #content>
            <CalendarPicker
              :model-value="dateValues[field.key]"
              @update:model-value="onDateSelect(field, $event)"
            />
          </template>
        </UPopover>

        <USelect
          v-else
          :model-value="modelValue?.[field.key] ?? undefined"
          :items="selectItems(field)"
          :disabled="readonly"
          :placeholder="`Pilih ${field.label}...`"
          class="w-full"
          @update:model-value="update(field.key, $event)"
        />
      </UFormField>
    </template>

    <p v-if="readonly" class="text-xs text-muted">
      Nilai ini diwarisi dari kontrak sebelumnya dan tidak dapat diubah saat perpanjangan.
    </p>
  </div>
</template>
