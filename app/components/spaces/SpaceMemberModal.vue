<script setup lang="ts">
import type { Space } from '~/types/space'

const props = defineProps<{
  open: boolean
  space: Space
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  updated: []
}>()

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { data: usersRes } = await useFetch<{ id: number; name: string; role: string }[]>('/api/users/pengurus', {
  credentials: 'include'
})

const allUsers = computed(() => usersRes.value ?? [])

// Users yang sudah jadi member (selain creator)
const memberIds = computed(() => props.space.memberIds ?? [])

// Users yang belum jadi member
const nonMembers = computed(() =>
  allUsers.value.filter(u => !memberIds.value.includes(u.id) && u.id !== props.space.createdById)
)

// Users yang sudah jadi member
const currentMembers = computed(() =>
  allUsers.value.filter(u => memberIds.value.includes(u.id))
)

const addingMemberId = ref<number | undefined>(undefined)
const loadingAdd = ref(false)
const loadingRemove = ref<number | null>(null)

async function addMember() {
  if (!addingMemberId.value) return
  loadingAdd.value = true
  try {
    await $fetch(`/api/spaces/${props.space.id}/members`, {
      method: 'POST',
      body: { memberId: addingMemberId.value },
      credentials: 'include',
    })
    addingMemberId.value = undefined
    emit('updated')
    toast.add({ title: 'Member berhasil ditambahkan', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Gagal menambahkan member', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loadingAdd.value = false
  }
}

function removeMember(userId: number, userName: string) {
  confirmDeleteToast({
    title: 'Hapus Member',
    description: `${userName} akan dihapus dari Space ini.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      loadingRemove.value = userId
      try {
        await $fetch(`/api/spaces/${props.space.id}/members/${userId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        emit('updated')
        toast.add({ title: 'Member dihapus', color: 'success' })
      } catch (e: any) {
        toast.add({ title: 'Gagal menghapus member', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
      } finally {
        loadingRemove.value = null
      }
    },
  })
}

// Creator info
const creatorName = computed(() =>
  allUsers.value.find(u => u.id === props.space.createdById)?.name ?? `User #${props.space.createdById}`
)
</script>

<template>
  <UModal
    :open="open"
    title="Kelola Member"
    :ui="{ content: 'max-w-md' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Creator -->
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Pembuat Space</p>
          <div class="flex items-center gap-3 rounded-lg bg-elevated/40 px-3 py-2.5">
            <div class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {{ creatorName.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">{{ creatorName }}</p>
            </div>
            <UBadge label="Pembuat" color="primary" variant="subtle" size="sm" />
          </div>
        </div>

        <!-- Current members -->
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Member ({{ currentMembers.length }})
          </p>
          <div v-if="currentMembers.length" class="space-y-1.5">
            <div
              v-for="member in currentMembers"
              :key="member.id"
              class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-elevated/40"
            >
              <div class="flex size-8 items-center justify-center rounded-full bg-elevated text-sm font-bold text-highlighted">
                {{ member.name.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="truncate text-sm font-medium text-highlighted">{{ member.name }}</p>
                <p class="text-xs text-muted">{{ member.role === 'ADMIN' ? 'Administrator' : 'Pengelola Koperasi' }}</p>
              </div>
              <UButton
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="xs"
                :loading="loadingRemove === member.id"
                aria-label="Hapus member"
                @click="removeMember(member.id, member.name)"
              />
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed border-default py-4 text-center text-sm text-muted">
            Belum ada member
          </div>
        </div>

        <!-- Add member -->
        <div>
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Tambah Member</p>
          <div v-if="nonMembers.length" class="flex gap-2">
            <USelect
              v-model="addingMemberId"
              :items="nonMembers.map(u => ({ label: u.name, value: u.id }))"
              placeholder="Pilih user..."
              class="flex-1"
            />
            <UButton
              label="Tambah"
              color="primary"
              :loading="loadingAdd"
              :disabled="!addingMemberId"
              @click="addMember"
            />
          </div>
          <p v-else class="text-sm text-muted">
            Semua user sudah menjadi member.
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton label="Tutup" color="neutral" variant="outline" @click="emit('update:open', false)" />
      </div>
    </template>
  </UModal>
</template>
