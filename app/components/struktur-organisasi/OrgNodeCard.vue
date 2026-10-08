<script setup lang="ts">
import type { OrgNode, OrgChartDisplay } from '~/types/org-structure'

const props = withDefaults(defineProps<{
  node: OrgNode
  canManage: boolean
  hasChildren: boolean
  collapsed: boolean
  display?: OrgChartDisplay
  highlighted?: boolean
}>(), {
  display: () => ({ photo: true, position: true, unitUsaha: true, status: true }),
  highlighted: false,
})

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
    :class="highlighted ? 'bg-primary/5 ring-2 ring-primary/40' : ''"
    role="button"
    tabindex="0"
    :aria-label="`Lihat detail ${node.name}`"
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <!-- Collapse toggle (hit-area diperbesar untuk sentuh) -->
    <button
      v-if="hasChildren"
      type="button"
      class="absolute -bottom-3.5 left-1/2 z-10 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-default bg-default text-muted shadow-sm transition before:absolute before:-inset-2 before:content-[''] hover:text-primary hover:border-primary"
      :aria-label="collapsed ? 'Tampilkan bawahan' : 'Sembunyikan bawahan'"
      :aria-expanded="!collapsed"
      @click.stop="emit('toggle')"
    >
      <UIcon :name="collapsed ? 'i-lucide-plus' : 'i-lucide-minus'" class="size-4" />
    </button>

    <!-- Actions (selalu tampil agar bisa diakses via sentuh/keyboard) -->
    <div class="absolute right-1 top-1 z-10" @click.stop>
      <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Aksi jabatan"
        />
      </UDropdownMenu>
    </div>

    <!-- Konten terpusat -->
    <div class="flex flex-col items-center gap-2 p-3 text-center">
      <UAvatar
        v-if="display.photo"
        :src="photo"
        :alt="node.name"
        size="lg"
        class="shrink-0"
      />
      <div class="min-w-0 w-full">
        <p class="truncate text-sm font-semibold text-highlighted" :title="node.name">{{ node.name }}</p>
        <p v-if="display.position" class="truncate text-xs text-muted" :title="node.position">{{ node.position }}</p>
      </div>

      <!-- Metadata (unit usaha & status) -->
      <div
        v-if="display.status || (display.unitUsaha && node.unitUsaha)"
        class="flex flex-wrap items-center justify-center gap-1"
      >
        <UBadge
          v-if="display.unitUsaha && node.unitUsaha"
          :label="node.unitUsaha"
          color="neutral"
          variant="subtle"
          size="sm"
        />
        <UBadge
          v-if="display.status"
          :label="statusLabel[node.status] ?? node.status"
          :color="(statusColor[node.status] ?? 'neutral') as any"
          variant="subtle"
          size="sm"
        />
      </div>
    </div>
  </div>
</template>
