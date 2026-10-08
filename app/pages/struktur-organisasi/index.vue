<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { h } from 'vue'
import type { OrgNode, OrgPeriod } from '~/types/org-structure'

const UAvatar = resolveComponent('UAvatar')
const UBadge = resolveComponent('UBadge')

const toast = useToast()
const auth = useAuthStore()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { exportOrgStructureExcel } = useExport()

const canManage = computed(() => auth.canManageMasterData)

// ── State ────────────────────────────────────────────────────────────────────
const view = ref<'chart' | 'table'>('chart')
const searchQuery = ref('')
const fetchStatus = ref<'pending' | 'success' | 'error'>('pending')

const { data: periodsRes, refresh: refreshPeriods } = await useFetch<OrgPeriod[]>('/api/org-structure/periods', {
  credentials: 'include',
  default: () => [],
})

const selectedPeriodId = ref<number | undefined>(undefined)

watch(periodsRes, (list) => {
  if (selectedPeriodId.value != null) return
  if (!list || !list.length) return
  const active = list.find(p => p.isActive)
  selectedPeriodId.value = active?.id ?? list[0]!.id
}, { immediate: true })

const selectedPeriod = computed(() => (periodsRes.value ?? []).find(p => p.id === selectedPeriodId.value) ?? null)

const flatNodes = ref<OrgNode[]>([])

async function fetchNodes() {
  if (selectedPeriodId.value == null) {
    flatNodes.value = []
    return
  }
  fetchStatus.value = 'pending'
  try {
    flatNodes.value = await $fetch<OrgNode[]>('/api/org-structure/nodes', {
      query: { periodId: selectedPeriodId.value },
      credentials: 'include',
    })
    fetchStatus.value = 'success'
  } catch {
    fetchStatus.value = 'error'
  }
}

watch(selectedPeriodId, () => { fetchNodes() })
await fetchNodes()

function refresh() {
  fetchNodes()
}

// ── Build tree from flat list ────────────────────────────────────────────────
const tree = computed<OrgNode[]>(() => {
  const map = new Map<number, OrgNode>()
  const roots: OrgNode[] = []
  for (const n of flatNodes.value) map.set(n.id, { ...n, children: [] })
  for (const n of flatNodes.value) {
    const copy = map.get(n.id)!
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children!.push(copy)
    else roots.push(copy)
  }
  const sortRec = (list: OrgNode[]) => {
    list.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, 'id'))
    for (const item of list) sortRec(item.children ?? [])
  }
  sortRec(roots)
  return roots
})

const nodeNameById = computed(() => {
  const map = new Map<number, OrgNode>()
  for (const n of flatNodes.value) map.set(n.id, n)
  return map
})

function parentLabel(node: OrgNode) {
  if (!node.parentId) return '—'
  const parent = nodeNameById.value.get(node.parentId)
  return parent ? `${parent.name} (${parent.position})` : '—'
}

// ── Filters ──────────────────────────────────────────────────────────────────
const filteredNodes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return flatNodes.value
  return flatNodes.value.filter(n =>
    n.name.toLowerCase().includes(q)
    || n.position.toLowerCase().includes(q)
    || (n.unitUsaha ?? '').toLowerCase().includes(q),
  )
})

// ── Modals ───────────────────────────────────────────────────────────────────
const nodeModalOpen = ref(false)
const nodeModalMode = ref<'add' | 'edit' | 'add-child'>('add')
const nodeModalTarget = ref<OrgNode | null>(null)
const nodeModalParent = ref<OrgNode | null>(null)

const periodModalOpen = ref(false)
const periodModalMode = ref<'add' | 'edit'>('add')
const periodModalTarget = ref<OrgPeriod | null>(null)

const detailOpen = ref(false)
const detailTarget = ref<OrgNode | null>(null)

function openAddRoot() {
  if (selectedPeriodId.value == null) {
    toast.add({ title: 'Buat periode terlebih dahulu', color: 'warning' })
    return
  }
  nodeModalMode.value = 'add'
  nodeModalTarget.value = null
  nodeModalParent.value = null
  nodeModalOpen.value = true
}

