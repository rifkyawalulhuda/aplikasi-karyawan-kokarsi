<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  label: string
  name: string
  placeholder?: string
  autocomplete?: string
  hint?: string
}>(), {
  placeholder: '',
  autocomplete: 'off',
  hint: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const show = ref(false)
const capsLock = ref(false)

function syncCapsLock(event: KeyboardEvent) {
  capsLock.value = event.getModifierState('CapsLock')
}

function onInput(value: string | number) {
  emit('update:modelValue', String(value ?? ''))
}
</script>

<template>
  <UFormField
    :label="label"
    :name="name"
    :hint="hint"
    :ui="{ error: 'mt-2 text-xs text-error-600 dark:text-error-400' }"
  >
    <UInput
      :model-value="modelValue"
      :type="show ? 'text' : 'password'"
      :name="name"
      class="w-full"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :data-field="name"
      @update:model-value="onInput"
      @keydown="syncCapsLock"
      @keyup="syncCapsLock"
      @blur="capsLock = false"
    >
      <template #trailing>
        <UButton
          :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          color="neutral"
          variant="ghost"
          square
          class="size-8 -me-1.5"
          :aria-label="show ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`"
          :aria-pressed="show"
          @click="show = !show"
        />
      </template>
    </UInput>
    <p v-if="capsLock" class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning-700 dark:text-warning-400">
      <UIcon name="i-lucide-arrow-big-up" class="size-3.5 shrink-0" aria-hidden="true" />
      Caps Lock aktif — pastikan huruf besar/kecil sesuai.
    </p>
  </UFormField>
</template>
