<script setup lang="ts">
import type { OrgNode } from '~/types/org-structure'

const props = defineProps<{
  open: boolean
  node: OrgNode | null
  canManage: boolean
  allNodes?: OrgNode[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'edit': [node: OrgNode]
  'add-child': [node: OrgNode]
  'remove': [node: OrgNode]
  'navigate': [node: OrgNode]
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

const statusRingClass: Record<string, string> = {
  AKTIF: 'bg-success/10 text-success ring-success/25',
  AKAN_BERAKHIR: 'bg-warning/10 text-warning ring-warning/25',
  EXPIRED: 'bg-error/10 text-error ring-error/25',
  TIDAK_AKTIF: 'bg-elevated text-muted ring-default',
}

const statusIcon: Record<string, string> = {
  AKTIF: 'i-lucide-shield-check',
  AKAN_BERAKHIR: 'i-lucide-clock',
  EXPIRED: 'i-lucide-shield-x',
  TIDAK_AKTIF: 'i-lucide-minus-circle',
}

const DAY_MS = 86_400_000

const photo = computed(() => props.node?.photoUrl || props.node?.employee?.fotoKaryawan || undefined)

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Relasi hierarki ──────────────────────────────────────────────────────────
const parent = computed(() => {
  const n = props.node
  if (!n?.parentId) return null
  return (props.allNodes ?? []).find(x => x.id === n.parentId) ?? null
})

const children = computed(() => {
  const n = props.node
  if (!n) return []
  return (props.allNodes ?? []).filter(x => x.parentId === n.id)
})

// ── Status masa jabatan (signature card) ─────────────────────────────────────
const period = computed(() => {
  const n = props.node
  if (!n) return null
  if (!n.endDate) return { kind: 'open' as const }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(n.endDate)
  const endTime = end.getTime()
  const daysLeft = Math.ceil((endTime - today.getTime()) / DAY_MS)

  let percent = 100
  if (n.startDate) {
    const start = new Date(n.startDate).getTime()
    const total = endTime - start
    percent = total > 0
      ? Math.min(100, Math.max(0, Math.round(((today.getTime() - start) / total) * 100)))
      : 100
  }
  return { kind: 'range' as const, daysLeft, percent }
})

const daysText = computed(() => {
  const p = period.value
  if (!p || p.kind !== 'range') return ''
  if (p.daysLeft < 0) return 'Masa jabatan telah berakhir'
  if (p.daysLeft === 0) return 'Berakhir hari ini'
  return `Sisa ${p.daysLeft.toLocaleString('id-ID')} hari`
})

const periodSubtext = computed(() => {
  const n = props.node
  if (!n) return ''
  const start = n.startDate ? formatDate(n.startDate) : null
  const end = n.endDate ? formatDate(n.endDate) : null
  if (!start && !end) return 'Tanpa tanggal mulai & selesai'
  if (start && end) return `${start} — ${end}`
  return start ? `Mulai ${start}` : `Sampai ${end}`
})

const barClass = computed(() => {
  switch (props.node?.status) {
    case 'EXPIRED': return 'bg-error'
    case 'AKAN_BERAKHIR': return 'bg-warning'
    case 'TIDAK_AKTIF': return 'bg-muted'
    default: return 'bg-success'
  }
})

// ── Info terkelompok ─────────────────────────────────────────────────────────
const skRows = computed(() => {
  const n = props.node
  if (!n) return []
  return [
    { label: 'Nomor SK', value: n.skNumber || '-', mono: true },
    { label: 'Tanggal SK', value: formatDate(n.skDate) },
  ]
})

const positionRows = computed(() => {
  const n = props.node
  if (!n) return []
  return [
    { label: 'Unit Usaha / Divisi', value: n.unitUsaha || '-' },
    { label: 'Urutan Tampil', value: String(n.sortOrder ?? 0) },
  ]
})

const hierarchyLabel = computed(() => (props.node?.parentId ? 'Jabatan bawahan' : 'Jabatan tertinggi'))
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ content: 'w-full sm:max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <!-- Header: hero identitas -->
    <template #header>
      <div v-if="node" class="flex w-full min-w-0 items-start gap-3.5">
        <div
          class="shrink-0 rounded-full p-0.5 ring-2"
          :class="statusRingClass[node.status] ?? 'ring-default'"
        >
          <UAvatar
            :src="photo"
            :alt="node.name"
            :icon="!photo ? 'i-lucide-user-round' : undefined"
            size="2xl"
          />
        </div>
        <div class="min-w-0 flex-1 pt-0.5">
          <h2 class="truncate text-lg font-semibold text-highlighted">{{ node.name }}</h2>
          <p class="truncate text-sm text-muted">{{ node.position }}</p>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <UBadge
              :label="statusLabel[node.status] ?? node.status"
              :color="(statusColor[node.status] ?? 'neutral') as any"
              :icon="statusIcon[node.status]"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="node.unitUsaha"
              :label="node.unitUsaha"
              icon="i-lucide-building-2"
              color="neutral"
              variant="subtle"
              size="sm"
            />
          </div>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="node" class="space-y-5">
        <!-- Signature: status & progress masa jabatan -->
        <div class="rounded-xl border border-default bg-elevated/30 p-4">
          <div class="flex items-center gap-4">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-full ring-1"
              :class="statusRingClass[node.status] ?? 'bg-elevated text-muted ring-default'"
            >
              <UIcon :name="statusIcon[node.status] ?? 'i-lucide-briefcase'" class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium uppercase tracking-wide text-muted">Status Masa Jabatan</p>
              <p
                class="text-base font-semibold leading-tight"
                :class="node.status === 'EXPIRED' ? 'text-error' : 'text-highlighted'"
              >
                {{ statusLabel[node.status] ?? node.status }}
              </p>
              <p v-if="period?.kind === 'range'" class="text-sm text-muted">{{ daysText }}</p>
            </div>
          </div>

          <!-- Progress bar (hanya jika ada rentang masa jabatan) -->
          <div v-if="period?.kind === 'range'" class="mt-3.5">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="barClass"
                :style="{ width: `${period.percent}%` }"
              />
            </div>
            <p class="mt-1.5 text-xs text-muted">{{ periodSubtext }}</p>
          </div>
          <p v-else class="mt-3.5 text-xs text-muted">{{ periodSubtext }}</p>
        </div>

        <!-- Relasi hierarki -->
        <div class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">Hierarki</p>

          <!-- Atasan -->
          <div class="rounded-xl border border-default bg-default p-3">
            <p class="mb-1.5 text-xs font-medium text-muted">Atasan Langsung</p>
            <button
              v-if="parent"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-lg border border-default bg-elevated/40 p-2 text-left transition hover:border-primary/40 hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              @click="emit('navigate', parent)"
            >
              <UAvatar :src="parent.photoUrl || parent.employee?.fotoKaryawan || undefined" :alt="parent.name" size="sm" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-highlighted">{{ parent.name }}</span>
                <span class="block truncate text-xs text-muted">{{ parent.position }}</span>
              </span>
              <UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-muted" />
            </button>
            <div v-else class="flex items-center gap-2 rounded-lg border border-dashed border-default px-2.5 py-2 text-sm text-muted">
              <UIcon name="i-lucide-crown" class="size-4 shrink-0" />
              Jabatan tertinggi — tidak memiliki atasan
            </div>
          </div>

          <!-- Bawahan langsung -->
          <div class="rounded-xl border border-default bg-default p-3">
            <div class="mb-1.5 flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-muted">Bawahan Langsung</p>
              <UBadge
                v-if="children.length"
                :label="`${children.length}`"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>

            <ul v-if="children.length" class="space-y-1.5">
              <li v-for="child in children" :key="child.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-2.5 rounded-lg border border-default bg-elevated/40 p-2 text-left transition hover:border-primary/40 hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  @click="emit('navigate', child)"
                >
                  <UAvatar :src="child.photoUrl || child.employee?.fotoKaryawan || undefined" :alt="child.name" size="sm" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-highlighted">{{ child.name }}</span>
                    <span class="block truncate text-xs text-muted">{{ child.position }}</span>
                  </span>
                  <UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-muted" />
                </button>
              </li>
            </ul>
            <p v-else class="rounded-lg border border-dashed border-default px-2.5 py-2 text-sm text-muted">
              Belum ada bawahan langsung
            </p>
          </div>
        </div>

        <!-- Grid info: Jabatan & SK -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-default bg-default p-3.5">
            <p class="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              <UIcon name="i-lucide-briefcase" class="size-3.5" /> Jabatan
            </p>
            <dl class="space-y-2.5">
              <div v-for="row in positionRows" :key="row.label">
                <dt class="text-xs text-muted">{{ row.label }}</dt>
                <dd class="text-sm text-highlighted break-words">{{ row.value }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">Level</dt>
                <dd class="text-sm text-highlighted">{{ hierarchyLabel }}</dd>
              </div>
            </dl>
          </div>

          <div class="rounded-xl border border-default bg-default p-3.5">
            <p class="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              <UIcon name="i-lucide-file-badge" class="size-3.5" /> Surat Keputusan
            </p>
            <dl class="space-y-2.5">
              <div v-for="row in skRows" :key="row.label">
                <dt class="text-xs text-muted">{{ row.label }}</dt>
                <dd
                  class="text-sm text-highlighted break-words"
                  :class="row.mono ? 'font-mono' : ''"
                >
                  {{ row.value }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Karyawan tertaut -->
        <div v-if="node.employee" class="rounded-xl border border-default bg-default p-3.5">
          <p class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-link" class="size-3.5" /> Terhubung Data Karyawan
          </p>
          <NuxtLink
            :to="`/karyawan/${node.employee.id}`"
            class="flex items-center gap-2.5 rounded-lg border border-default bg-elevated/40 p-2 transition hover:border-primary/40 hover:bg-elevated/70"
          >
            <UAvatar
              :src="node.employee.fotoKaryawan || undefined"
              :alt="node.employee.fullName"
              size="sm"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-highlighted">{{ node.employee.fullName }}</span>
              <span class="block truncate text-xs text-muted font-mono">{{ node.employee.employeeNo }}</span>
            </span>
            <UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-muted" />
          </NuxtLink>
        </div>

        <!-- Keterangan -->
        <div v-if="node.notes">
          <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Keterangan</p>
          <p class="whitespace-pre-wrap rounded-xl border border-default bg-default p-3.5 text-sm text-highlighted">{{ node.notes }}</p>
        </div>

        <!-- Meta -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-default pt-3 text-xs text-muted">
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-plus-circle" class="size-3.5" />
            Dibuat {{ formatDateTime(node.createdAt) }}
          </span>
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-refresh-cw" class="size-3.5" />
            Diperbarui {{ formatDateTime(node.updatedAt) }}
          </span>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="node" class="flex w-full items-center gap-2">
        <UButton
          v-if="canManage"
          label="Hapus"
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          @click="emit('remove', node)"
        />
        <div class="ml-auto flex items-center gap-2">
          <UButton
            v-if="canManage"
            label="Tambah Bawahan"
            icon="i-lucide-user-plus"
            color="neutral"
            variant="subtle"
            @click="emit('add-child', node)"
          />
          <UButton
            v-if="canManage"
            label="Edit Jabatan"
            icon="i-lucide-pencil"
            color="primary"
            @click="emit('edit', node)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
