<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const { logoUrl, organizationName } = useAppSettings()
</script>

<template>
  <!-- Saat rail (collapsed) nama organisasi tidak tampil, jadi tooltip
       menampilkannya. Saat terbuka tooltip dimatikan karena namanya sudah
       terlihat di samping logo. -->
  <UTooltip
    :disabled="!collapsed"
    :text="organizationName || 'Kokarsi'"
    :content="{ side: 'right' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :block="!collapsed"
      :square="collapsed"
      :class="collapsed ? '' : 'py-2'"
      class="cursor-default"
      :aria-label="organizationName || 'Kokarsi'"
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
  </UTooltip>
</template>
