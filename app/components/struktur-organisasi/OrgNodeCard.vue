<script setup lang="ts">
import type { OrgNode } from '~/types/org-structure'

const props = defineProps<{
  node: OrgNode
  canManage: boolean
  hasChildren: boolean
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
  select: []
  addChild: []
  edit: []
  remove: []
}>()

const statusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_BERAKHIR: 'warning',
  EXPIRED: 'error',
  TIDAK_AKTIF: 'neutral',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_BERAKHIR: 'Akan Berakhir',
  EXPIRED: 'Expired',
  TIDAK_AKTIF: 'Tidak Aktif',
}

const photo = computed(() => props.node.photoUrl || props.node.employee?.fotoKaryawan || undefined)

const menuItems = computed(() => {
  const items: any[][] = [
    [{ label: 'Lihat Detail', icon: 'i-lucide-eye', onSelect: () => emit('select') }],
  ]
  if (props.canManage) {
    items.push([
      { label: 'Tambah Bawahan', icon: 'i-lucide-user-plus', onSelect: () => emit('addChild') },
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => emit('edit') },
    ])
    items.push([
      { label: 'Hapus', icon: 'i-lucide-trash', color: 'error' as const, onSelect: () => emit('remove') },
    ])
  }
  return items
})
</script>

<template>
  <div
    class="group relative w-56 cursor-pointer rounded-xl border border-default bg-default shadow-sm transition hover:shadow-md hover:border-primary/40"
    role="button"
    tabindex="0"
    :aria-label="`Lihat detail ${node.name}`"
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <!-- Collapse toggle -->
    <button
      v-if="hasChildren"
      type="button"
      class="absolute -bottom-3 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-default bg-default text-muted shadow-sm transition hover:text-primary hover:border-primary"
      :aria-label="collapsed ? 'Tampilkan bawahan' : 'Sembunyikan bawahan'"
      :aria-expanded="!collapsed"
      @click.stop="emit('toggle')"
    >
      <UIcon :name="collapsed ? 'i-lucide-plus' : 'i-lucide-minus'" class="size-3.5" />
    </button>

    <div class="flex items-start gap-3 p-3">
      <UAvatar
        :src="photo"
        :alt="node.name"
        size="lg"
        class="shrink-0"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-highlighted" :title="node.name">{{ node.name }}</p>
        <p class="truncate text-xs text-muted" :title="node.position">{{ node.position }}</p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1">
          <UBadge
            v-if="node.unitUsaha"
            :label="node.unitUsaha"
            color="neutral"
            variant="subtle"
            size="sm"
          />
          <UBadge
            :label="statusLabel[node.status] ?? node.status"
            :color="(statusColor[node.status] ?? 'neutral') as any"
            variant="subtle"
            size="sm"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="shrink-0 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100" @click.stop>
        <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Aksi jabatan"
          />
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>
