<script setup lang="ts">
import { vehicleMeta } from '~/utils/vehicle-usage'

const props = withDefaults(defineProps<{
  vehicleNumber: string
  size?: 'sm' | 'md'
}>(), {
  size: 'md'
})

const meta = computed(() => vehicleMeta(props.vehicleNumber))
</script>

<template>
  <span
    class="inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ring ring-inset"
    :class="[meta.chipClass, size === 'sm' ? 'text-sm' : 'text-sm sm:text-base']"
  >
    <UIcon :name="meta.icon" class="size-4 shrink-0" aria-hidden="true" />
    <span class="truncate">
      <span v-if="meta.name" class="hidden sm:inline">{{ meta.name }}&nbsp;</span>{{ meta.plate || vehicleNumber }}
    </span>
  </span>
</template>
