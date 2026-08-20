<script setup lang="ts">
interface AttentionItem { id: number; label: string; suffix: string; endDate: string | null }

defineProps<{
  title: string
  count: number
  items?: AttentionItem[]
  icon: string
  colorClass?: string
  to: string
}>()

function formatDate(date: string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-5' }" class="transition-shadow duration-200 hover:shadow-md">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <div :class="['p-2 rounded-lg shrink-0', colorClass ?? 'bg-primary/10 text-primary']">
          <UIcon :name="icon" class="size-4" />
        </div>
        <p class="text-sm font-medium text-highlighted truncate">{{ title }}</p>
      </div>
      <span
        :class="[
          'inline-flex items-center justify-center rounded-full min-w-7 h-7 px-2 text-sm font-bold tabular-nums',
          count > 0 ? 'bg-red-500/10 text-red-500' : 'bg-elevated text-muted',
        ]"
      >{{ count }}</span>
    </div>

    <div v-if="items && items.length > 0" class="space-y-1.5">
      <NuxtLink
        v-for="item in items"
        :key="item.id"
        :to="`${to}?openId=${item.id}`"
        class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-elevated transition-colors group/item"
      >
        <div class="min-w-0">
          <p class="text-highlighted truncate group-hover/item:text-primary">{{ item.label }}</p>
          <p v-if="item.suffix" class="text-muted truncate">{{ item.suffix }}</p>
        </div>
        <span class="text-muted tabular-nums whitespace-nowrap shrink-0">
          {{ formatDate(item.endDate) }}
        </span>
      </NuxtLink>
    </div>
    <div v-else-if="count > 0" class="text-xs text-muted">
      {{ count }} item perlu tindak lanjut — klik "Lihat semua" di bawah.
    </div>
    <div v-else class="text-xs text-muted italic">
      Tidak ada item yang perlu perhatian
    </div>

    <div class="mt-3 pt-2 border-t border-default">
      <NuxtLink
        :to="to"
        class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Lihat semua
        <UIcon name="i-lucide-arrow-right" class="size-3" />
      </NuxtLink>
    </div>
  </UCard>
</template>
