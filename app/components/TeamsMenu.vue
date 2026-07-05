<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const { logoUrl, organizationName } = useAppSettings()
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
      <div class="flex items-center justify-center size-6 rounded-md shrink-0 overflow-hidden">
        <img
          v-if="logoUrl"
          :src="logoUrl"
          :alt="organizationName"
          class="w-full h-full object-contain"
        />
        <div
          v-else
          class="flex items-center justify-center size-6 rounded-md bg-primary text-white font-bold text-xs"
        >
          {{ (organizationName || 'Kokarsi')[0] }}
        </div>
      </div>
    </template>
    <span v-if="!collapsed" class="font-semibold text-sm truncate">{{ organizationName }}</span>
  </UButton>
</template>
