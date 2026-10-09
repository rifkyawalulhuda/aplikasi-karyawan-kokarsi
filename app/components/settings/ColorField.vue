<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  fallback?: string
}>(), {
  label: 'Warna',
  placeholder: '#000000',
  fallback: '#000000'
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const displayColor = computed(() => props.modelValue || props.fallback)
const isSet = computed(() => !!props.modelValue)

function update(value: string | undefined) {
  emit('update:modelValue', value ?? '')
}

function reset() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="space-y-1">
    <label class="text-xs font-medium text-muted">{{ label }}</label>
    <div class="flex items-center gap-2">
      <UPopover :content="{ side: 'bottom', align: 'start' }">
        <button
          type="button"
          class="size-9 shrink-0 rounded-md border border-default shadow-sm transition hover:ring-2 hover:ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :style="{ backgroundColor: displayColor }"
          :aria-label="`Pilih ${label}`"
        />
        <template #content>
          <UColorPicker :model-value="displayColor" class="p-2" @update:model-value="update" />
        </template>
      </UPopover>
      <UInput
        :model-value="modelValue"
        :placeholder="placeholder"
        class="flex-1"
        size="sm"
        @update:model-value="update"
      />
      <UButton
        v-if="isSet"
        icon="i-lucide-rotate-ccw"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Reset warna"
        @click="reset"
      />
    </div>
  </div>
</template>
