<script setup lang="ts">
import type { MasterRow, ResourceDef } from './resources'
import { displayValue, primaryColumn } from './resources'

interface SearchGroup {
  resource: ResourceDef
  rows: MasterRow[]
}

const props = defineProps<{
  query: string
  groups: SearchGroup[]
}>()

const emit = defineEmits<{
  open: [resourceKey: string, row: MasterRow]
}>()

const total = computed(() => props.groups.reduce((sum, g) => sum + g.rows.length, 0))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-search" class="size-4" />
      <span>
        <span class="font-medium text-highlighted">{{ total }}</span>
        hasil untuk "{{ query }}" di
        <span class="font-medium text-highlighted">{{ groups.length }}</span> kategori
      </span>
    </div>

    <div
      v-if="total === 0"
      class="rounded-xl border border-dashed border-default px-4 py-12 text-center"
    >
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-elevated">
        <UIcon name="i-lucide-search-x" class="size-5 text-muted" />
      </div>
      <p class="mt-3 text-sm font-medium text-highlighted">
        Tidak ditemukan
      </p>
      <p class="mt-1 text-xs text-muted">
        Tidak ada data yang cocok dengan "{{ query }}".
      </p>
    </div>

    <div
      v-for="group in groups"
      :key="group.resource.key"
      class="rounded-xl border border-default bg-elevated/20"
    >
      <div class="flex items-center gap-2 border-b border-default px-3 py-2">
        <UIcon :name="group.resource.icon" class="size-4 text-muted" />
        <span class="text-sm font-semibold text-highlighted">{{ group.resource.label }}</span>
        <UBadge
          color="neutral"
          variant="subtle"
          size="xs"
          class="tabular-nums"
        >
          {{ group.rows.length }}
        </UBadge>
      </div>
      <ul class="divide-y divide-default">
        <li v-for="row in group.rows" :key="row.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-elevated/50"
            @click="emit('open', group.resource.key, row)"
          >
            <UIcon name="i-lucide-corner-down-right" class="size-3.5 shrink-0 text-dimmed" />
            <span class="min-w-0 flex-1 truncate text-sm text-highlighted">
              {{ displayValue(primaryColumn(group.resource), row) }}
            </span>
            <UIcon name="i-lucide-pencil" class="size-3.5 shrink-0 text-muted" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
