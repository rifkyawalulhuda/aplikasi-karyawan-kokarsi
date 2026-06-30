<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    block
    :square="collapsed"
    class="py-2 cursor-default"
    :ui="{ trailingIcon: 'text-dimmed' }"
  >
    <template #leading>
      <div class="flex items-center justify-center size-6 rounded-md bg-primary text-white font-bold text-xs shrink-0">
        K
      </div>
    </template>
    <span v-if="!collapsed" class="font-semibold text-sm truncate">Kokarsi PT. Sankyu</span>
  </UButton>
</template>
