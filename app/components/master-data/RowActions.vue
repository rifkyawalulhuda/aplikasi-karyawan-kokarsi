<script setup lang="ts">
const emit = defineEmits<{
  edit: []
  delete: []
}>()

const items = computed(() => [[
  { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => emit('edit') },
  { label: 'Hapus', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => emit('delete') }
]])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-ellipsis-vertical"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="'Aksi baris'"
    />
  </UDropdownMenu>
</template>
