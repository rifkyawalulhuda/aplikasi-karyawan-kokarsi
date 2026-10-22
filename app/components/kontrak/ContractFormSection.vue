<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-default bg-default">
    <header class="flex items-start gap-3 border-b border-default bg-elevated/30 px-4 py-3 sm:px-5">
      <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon :name="icon" class="size-4" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold text-highlighted">
          {{ title }}
        </h3>
        <p v-if="description" class="mt-0.5 text-xs leading-relaxed text-muted">
          {{ description }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <div class="space-y-4 p-4 sm:p-5">
      <slot />
    </div>
  </section>
</template>
