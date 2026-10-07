<script setup lang="ts">
const props = defineProps<{ value: number }>()

const mounted = useMounted()
const animated = useCountUp(() => props.value)

// Sebelum mount, tampilkan nilai final agar SSR & hydration identik.
const display = computed(() => (mounted.value ? animated.value : props.value))
</script>

<template>
  <span class="tabular-nums">{{ display }}</span>
</template>
