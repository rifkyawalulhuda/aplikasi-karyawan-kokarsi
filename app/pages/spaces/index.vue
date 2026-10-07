<script setup lang="ts">
import type { Space } from '~/types/space'
import { avatarColor, colorClass, initials } from '~/components/spaces/board-meta'

definePageMeta({ layout: 'default' })

const toast = useToast()
const { data: spaces, refresh, pending } = await useFetch<Space[]>('/api/spaces', { credentials: 'include' })

const { data: usersRes } = useFetch<{ id: number, name: string }[]>('/api/users/pengurus', {
  credentials: 'include',
  lazy: true
})

const userMap = computed<Record<number, string>>(() =>
  Object.fromEntries((usersRes.value ?? []).map(u => [u.id, u.name]))
)

const createOpen = ref(false)
const search = ref('')

const filteredSpaces = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = spaces.value ?? []
  if (!term) return list
  return list.filter(s =>
    s.name.toLowerCase().includes(term) || (s.description ?? '').toLowerCase().includes(term)
  )
})

function onSpaceCreated() {
  createOpen.value = false
  refresh()
  toast.add({ title: 'Space berhasil dibuat', color: 'success' })
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function memberAvatars(space: Space) {
  return space.memberIds.slice(0, 3).map(id => ({
    id,
    name: userMap.value[id] ?? `User ${id}`,
    color: avatarColor(id),
    initials: initials(userMap.value[id], id)
  }))
}
</script>

<template>
  <UDashboardPanel id="spaces">
    <template #header>
      <UDashboardNavbar title="Space">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Buat Space"
            icon="i-lucide-plus"
            color="primary"
            @click="createOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <!-- Pencarian -->
        <div v-if="spaces?.length" class="flex items-center gap-3">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Cari Space…"
            class="w-full sm:w-72"
            aria-label="Cari Space"
          />
          <span class="ml-auto shrink-0 text-sm text-muted">
            {{ filteredSpaces.length }} Space
          </span>
        </div>

        <!-- Loading skeleton -->
        <div v-if="pending" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div v-for="i in 4" :key="i" class="rounded-xl border border-default p-5">
            <div class="flex items-start gap-3">
              <div class="size-11 animate-pulse rounded-lg bg-accented" />
              <div class="flex-1 space-y-2">
                <div class="h-4 w-2/3 animate-pulse rounded bg-accented" />
                <div class="h-3 w-full animate-pulse rounded bg-accented" />
              </div>
            </div>
            <div class="mt-4 h-3 w-1/3 animate-pulse rounded bg-accented" />
          </div>
        </div>

        <!-- Empty: belum ada Space -->
        <div v-else-if="!spaces?.length" class="flex h-72 flex-col items-center justify-center gap-4 text-center">
          <div class="rounded-full bg-elevated p-4">
            <UIcon name="i-lucide-kanban" class="size-10 text-dimmed" />
          </div>
          <div>
            <p class="font-semibold text-highlighted">
              Belum ada Space
            </p>
            <p class="mt-1 text-sm text-muted">
              Buat Space pertama untuk mulai berkolaborasi
            </p>
          </div>
          <UButton
            label="Buat Space"
            icon="i-lucide-plus"
            color="primary"
            @click="createOpen = true"
          />
        </div>

        <!-- Empty: hasil pencarian kosong -->
        <div
          v-else-if="!filteredSpaces.length"
          class="flex h-48 flex-col items-center justify-center gap-2 text-center"
        >
          <UIcon name="i-lucide-search-x" class="size-8 text-dimmed" />
          <p class="text-sm text-muted">
            Tidak ada Space yang cocok dengan "{{ search }}"
          </p>
        </div>

        <!-- Grid Space -->
        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <NuxtLink
            v-for="space in filteredSpaces"
            :key="space.id"
            :to="`/spaces/${space.id}`"
            class="group relative flex flex-col overflow-hidden rounded-xl border border-default bg-default p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/5"
          >
            <!-- Garis warna atas -->
            <div class="absolute inset-x-0 top-0 h-1 opacity-70" :class="colorClass(space.color)" />

            <div class="flex items-start gap-3">
              <div
                class="flex size-11 shrink-0 items-center justify-center rounded-lg text-xl ring-1 ring-inset ring-black/5"
                :class="`${colorClass(space.color)}/10`"
              >
                {{ space.icon ?? '📋' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-highlighted transition-colors group-hover:text-primary">
                  {{ space.name }}
                </p>
                <p class="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">
                  {{ space.description || 'Tanpa deskripsi' }}
                </p>
              </div>
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-4 shrink-0 text-dimmed opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-columns-2" class="size-3.5" />
                {{ space._count?.columns ?? 0 }} kolom
              </span>
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-users" class="size-3.5" />
                {{ space.memberIds.length }} member
              </span>
            </div>

            <div class="mt-auto flex items-center justify-between gap-2 pt-4">
              <div v-if="space.memberIds.length" class="flex -space-x-1.5">
                <span
                  v-for="m in memberAvatars(space)"
                  :key="m.id"
                  class="flex size-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-default"
                  :class="m.color"
                  :title="m.name"
                >{{ m.initials }}</span>
                <span
                  v-if="space.memberIds.length > 3"
                  class="flex size-6 items-center justify-center rounded-full bg-elevated text-[10px] font-bold text-muted ring-2 ring-default"
                >+{{ space.memberIds.length - 3 }}</span>
              </div>
              <span v-else class="text-xs text-muted">Hanya Anda</span>

              <span class="shrink-0 text-xs text-muted">{{ relativeTime(space.updatedAt) }}</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <SpacesCreateSpaceModal v-model:open="createOpen" @created="onSpaceCreated" />
</template>