function openAddChild(node: OrgNode) {
  nodeModalMode.value = 'add-child'
  nodeModalTarget.value = null
  nodeModalParent.value = node
  detailOpen.value = false
  nodeModalOpen.value = true
}

function openEdit(node: OrgNode) {
  nodeModalMode.value = 'edit'
  nodeModalTarget.value = node
  nodeModalParent.value = null
  detailOpen.value = false
  nodeModalOpen.value = true
}

function openDetail(node: OrgNode) {
  // Selalu resolusi dari data terbaru agar drawer tidak menampilkan node basi
  detailTarget.value = flatNodes.value.find(n => n.id === node.id) ?? node
  detailOpen.value = true
}

function openAddPeriod() {
  periodModalMode.value = 'add'
  periodModalTarget.value = null
  periodModalOpen.value = true
}

function openEditPeriod() {
  if (!selectedPeriod.value) return
  periodModalMode.value = 'edit'
  periodModalTarget.value = selectedPeriod.value
  periodModalOpen.value = true
}

async function onPeriodSaved() {
  await refreshPeriods()
}

// ── Delete ───────────────────────────────────────────────────────────────────
function confirmDeleteNode(node: OrgNode) {
  confirmDeleteToast({
    title: 'Hapus jabatan?',
    description: `"${node.name} — ${node.position}" akan dihapus dari struktur.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      try {
        await $fetch(`/api/org-structure/nodes/${node.id}`, { method: 'DELETE', credentials: 'include' })
        detailOpen.value = false
        await fetchNodes()
        toast.add({ title: 'Jabatan dihapus', color: 'success' })
      } catch (e: any) {
        toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
      }
    },
  })
}

function confirmDeletePeriod() {
  if (!selectedPeriod.value) return
  const period = selectedPeriod.value
  confirmDeleteToast({
    title: 'Hapus periode?',
    description: `Periode "${period.name}" beserta ${period._count?.nodes ?? 0} jabatan akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      try {
        await $fetch(`/api/org-structure/periods/${period.id}`, { method: 'DELETE', credentials: 'include' })
        selectedPeriodId.value = undefined
        await refreshPeriods()
        if (periodsRes.value?.length) {
          selectedPeriodId.value = periodsRes.value[0]!.id
        } else {
          flatNodes.value = []
        }
        toast.add({ title: 'Periode dihapus', color: 'success' })
      } catch (e: any) {
        toast.add({ title: 'Gagal menghapus periode', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
      }
    },
  })
}

// ── Drag-drop move ───────────────────────────────────────────────────────────
async function onMove(payload: { id: number; parentId: number | null; sortOrder: number }) {
  try {
    await $fetch(`/api/org-structure/nodes/${payload.id}/move`, {
      method: 'POST',
      body: { parentId: payload.parentId, sortOrder: payload.sortOrder },
      credentials: 'include',
    })
    await fetchNodes()
    toast.add({ title: 'Struktur diperbarui', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Gagal memindahkan jabatan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  }
}

// ── Period select items ──────────────────────────────────────────────────────
const periodItems = computed(() =>
  (periodsRes.value ?? []).map(p => ({
    label: `${p.name}${p.isActive ? ' • Aktif' : ''}`,
    value: p.id,
  })),
)

// ── Table columns ────────────────────────────────────────────────────────────
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

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const columns: TableColumn<OrgNode>[] = [
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }: { row: Row<OrgNode> }) => {
      const n = row.original
      return h('div', { class: 'flex items-center gap-2.5 min-w-0' }, [
        h(UAvatar, { src: n.photoUrl || n.employee?.fotoKaryawan || undefined, alt: n.name, size: 'sm' }),
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'truncate text-sm font-medium text-highlighted' }, n.name),
          n.employee ? h('p', { class: 'truncate text-xs text-muted' }, n.employee.employeeNo) : null,
        ]),
      ])
    },
  },
  { accessorKey: 'position', header: 'Jabatan' },
  {
    accessorKey: 'unitUsaha',
    header: 'Unit Usaha',
    cell: ({ row }: { row: Row<OrgNode> }) => h('span', { class: 'text-sm text-muted' }, row.original.unitUsaha || '-'),
  },
  {
    id: 'atasan',
    header: 'Atasan',
    cell: ({ row }: { row: Row<OrgNode> }) => h('span', { class: 'text-sm text-muted' }, parentLabel(row.original)),
  },
  {
    id: 'masaJabatan',
    header: 'Masa Jabatan',
    cell: ({ row }: { row: Row<OrgNode> }) => {
      const n = row.original
      if (!n.startDate && !n.endDate) return h('span', { class: 'text-sm text-muted' }, '-')
      return h('span', { class: 'text-sm text-muted whitespace-nowrap' }, `${formatDate(n.startDate)} — ${formatDate(n.endDate)}`)
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: Row<OrgNode> }) => h(UBadge, {
      label: statusLabel[row.original.status] ?? row.original.status,
      color: statusColor[row.original.status] ?? 'neutral',
      variant: 'subtle',
      size: 'sm',
    }),
  },
]

