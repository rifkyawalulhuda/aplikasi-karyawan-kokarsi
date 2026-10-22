<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'

defineProps<{
  modelValue: CalendarDate | null
  placeholder: string
  minDate?: CalendarDate | null
  field?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CalendarDate | null]
}>()

const { formatDisplay } = useDatePicker()
</script>

<template>
  <UPopover :content="{ side: 'bottom', align: 'start' }">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      class="w-full justify-start font-normal"
      :class="!modelValue ? 'text-muted' : ''"
      :data-field="field"
    >
      {{ modelValue ? formatDisplay(modelValue) : placeholder }}
    </UButton>
    <template #content>
      <CalendarPicker
        :model-value="modelValue"
        :min-date="minDate"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </template>
  </UPopover>
</template>
