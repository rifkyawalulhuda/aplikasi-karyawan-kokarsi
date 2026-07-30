<script setup lang="ts">
import type { EmailNotificationConfig, EmailNotificationUser } from '~/types'

const toast = useToast()

// Fetch config
const { data: config, refresh } = useFetch<EmailNotificationConfig>('/api/settings/email-config')

// Fetch all users
const { data: allUsers } = useFetch<EmailNotificationUser[]>('/api/settings/email-config-users')

const form = reactive({
  isEnabled: true,
  triggerWindows: [] as number[],
  recipientUserIds: [] as number[],
})

// Sync from API to form
watchEffect(() => {
  if (config.value) {
    form.isEnabled = config.value.isEnabled
    form.triggerWindows = [...config.value.triggerWindows]
    form.recipientUserIds = config.value.recipients.map(r => r.id)
  }
})

// Add window logic
const newWindowInput = ref<number | null>(null)
const newWindowError = ref('')

function addWindow() {
  const val = newWindowInput.value
  if (val === null || val === undefined || !Number.isInteger(val) || val < 0) {
    newWindowError.value = 'Masukkan angka non-negatif'
    return
  }
  if (form.triggerWindows.includes(val)) {
    newWindowError.value = 'Nilai sudah ada dalam daftar'
    return
  }
  form.triggerWindows = [...form.triggerWindows, val].sort((a, b) => b - a)
  newWindowInput.value = null
  newWindowError.value = ''
}

function removeWindow(val: number) {
  form.triggerWindows = form.triggerWindows.filter(w => w !== val)
}

// Toggle recipient
function toggleRecipient(userId: number) {
  if (form.recipientUserIds.includes(userId)) {
    form.recipientUserIds = form.recipientUserIds.filter(id => id !== userId)
  } else {
    form.recipientUserIds = [...form.recipientUserIds, userId]
  }
}

// Save flow
const showConfirm = ref(false)
const saving = ref(false)

function openConfirm() {
  showConfirm.value = true
}

async function confirmSave() {
  saving.value = true
  try {
    await $fetch('/api/settings/email-config', {
      method: 'PUT',
      body: {
        isEnabled: form.isEnabled,
        triggerWindows: form.triggerWindows,
        recipientUserIds: form.recipientUserIds,
      },
    })
    await refresh()
    toast.add({ title: 'Konfigurasi email berhasil disimpan', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Gagal menyimpan konfigurasi',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    saving.value = false
    showConfirm.value = false
  }
}

function windowLabel(val: number): string {
  return val === 0 ? 'Hari H' : `${val} hari`
}

function windowColor(val: number): 'warning' | 'info' {
  return val <= 7 ? 'warning' : 'info'
}

const selectedCount = computed(() => form.recipientUserIds.length)
</script>

<template>
  <div>
    <!-- Section 1: Global Toggle -->
    <UCard class="mb-4">
      <template #header>
        <span class="font-semibold">Notifikasi Email</span>
      </template>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <UToggle v-model="form.isEnabled" />
          <span class="text-sm">Aktifkan Notifikasi Email</span>
        </div>
        <p v-if="!form.isEnabled" class="text-sm text-muted">
          Notifikasi email dinonaktifkan. Tidak ada email yang akan dikirim.
        </p>
      </div>
    </UCard>

    <!-- Section 2: Trigger Windows -->
    <UCard
      class="mb-4"
      :class="{ 'opacity-50 pointer-events-none': !form.isEnabled }"
    >
      <template #header>
        <span class="font-semibold">Hari Pengiriman</span>
      </template>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          Email akan dikirim N hari sebelum kontrak/sertifikasi habis
        </p>

        <!-- Current windows as badges -->
        <div class="flex flex-wrap gap-2">
          <div
            v-for="win in form.triggerWindows"
            :key="win"
            class="flex items-center gap-1"
          >
            <UBadge :color="windowColor(win)" variant="subtle">
              {{ windowLabel(win) }}
              <button
                type="button"
                class="ml-1 cursor-pointer hover:opacity-70"
                @click="removeWindow(win)"
              >
                <UIcon name="i-lucide-x" class="w-3 h-3" />
              </button>
            </UBadge>
          </div>
          <span v-if="form.triggerWindows.length === 0" class="text-sm text-muted italic">
            Belum ada hari pengiriman ditambahkan
          </span>
        </div>

        <!-- Add new window -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <input
              v-model.number="newWindowInput"
              type="number"
              min="0"
              placeholder="Hari sebelum (contoh: 30)"
              class="border border-default rounded-md px-3 py-1.5 text-sm w-48 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              @keydown.enter.prevent="addWindow"
            />
            <UButton
              label="Tambah"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="addWindow"
            />
          </div>
          <p v-if="newWindowError" class="text-sm text-error">
            {{ newWindowError }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Section 3: Recipients -->
    <UCard
      class="mb-4"
      :class="{ 'opacity-50 pointer-events-none': !form.isEnabled }"
    >
      <template #header>
        <span class="font-semibold">Penerima Notifikasi</span>
      </template>
      <div class="flex flex-col gap-3">
        <p class="text-sm text-muted">
          User yang akan menerima email notifikasi
        </p>

        <!-- Empty state -->
        <p v-if="!allUsers || allUsers.length === 0" class="text-sm text-muted italic">
          Belum ada user terdaftar
        </p>

        <!-- User list -->
        <div v-else class="flex flex-col gap-2">
          <label
            v-for="user in allUsers"
            :key="user.id"
            class="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-elevated"
          >
            <input
              type="checkbox"
              :checked="form.recipientUserIds.includes(user.id)"
              class="w-4 h-4 accent-primary cursor-pointer"
              @change="toggleRecipient(user.id)"
            />
            <div class="flex flex-col">
              <span class="text-sm font-medium">{{ user.name }}</span>
              <span class="text-xs text-muted">{{ user.email }}</span>
            </div>
          </label>
        </div>

        <!-- Selected count -->
        <p class="text-sm text-muted">
          {{ selectedCount }} penerima dipilih
        </p>
      </div>
    </UCard>

    <!-- Section 4: Save Button -->
    <div class="flex justify-end">
      <UButton
        label="Simpan Konfigurasi"
        color="primary"
        icon="i-lucide-save"
        :loading="saving"
        :disabled="saving"
        @click="openConfirm"
      />
    </div>

    <!-- Confirm Modal -->
    <UModal v-model:open="showConfirm" title="Konfirmasi Perubahan">
      <template #body>
        <p class="text-sm">
          Perubahan konfigurasi akan langsung berlaku pada cron berikutnya. Lanjutkan?
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="saving"
            @click="showConfirm = false"
          />
          <UButton
            label="Ya, Simpan"
            color="primary"
            :loading="saving"
            :disabled="saving"
            @click="confirmSave"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
