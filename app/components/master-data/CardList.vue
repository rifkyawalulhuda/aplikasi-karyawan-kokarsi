<script setup lang="ts">
import type { MasterRow, ResourceDef } from './resources'
import { displayValue, primaryColumn } from './resources'

const props = defineProps<{
  resource: ResourceDef
  rows: MasterRow[]
  selectedIds: number[]
}>()

const emit = defineEmits<{
  edit: [row: MasterRow]
  delete: [row: MasterRow]
  toggle: [row: MasterRow]
}>()

const primary = computed(() => primaryColumn(props.resource))
const secondaryColumns = computed(() => props.resource.listColumns.slice(1))

function isSelected(row: MasterRow): boolean {
  return props.selectedIds.includes(row.id)
}
</script>

<template>
  <div class="space-y-2 md:hidden">
    <div
      v-for="row in rows"
      :key="row.id"
      class="rounded-xl border border-default bg-elevated/20 p-3 transition-colors"
      :class="isSelected(row) ? 'border-primary/50 bg-primary/5' : ''"
    >
      <div class="flex items-start gap-3">
        <UCheckbox
          :model-value="isSelected(row)"
          class="mt-0.5"
          :aria-label="`Pilih ${String(row.name)}`"
          @update:model-value="emit('toggle', row)"
        />
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          @click="emit('edit', row)"
        >
          <p class="truncate text-sm font-semibold text-highlighted">
            {{ displayValue(primary, row) }}
          </p>
          <dl class="mt-1.5 space-y-0.5">
            <div
              v-for="col in secondaryColumns"
              :key="col.key"
              class="flex items-baseline gap-2 text-xs"
            >
              <dt class="shrink-0 text-muted">
                {{ col.label }}
              </dt>
              <dd class="min-w-0 flex-1 truncate text-right text-default">
                <UBadge
                  v-if="col.variant === 'badge' && row[col.key]"
                  :color="(col.badgeColorMap?.[String(row[col.key])] as any) ?? 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ displayValue(col, row) }}
                </UBadge>
                <span v-else>{{ displayValue(col, row) }}</span>
              </dd>
            </div>
          </dl>
        </button>
        <MasterDataRowActions
          @edit="emit('edit', row)"
          @delete="emit('delete', row)"
        />
      </div>
    </div>

    <div
      v-if="rows.length === 0"
      class="rounded-xl border border-dashed border-default px-4 py-10 text-center"
    >
      <UIcon :name="resource.icon" class="mx-auto size-6 text-muted" />
      <p class="mt-2 text-sm font-medium text-highlighted">
        Belum ada data
      </p>
      <p class="mt-0.5 text-xs text-muted">
        Tambahkan {{ resource.singular }} pertama Anda.
      </p>
    </div>
  </div>
</template>
