<script setup lang="ts">
import type { ContractTemplate } from '~/types'

const props = defineProps<{
  template: ContractTemplate
  actions: { label: string, icon: string, onSelect?: () => void, disabled?: boolean }[][]
  canManage: boolean
}>()

const emit = defineEmits<{
  manage: []
  toggle: [value: boolean]
  copy: []
  contextmenu: [event: MouseEvent]
}>()

const familyMeta = {
  PKWT: {
    label: 'PKWT',
    icon: 'i-lucide-file-check',
    tone: 'bg-primary/10 text-primary'
  },
  MITRA: {
    label: 'MITRA',
    icon: 'i-lucide-handshake',
    tone: 'bg-warning/10 text-warning'
  }
} as const

const meta = computed(() => familyMeta[props.template.family] ?? familyMeta.PKWT)

const published = computed(() => props.template.versions?.[0] ?? null)
const usage = computed(() => props.template._count?.contracts ?? 0)
const versionCount = computed(() => props.template._count?.versions ?? 0)

/** Bar aksen atas kartu = status penerbitan, karena inilah yang menentukan
 *  template bisa dipakai membuat kontrak. */
const accentClass = computed(() => {
  if (!props.template.isActive) return 'bg-accented'
  return published.value ? 'bg-success' : 'bg-warning'
})

const statusTone = computed(() =>
  published.value
    ? 'border-success/25 bg-success/5'
    : 'border-warning/35 bg-warning/10'
)

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <article
    class="dossier-rise group relative flex flex-col overflow-hidden rounded-xl border border-default bg-default transition-colors hover:border-primary/40"
    :class="template.isActive ? '' : 'opacity-90'"
    @contextmenu.prevent="emit('contextmenu', $event)"
  >
    <div class="h-1 w-full" :class="accentClass" aria-hidden="true" />

    <div class="flex flex-1 flex-col gap-3 p-4">
      <!-- Identitas -->
      <div class="flex items-start gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg" :class="meta.tone">
          <UIcon :name="meta.icon" class="size-4" aria-hidden="true" />
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-highlighted" :title="template.name">
            {{ template.name }}
          </p>
          <div class="mt-0.5 flex items-center gap-1">
            <code class="truncate font-mono text-xs text-muted" :title="template.code">{{ template.code }}</code>
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="ghost"
              square
              class="size-8 shrink-0"
              :aria-label="`Salin kode ${template.code}`"
              @click="emit('copy')"
            />
          </div>
        </div>

        <UDropdownMenu v-if="canManage" :items="actions">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            square
            class="size-8 shrink-0"
            :aria-label="`Aksi lain untuk ${template.name}`"
          />
        </UDropdownMenu>
      </div>

      <!-- Status penerbitan: informasi utama kartu -->
      <div class="rounded-lg border p-3" :class="statusTone">
        <div class="flex items-start gap-2">
          <UIcon
            :name="published ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
            class="mt-0.5 size-4 shrink-0"
            :class="published ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400'"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-highlighted">
              <template v-if="published">
                Versi v{{ published.versionNumber }} terbit
                <UBadge
                  v-if="!template.isActive"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                >
                  Nonaktif
                </UBadge>
              </template>
              <template v-else>
                Belum ada versi terbit
              </template>
            </p>
            <p class="mt-0.5 text-xs text-muted">
              <template v-if="published">
                Diterbitkan {{ formatDate(published.publishedAt) }}<template v-if="published.publishedByName">
                  oleh {{ published.publishedByName }}
                </template>
              </template>
              <template v-else>
                Template ini belum bisa dipakai membuat kontrak.
              </template>
            </p>
          </div>
        </div>

        <UButton
          v-if="!published"
          label="Kelola & terbitkan"
          icon="i-lucide-upload"
          color="warning"
          variant="subtle"
          size="sm"
          class="mt-2 w-full justify-center"
          @click="emit('manage')"
        />
      </div>

      <!-- Metadata sekunder -->
      <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div class="min-w-0">
          <dt class="text-muted">
            Jabatan
          </dt>
          <dd class="mt-0.5 truncate font-medium text-highlighted" :title="template.jobRole?.name ?? '—'">
            {{ template.jobRole?.name ?? '—' }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-muted">
            Dipakai
          </dt>
          <dd class="mt-0.5 font-medium text-highlighted">
            <span class="tabular-nums">{{ usage }}</span>
            <span class="font-normal text-muted"> kontrak</span>
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-muted">
            Tipe kontrak
          </dt>
          <dd class="mt-0.5 truncate font-medium text-highlighted" :title="template.contractType?.name ?? 'Semua tipe'">
            {{ template.contractType?.name ?? 'Semua tipe' }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-muted">
            Versi tersimpan
          </dt>
          <dd class="mt-0.5 font-medium text-highlighted tabular-nums">
            {{ versionCount }}
          </dd>
        </div>
      </dl>

      <p v-if="template.description" class="line-clamp-2 text-xs italic text-muted" :title="template.description">
        {{ template.description }}
      </p>
    </div>

    <!-- Footer aksi -->
    <div class="mt-auto flex items-center justify-between gap-2 border-t border-default bg-elevated/30 px-3 py-2.5">
      <UButton
        :label="published ? 'Kelola konten' : 'Sunting konten'"
        icon="i-lucide-file-pen-line"
        color="primary"
        variant="subtle"
        size="sm"
        @click="emit('manage')"
      />
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted">{{ template.isActive ? 'Aktif' : 'Nonaktif' }}</span>
        <USwitch
          :model-value="template.isActive"
          :disabled="!canManage"

          :aria-label="`${template.isActive ? 'Nonaktifkan' : 'Aktifkan'} template ${template.name}`"
          @update:model-value="emit('toggle', $event)"
        />
      </div>
    </div>
  </article>
</template>