// ── Export ───────────────────────────────────────────────────────────────────
function handleExport() {
  const ok = exportOrgStructureExcel(flatNodes.value, selectedPeriod.value?.name)
  if (ok) toast.add({ title: 'Export berhasil', color: 'success' })
  else toast.add({ title: 'Tidak ada data', color: 'warning' })
}

// ── Print ────────────────────────────────────────────────────────────────────
function buildPrintNodes(nodes: OrgNode[]): string {
  if (!nodes.length) return ''
  return `<ul>${nodes.map(n => `
    <li>
      <div class="node">
        <div class="nm">${escapeHtml(n.name)}</div>
        <div class="pos">${escapeHtml(n.position)}</div>
        ${n.unitUsaha ? `<div class="unit">${escapeHtml(n.unitUsaha)}</div>` : ''}
      </div>
      ${buildPrintNodes(n.children ?? [])}
    </li>`).join('')}</ul>`
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function printChart() {
  const title = selectedPeriod.value?.name ?? 'Struktur Organisasi'
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;color:#111}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#666;font-size:13px;margin-bottom:24px}
    ul{list-style:none;padding-left:0;display:flex;justify-content:center;gap:16px;flex-wrap:nowrap;position:relative;margin:0}
    li{position:relative;padding:20px 8px 0;display:flex;flex-direction:column;align-items:center}
    ul ul{margin-top:0}
    .node{border:1px solid #ddd;border-radius:10px;padding:10px 14px;min-width:150px;text-align:center;background:#fff}
    .nm{font-weight:600;font-size:13px}
    .pos{font-size:12px;color:#444}
    .unit{font-size:11px;color:#777;margin-top:2px}
    li::before,li::after{content:'';position:absolute;top:0;right:50%;border-top:1px solid #ccc;width:50%;height:20px}
    li::after{right:auto;left:50%;border-left:1px solid #ccc}
    li:only-child::after,li:only-child::before{display:none}
    li:first-child::before,li:last-child::after{border:0 none}
    @media print{body{padding:0}}
  </style></head><body>
    <h1>Struktur Organisasi</h1>
    <div class="sub">${escapeHtml(title)}</div>
    ${buildPrintNodes(tree.value)}
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}
</script>

<template>
  <UDashboardPanel id="struktur-organisasi">
    <template #header>
      <UDashboardNavbar title="Struktur Organisasi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Cetak"
            icon="i-lucide-printer"
            color="neutral"
            variant="subtle"
            @click="printChart"
          />
          <UButton
            label="Export"
            icon="i-lucide-download"
            color="neutral"
            variant="subtle"
            @click="handleExport"
          />
          <UButton
            v-if="canManage"
            label="Tambah Jabatan"
            icon="i-lucide-plus"
            color="primary"
            @click="openAddRoot"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Toolbar periode -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <USelectMenu
          v-model="selectedPeriodId"
          :items="periodItems"
          value-key="value"
          placeholder="Pilih periode..."
          icon="i-lucide-calendar-range"
          class="min-w-64"
        />
        <UButton
          v-if="canManage"
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          label="Periode"
          @click="openAddPeriod"
        />
        <UDropdownMenu
          v-if="canManage && selectedPeriod"
          :items="[[
            { label: 'Edit Periode', icon: 'i-lucide-pencil', onSelect: openEditPeriod },
            { label: 'Hapus Periode', icon: 'i-lucide-trash', color: 'error', onSelect: confirmDeletePeriod },
          ]]"
          :content="{ align: 'start' }"
        >
          <UButton icon="i-lucide-settings-2" color="neutral" variant="ghost" aria-label="Kelola periode" />
        </UDropdownMenu>

        <div class="ml-auto flex items-center gap-2">
          <UInput
            v-if="view === 'table'"
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Cari nama, jabatan, unit..."
            class="max-w-xs"
          />
          <UTabs
            v-model="view"
            :items="[
              { label: 'Bagan', value: 'chart', icon: 'i-lucide-network' },
              { label: 'Tabel', value: 'table', icon: 'i-lucide-list' },
            ]"
            :content="false"
            size="sm"
          />
        </div>
      </div>

      <div v-if="selectedPeriod" class="mb-3 text-sm text-muted">
        {{ selectedPeriod.name }} · {{ flatNodes.length }} jabatan
      </div>

      <!-- Empty: belum ada periode -->
      <div
        v-if="!periodsRes || periodsRes.length === 0"
        class="flex flex-col items-center gap-3 py-20 text-muted"
      >
        <UIcon name="i-lucide-calendar-plus" class="size-12 opacity-40" />
        <p class="text-sm">Belum ada periode kepengurusan</p>
        <UButton v-if="canManage" label="Buat Periode" icon="i-lucide-plus" color="primary" @click="openAddPeriod" />
      </div>

      <template v-else>
        <!-- Bagan -->
        <div v-show="view === 'chart'">
          <div v-if="fetchStatus === 'pending'" class="flex justify-center py-16">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
          </div>
          <StrukturOrganisasiOrgChartCanvas
            v-else
            :nodes="tree"
            :can-manage="canManage"
            :flat-nodes="flatNodes"
            @move="onMove"
            @select="openDetail"
            @add-child="openAddChild"
            @edit="openEdit"
            @remove="confirmDeleteNode"
          />
        </div>

        <!-- Tabel -->
        <div v-show="view === 'table'">
          <UTable
            :data="filteredNodes"
            :columns="columns"
            :loading="fetchStatus === 'pending'"
            class="shrink-0"
            :on-select="(_e: any, row: any) => openDetail(row.original)"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:hover:bg-elevated/40 [&>tr]:transition-colors',
              th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default',
              separator: 'h-0',
            }"
          >
            <template #empty>
              <div class="flex flex-col items-center gap-2 py-12 text-muted">
                <UIcon name="i-lucide-network" class="size-10 opacity-40" />
                <p class="text-sm">Belum ada jabatan pada periode ini</p>
              </div>
            </template>
          </UTable>
          <div class="border-t border-default pt-4 mt-4 text-sm text-muted">
            {{ filteredNodes.length }} jabatan
          </div>
        </div>
      </template>
    </template>
  </UDashboardPanel>

  <!-- Node modal -->
  <StrukturOrganisasiNodeFormModal
    v-if="selectedPeriodId != null"
    v-model:open="nodeModalOpen"
    :mode="nodeModalMode"
    :period-id="selectedPeriodId"
    :initial-data="nodeModalTarget"
    :parent-node="nodeModalParent"
    :all-nodes="flatNodes"
    @saved="refresh"
  />

  <!-- Period modal -->
  <StrukturOrganisasiPeriodModal
    v-model:open="periodModalOpen"
    :mode="periodModalMode"
    :initial-data="periodModalTarget"
    @saved="onPeriodSaved"
  />

  <!-- Detail drawer -->
  <StrukturOrganisasiNodeDetailDrawer
    v-if="detailTarget"
    v-model:open="detailOpen"
    :node="detailTarget"
    :can-manage="canManage"
    :all-nodes="flatNodes"
    @edit="openEdit"
    @add-child="openAddChild"
    @remove="confirmDeleteNode"
    @navigate="openDetail"
    @update:open="(v: boolean) => { detailOpen = v; if (!v) detailTarget = null }"
  />
</template>
