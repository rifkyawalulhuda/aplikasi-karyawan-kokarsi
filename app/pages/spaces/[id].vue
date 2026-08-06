<script setup lang="ts">
import type { Space, SpaceCard } from '~/types/space'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()

const spaceId = computed(() => Number(route.params.id))
const { data: space, refresh, pending, error } = await useFetch<Space>(() => `/api/spaces/${spaceId.value}`, {
  credentials: 'include',
})

// Redirect jika tidak ada akses
watchEffect(() => {
  if (error.value?.statusCode === 403 || error.value?.statusCode === 404) {
    router.push('/spaces')
  }
})

// Card detail modal
const selectedCard = ref<SpaceCard | null>(null)
const cardDetailOpen = ref(false)
const memberModalOpen = ref(false)

function openCard(card: SpaceCard) {
  selectedCard.value = card
  cardDetailOpen.value = true
}

function openMemberModal() {
  memberModalOpen.value = true
}

// Dropdown menu items
const menuItems = computed(() => [[
  { label: 'Kelola Member', icon: 'i-lucide-users', onSelect: openMemberModal },
  { label: 'Hapus Space', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: deleteSpace },
]])

// Delete space
function deleteSpace() {
  if (!space.value) return
  confirmDeleteToast({
    title: 'Hapus Space',
    description: `Space "${space.value.name}" dan semua kolom + card di dalamnya akan dihapus permanen.`,
    onConfirm: async () => {
      await $fetch(`/api/spaces/${spaceId.value}`, { method: 'DELETE', credentials: 'include' })
      router.push('/spaces')
    },
  })
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500', sky: 'bg-sky-500', teal: 'bg-teal-500',
  green: 'bg-green-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-red-500', pink: 'bg-pink-500', purple: 'bg-purple-500',
  indigo: 'bg-indigo-500', gray: 'bg-gray-400', slate: 'bg-slate-500',
}
</script>

<template>
  <UDashboardPanel id="space-board" :ui="{ body: 'p-0 overflow-hidden' }">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <div class="flex items-center gap-3">
            <UDashboardSidebarCollapse />
            <NuxtLink to="/spaces" class="text-muted hover:text-highlighted">
              <UIcon name="i-lucide-layout-kanban" class="size-4" />
            </NuxtLink>
            <UIcon name="i-lucide-chevron-right" class="size-3 text-muted" />
            <div v-if="space" class="flex items-center gap-2">
              <div
                class="flex size-7 items-center justify-center rounded-md text-base"
                :class="`${colorMap[space.color] ?? 'bg-primary'}/10`"
              >
                {{ space.icon ?? '📋' }}
              </div>
              <span class="font-semibold text-highlighted">{{ space.name }}</span>
            </div>
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="pending"
              @click="refresh()"
            />
            <UDropdownMenu :items="menuItems">
              <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" size="sm" />
            </UDropdownMenu>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="pending && !space" class="flex h-full items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex h-full flex-col items-center justify-center gap-3 text-center">
        <UIcon name="i-lucide-alert-circle" class="size-10 text-error" />
        <p class="font-medium text-highlighted">Space tidak ditemukan</p>
        <UButton label="Kembali ke Daftar Space" color="neutral" variant="outline" to="/spaces" />
      </div>

      <!-- Board -->
      <div v-else-if="space" class="h-full overflow-hidden">
        <SpacesKanbanBoard
          :space="space"
          @refresh="refresh()"
          @card-click="openCard"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Card Detail Modal -->
  <SpacesCardDetailModal
    v-if="selectedCard"
    v-model:open="cardDetailOpen"
    :card="selectedCard"
    :space-id="spaceId"
    @updated="refresh()"
    @deleted="refresh(); cardDetailOpen = false"
  />

  <!-- Member Modal -->
  <SpacesSpaceMemberModal
    v-if="space && memberModalOpen"
    v-model:open="memberModalOpen"
    :space="space"
    @updated="refresh()"
  />
</template>
