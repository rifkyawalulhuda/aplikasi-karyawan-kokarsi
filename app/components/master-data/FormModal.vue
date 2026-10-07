<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MasterField, MasterRow, ResourceDef } from './resources'

const props = defineProps<{
  open: boolean
  resource: ResourceDef
  /** null = mode tambah, terisi = mode edit. */
  item?: MasterRow | null
  loading?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [payload: Record<string, unknown>]
}>()

const isEdit = computed(() => !!props.item)

function buildInitialState(): Record<string, string> {
  const state: Record<string, string> = {}
  for (const field of props.resource.fields) {
    const current = props.item?.[field.key]
    state[field.key] = current == null ? (field.defaultValue ?? '') : String(current)
  }
  return state
}

const formState = ref<Record<string, string>>(buildInitialState())

watch(
  () => [props.open, props.item, props.resource.key] as const,
  () => {
    if (!props.open) return
    formState.value = buildInitialState()
  }
)

const schema = computed(() => {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of props.resource.fields) {
    let fieldSchema = z.string()
    if (field.required) fieldSchema = fieldSchema.min(1, `${field.label} wajib diisi`)
    if (field.type === 'email') {
      fieldSchema = fieldSchema.refine(
        value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        'Format email tidak valid'
      )
    }
    shape[field.key] = fieldSchema
  }
  return z.object(shape)
})

const title = computed(() => `${isEdit.value ? 'Edit' : 'Tambah'} ${props.resource.singular}`)
const description = computed(() =>
  isEdit.value
    ? `Perbarui data ${props.resource.singular.toLowerCase()}.`
    : props.resource.description
)

function onSubmit(event: FormSubmitEvent<Record<string, unknown>>) {
  emit('submit', event.data)
}

function close() {
  emit('update:open', false)
}

function fieldInputType(field: MasterField): 'text' | 'email' | 'tel' {
  if (field.type === 'email' || field.type === 'tel') return field.type
  return 'text'
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="formState"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          v-for="field in resource.fields"
          :key="field.key"
          :label="field.label"
          :name="field.key"
          :required="field.required"
          :description="field.description"
        >
          <USelect
            v-if="field.type === 'select'"
            v-model="formState[field.key]"
            :items="field.options ?? []"
            class="w-full"
          />
          <UTextarea
            v-else-if="field.type === 'textarea'"
            v-model="formState[field.key]"
            :rows="3"
            :placeholder="field.placeholder"
            class="w-full"
          />
          <UInput
            v-else
            v-model="formState[field.key]"
            :type="fieldInputType(field)"
            :placeholder="field.placeholder"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="errorMessage"
        />

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="close"
          />
          <UButton
            type="submit"
            :label="isEdit ? 'Simpan Perubahan' : 'Tambah'"
            color="primary"
            :loading="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
