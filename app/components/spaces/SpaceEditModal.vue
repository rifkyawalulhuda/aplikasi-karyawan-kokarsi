<script setup lang="ts">
import type { Space } from '~/types/space'
import { colorClass, errorMessage } from './board-meta'

const props = defineProps<{
  open: boolean
  space: Space
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'updated': []
}>()

const toast = useToast()
const saving = ref(false)

const COLORS = ['blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo', 'gray', 'slate']

const EMOJIS = ['📋', '🚀', '💡', '🎯', '⚡', '🔥', '✨', '🎨', '📊', '🛠️', '🌟', '📌', '🧩', '📦']

const form = reactive({
  name: '',
  description: '',
  icon: '📋',
  color: 'blue'
})

watch(() => props.open, (open) => {
  if (!open) return
  form.name = props.space.name
  form.description = props.space.description ?? ''
  form.icon = props.space.icon ?? '📋'
  form.color = props.space.color
}, { immediate: true })

async function onSubmit() {
  if (!form.name.trim()) {
    toast.add({ title: 'Nama Space wajib diisi', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/spaces/${props.space.id}`, {
      method: 'PUT',
      credentials: 'include',
      body: {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon,
        color: form.color
      }
    })
    emit('updated')
    emit('update:open', false)
    toast.add({ title: 'Space diperbarui', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Gagal memperbarui Space', description: errorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="Edit Space"
    description="Ubah nama, deskripsi, ikon, dan warna Space."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nama Space" required>
          <UInput
            v-model="form.name"
            class="w-full"
            placeholder="Contoh: Operasional Gudang"
            autofocus
          />
        </UFormField>

        <UFormField label="Deskripsi">
          <UTextarea
            v-model="form.description"
            :rows="2"
            class="w-full"
            placeholder="Deskripsi singkat (opsional)"
          />
        </UFormField>

        <UFormField label="Ikon">
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="emoji in EMOJIS"
              :key="emoji"
              type="button"
              class="flex size-9 items-center justify-center rounded-lg border text-lg transition-all"
              :class="form.icon === emoji
                ? 'border-primary bg-primary/10 scale-105'
                : 'border-default hover:border-primary/40 hover:bg-elevated/60'"
              :aria-label="`Ikon ${emoji}`"
              :aria-pressed="form.icon === emoji"
              @click="form.icon = emoji"
            >
              {{ emoji }}
            </button>
          </div>
        </UFormField>

        <UFormField label="Warna">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in COLORS"
              :key="c"
              type="button"
              class="size-7 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
              :class="[colorClass(c), form.color === c ? 'ring-2 ring-highlighted ring-offset-2 ring-offset-default' : '']"
              :aria-label="`Warna ${c}`"
              :aria-pressed="form.color === c"
              @click="form.color = c"
            />
          </div>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        />
        <UButton
          label="Simpan"
          color="primary"
          :loading="saving"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
