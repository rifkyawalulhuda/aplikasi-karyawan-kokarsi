<script setup lang="ts">
const props = withDefaults(defineProps<{
  items: { label: string, value: number, to?: string }[]
  /** Kelas warna bar, dipakai bergiliran. */
  colors?: string[]
  /** `total` → lebar relatif total (tampil %); `max` → relatif nilai terbesar. */
  widthMode?: 'total' | 'max'
  /** Penyebut untuk mode `total` (mis. total karyawan). */
  total?: number
  showPercent?: boolean
  emptyText?: string
}>(), {
  colors: () => ['bg-primary', 'bg-blue-400', 'bg-cyan-500', 'bg-indigo-500'],
  widthMode: 'total',
  total: 0,
  showPercent: true,
  emptyText: 'Belum ada data'
})

const NuxtLinkComp = resolveComponent('NuxtLink')

const denominator = computed(() => {
  if (props.widthMode === 'max') {
    return Math.max(...props.items.map(i => i.value), 1)
  }
  return props.total || 1
})

function width(value: number) {
  return `${(value / denominator.value) * 100}%`
}

function percent(value: number) {
  return props.total > 0 ? Math.round((value / props.total) * 100) : 0
}
</script>

<template>
  <div class="space-y-3.5">
    <template v-if="items.length > 0">
      <component
        :is="item.to ? NuxtLinkComp : 'div'"
        v-for="(item, i) in items"
        :key="item.label"
        :to="item.to"
        class="group/bar block rounded-md px-1 py-0.5 transition-colors duration-150 hover:bg-accented/40"
        :class="item.to ? 'cursor-pointer' : 'cursor-default'"
      >
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="max-w-[60%] truncate text-muted group-hover/bar:text-highlighted">{{ item.label }}</span>
          <div class="flex items-center gap-1.5">
            <span class="font-semibold tabular-nums text-highlighted">{{ item.value }}</span>
            <span v-if="showPercent && widthMode === 'total'" class="tabular-nums text-muted">({{ percent(item.value) }}%)</span>
          </div>
        </div>
        <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-accented">
          <div
            :class="['h-full rounded-full transition-all duration-700 group-hover/bar:brightness-125', colors[i % colors.length]]"
            :style="{ width: width(item.value) }"
          />
        </div>
      </component>
    </template>
    <p v-else class="py-4 text-center text-sm text-muted">
      {{ emptyText }}
    </p>
  </div>
</template>
