<script setup lang="ts">
import type { Space } from '~/types/space'

definePageMeta({ layout: 'default' })

const toast = useToast()
const { data: spaces, refresh, pending } = await useFetch<Space[]>('/api/spaces', { credentials: 'include' })

const createOpen = ref(false)

function onSpaceCreated() {
  createOpen.value = false
  refresh()
  toast.add({ title: 'Space berhasil dibuat', color: 'success' })
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500', sky: 'bg-sky-500', teal: 'bg-teal-500',
  green: 'bg-green-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-red-500', pink: 'bg-pink-500', purple: 'bg-purple-500',
  indigo: 'bg-indigo-500', gray: 'bg-gray-400', slate: 'bg-slate-500',
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
          <UButton label="Buat Space" icon="i-lucide-plus" color="primary" @click="createOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6">
        <!-- Loading -->
        <div v-if="pending" class="flex h-64 items-center justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
        </div>

        <!-- Empty state -->
        <div v-else-if="!spaces?.length" class="flex h-64 flex-col items-center justify-center gap-4 text-center">
          <div class="rounded-full bg-elevated p-4">
            <UIcon name="i-lucide-kanban" class="size-10 text-muted" />
          </div>
          <div>
            <p class="font-semibold text-highlighted">Belum ada Space</p>
            <p class="mt-1 text-sm text-muted">Buat Space pertama untuk mulai berkolaborasi</p>
          </div>
          <UButton label="Buat Space" icon="i-lucide-plus" color="primary" @click="createOpen = true" />
        </div>

        <!-- Space grid -->
        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <NuxtLink
            v-for="space in spaces"
            :key="space.id"
            :to="`/spaces/${space.id}`"
            class="group relative overflow-hidden rounded-xl border border-default bg-default p-5 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-black/5"
          >
            <!-- Color accent bar -->
            <div class="absolute inset-x-0 top-0 h-1 rounded-t-xl" :class="colorMap[space.color] ?? 'bg-primary'" />

            <!-- Header -->
            <div class="mb-3 flex items-center gap-3 pt-1">
              <div class="flex size-10 items-center justify-center rounded-lg text-xl" :class="`${colorMap[space.color]?.replace('bg-', 'bg-')}/10`">
                {{ space.icon ?? '📋' }}
              </div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-highlighted group-hover:text-primary">{{ space.name }}</p>
                <p v-if="space.description" class="truncate text-xs text-muted">{{ space.description }}</p>
              </div>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-4 text-xs text-muted">
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-columns-2" class="size-3" />
                {{ space._count?.columns ?? 0 }} kolom
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-users" class="size-3" />
                {{ space.memberIds.length }} member
              </span>
            </div>

            <!-- Updated at -->
            <p class="mt-3 text-xs text-muted">
              Diperbarui {{ new Date(space.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create Space Modal -->
  <SpacesCreateSpaceModal v-model:open="createOpen" @created="onSpaceCreated" />
</template>
