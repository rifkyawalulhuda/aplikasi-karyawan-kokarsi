<script setup lang="ts">
const props = defineProps<{
  widgetId: string
  title: string
}>()

const { editing, canMove, move, toggleHidden, isVisible } = useDashboardLayout()

const hidden = computed(() => !isVisible(props.widgetId))
</script>

<template>
  <div
    v-if="editing"
    class="flex shrink-0 items-center gap-0.5 rounded-lg border border-default bg-elevated/40 p-0.5"
  >
    <UButton
      icon="i-lucide-chevron-up"
      color="neutral"
      variant="ghost"
      size="xs"
      :disabled="!canMove(widgetId, -1)"
      :aria-label="`Geser ${title} ke atas`"
      @click="move(widgetId, -1)"
    />
    <UButton
      icon="i-lucide-chevron-down"
      color="neutral"
      variant="ghost"
      size="xs"
      :disabled="!canMove(widgetId, 1)"
      :aria-label="`Geser ${title} ke bawah`"
      @click="move(widgetId, 1)"
    />
    <UButton
      :icon="hidden ? 'i-lucide-eye-off' : 'i-lucide-eye'"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="hidden ? `Tampilkan ${title}` : `Sembunyikan ${title}`"
      :aria-pressed="hidden"
      @click="toggleHidden(widgetId)"
    />
  </div>
</template>
