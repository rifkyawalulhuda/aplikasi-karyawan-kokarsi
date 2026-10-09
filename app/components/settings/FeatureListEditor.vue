<script setup lang="ts">
import type { LoginFeatureItem } from '~/types'

const props = defineProps<{ modelValue: LoginFeatureItem[] }>()

const emit = defineEmits<{ 'update:modelValue': [value: LoginFeatureItem[]] }>()

const ICON_OPTIONS = [
  'i-lucide-users',
  'i-lucide-file-text',
  'i-lucide-bar-chart-3',
  'i-lucide-shield-check',
  'i-lucide-briefcase',
  'i-lucide-calendar-days',
  'i-lucide-id-card',
  'i-lucide-building-2',
  'i-lucide-file-signature',
  'i-lucide-scroll-text',
  'i-lucide-clipboard-list',
  'i-lucide-lock',
  'i-lucide-trending-up',
  'i-lucide-clock',
  'i-lucide-bell',
  'i-lucide-database',
  'i-lucide-kanban',
  'i-lucide-badge-check',
  'i-lucide-wallet',
  'i-lucide-truck'
]

const iconItems = ICON_OPTIONS.map(icon => ({
  label: icon.replace('i-lucide-', '').replace(/-/g, ' '),
  value: icon,
  icon
}))

function update(items: LoginFeatureItem[]) {
  emit('update:modelValue', items)
}

function add() {
  update([...props.modelValue, { icon: 'i-lucide-check', text: '' }])
}

function remove(index: number) {
  update(props.modelValue.filter((_, i) => i !== index))
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= props.modelValue.length) return
  const items = [...props.modelValue]
  const current = items[index]
  const swap = items[target]
  if (!current || !swap) return
  items[index] = swap
  items[target] = current
  update(items)
}

function setField(index: number, key: 'icon' | 'text', value: string) {
  update(props.modelValue.map((item, i) => i === index ? { ...item, [key]: value } : item))
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="(item, index) in modelValue" :key="index" class="flex items-center gap-2">
      <USelectMenu
        :model-value="item.icon"
        :items="iconItems"
        value-key="value"
        class="w-36 shrink-0"
        size="sm"
        :search-input="false"
        @update:model-value="(value: string) => setField(index, 'icon', value)"
      />
      <UInput
        :model-value="item.text"
        placeholder="Teks fitur"
        class="flex-1"
        size="sm"
        @update:model-value="(value: string) => setField(index, 'text', value)"
      />
      <UButton
        icon="i-lucide-chevron-up"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Naikkan"
        :disabled="index === 0"
        @click="move(index, -1)"
      />
      <UButton
        icon="i-lucide-chevron-down"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Turunkan"
        :disabled="index === modelValue.length - 1"
        @click="move(index, 1)"
      />
      <UButton
        icon="i-lucide-trash-2"
        size="xs"
        color="error"
        variant="ghost"
        aria-label="Hapus fitur"
        @click="remove(index)"
      />
    </div>

    <p v-if="!modelValue.length" class="text-sm text-muted italic">
      Belum ada fitur. Tambahkan minimal satu.
    </p>

    <UButton
      label="Tambah fitur"
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      size="sm"
      @click="add"
    />
  </div>
</template>
