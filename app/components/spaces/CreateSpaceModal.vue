<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; created: [] }>()

const toast = useToast()
const loading = ref(false)

const COLORS = [
  { value: 'blue', bg: 'bg-blue-500' }, { value: 'sky', bg: 'bg-sky-500' },
  { value: 'teal', bg: 'bg-teal-500' }, { value: 'green', bg: 'bg-green-500' },
  { value: 'yellow', bg: 'bg-amber-400' }, { value: 'orange', bg: 'bg-orange-500' },
  { value: 'red', bg: 'bg-red-500' }, { value: 'pink', bg: 'bg-pink-500' },
  { value: 'purple', bg: 'bg-purple-500' }, { value: 'indigo', bg: 'bg-indigo-500' },
]

const TEMPLATES = [
  { key: 'simple', label: 'Simple', desc: 'Todo → In Progress → Done', icon: '✅' },
  { key: 'dev', label: 'Dev Flow', desc: 'Backlog → Todo → In Progress → Review → Done', icon: '💻' },
  { key: 'bug', label: 'Bug Track', desc: 'Reported → Confirmed → In Fix → Testing → Closed', icon: '🐛' },
  { key: 'hr', label: 'HR Flow', desc: 'Diajukan → Ditinjau → Disetujui → Selesai', icon: '👥' },
  { key: 'custom', label: 'Kosong', desc: 'Mulai dari awal, buat kolom sendiri', icon: '⬜' },
]

const EMOJIS = ['📋', '🚀', '💡', '🎯', '⚡', '🔥', '✨', '🎨', '📊', '🛠️', '🌟', '📌']

const form = reactive({
  name: '',
  description: '',
  icon: '📋',
  color: 'blue',
  template: 'simple',
})

function reset() {
  form.name = ''
  form.description = ''
  form.icon = '📋'
  form.color = 'blue'
  form.template = 'simple'
}

async function onSubmit() {
  if (!form.name.trim()) {
    toast.add({ title: 'Nama Space wajib diisi', color: 'warning' })
    return
  }
  loading.value = true
  try {
    await $fetch('/api/spaces', {
      method: 'POST',
      body: form,
      credentials: 'include',
    })
    reset()
    emit('created')
    emit('update:open', false)
  } catch (e: any) {
    toast.add({ title: 'Gagal membuat Space', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="open" title="Buat Space Baru" :ui="{ content: 'max-w-lg' }" @update:open="emit('update:open', $event)">
    <template #body>
      <div class="space-y-5">
        <!-- Icon + Name -->
        <div class="flex items-start gap-3">
          <UPopover :content="{ side: 'bottom', align: 'start' }">
            <button type="button" class="flex size-12 shrink-0 items-center justify-center rounded-lg border border-default bg-elevated/50 text-2xl hover:bg-elevated">
              {{ form.icon }}
            </button>
            <template #content>
              <div class="grid grid-cols-6 gap-1.5 p-2">
                <button
                  v-for="emoji in EMOJIS"
                  :key="emoji"
                  type="button"
                  class="flex size-9 items-center justify-center rounded text-xl hover:bg-elevated"
                  :class="form.icon === emoji ? 'bg-elevated ring-1 ring-primary' : ''"
                  @click="form.icon = emoji"
                >{{ emoji }}</button>
              </div>
            </template>
          </UPopover>
          <UFormField label="Nama Space" class="flex-1" required>
            <UInput v-model="form.name" class="w-full" placeholder="contoh: Sprint Q3, Bug Tracking..." autofocus />
          </UFormField>
        </div>

        <!-- Description -->
        <UFormField label="Deskripsi">
          <UTextarea v-model="form.description" :rows="2" class="w-full" placeholder="Opsional — jelaskan tujuan Space ini" />
        </UFormField>

        <!-- Color -->
        <UFormField label="Warna">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in COLORS"
              :key="c.value"
              type="button"
              class="size-7 rounded-full border-2 transition-transform hover:scale-110"
              :class="[c.bg, form.color === c.value ? 'border-highlighted scale-110' : 'border-transparent']"
              @click="form.color = c.value"
            />
          </div>
        </UFormField>

        <!-- Template -->
        <UFormField label="Template Kolom">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="t in TEMPLATES"
              :key="t.key"
              type="button"
              class="rounded-lg border p-3 text-left transition-colors"
              :class="form.template === t.key
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-default hover:border-primary/40 hover:bg-elevated/50'"
              @click="form.template = t.key"
            >
              <div class="flex items-center gap-2">
                <span class="text-base">{{ t.icon }}</span>
                <span class="font-medium text-sm text-highlighted">{{ t.label }}</span>
              </div>
              <p class="mt-0.5 text-xs text-muted">{{ t.desc }}</p>
            </button>
          </div>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Batal" color="neutral" variant="outline" @click="emit('update:open', false)" />
        <UButton label="Buat Space" color="primary" :loading="loading" @click="onSubmit" />
      </div>
    </template>
  </UModal>
</template>
