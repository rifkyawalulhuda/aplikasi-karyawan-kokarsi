<script setup lang="ts">
import type {
  EmailNotificationConfig,
  EmailNotificationHistory,
  EmailNotificationStatus,
  EmailNotificationUser,
  ExternalEmailRecipient
} from '~/types'

const toast = useToast()

const { data: config, refresh } = useFetch<EmailNotificationConfig>('/api/settings/email-config')
const { data: allUsers } = useFetch<EmailNotificationUser[]>('/api/settings/email-config-users')
const { data: status } = useFetch<EmailNotificationStatus>('/api/settings/email-config/status')
const { data: history, refresh: refreshHistory } = useFetch<EmailNotificationHistory[]>('/api/settings/email-config/history')

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WINDOW_PRESETS = [90, 60, 30, 14, 7, 0]

const form = reactive({
  isEnabled: true,
  triggerWindows: [] as number[],
  recipientUserIds: [] as number[],
  externalRecipients: [] as ExternalEmailRecipient[]
})

watchEffect(() => {
  if (config.value) {
    form.isEnabled = config.value.isEnabled
    form.triggerWindows = [...config.value.triggerWindows]
    form.recipientUserIds = [...config.value.recipientUserIds]
    form.externalRecipients = config.value.externalRecipients.map(r => ({ ...r }))
  }
})

// ── Hari pengiriman ──────────────────────────────────────────────────────────
const newWindowInput = ref<number | null>(null)
const newWindowError = ref('')

function toggleWindow(val: number) {
  if (form.triggerWindows.includes(val)) {
    form.triggerWindows = form.triggerWindows.filter(w => w !== val)
  } else {
    form.triggerWindows = [...form.triggerWindows, val].sort((a, b) => b - a)
  }
}

function addWindow() {
  const val = newWindowInput.value
  if (val === null || val === undefined || !Number.isInteger(val) || val < 0) {
    newWindowError.value = 'Masukkan angka 0–365'
    return
  }
  if (val > 365) {
    newWindowError.value = 'Maksimal 365 hari'
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

function windowLabel(val: number): string {
  return val === 0 ? 'Hari H' : `${val} hari`
}

function windowColor(val: number): 'warning' | 'info' {
  return val <= 7 ? 'warning' : 'info'
}

// ── Penerima ─────────────────────────────────────────────────────────────────
const userEmails = computed(() => new Set((allUsers.value ?? []).map(u => u.email.trim().toLowerCase())))

function isUserSelected(id: number) {
  return form.recipientUserIds.includes(id)
}

function toggleUser(id: number) {
  if (isUserSelected(id)) {
    form.recipientUserIds = form.recipientUserIds.filter(x => x !== id)
  } else {
    form.recipientUserIds = [...form.recipientUserIds, id]
  }
}

const newEmail = ref('')
const newEmailName = ref('')
const newEmailError = ref('')

function addExternalRecipient() {
  const email = newEmail.value.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    newEmailError.value = 'Format email tidak valid'
    return
  }
  if (userEmails.value.has(email) || form.externalRecipients.some(r => r.email.toLowerCase() === email)) {
    newEmailError.value = 'Email ini sudah ada dalam daftar'
    return
  }
  form.externalRecipients = [
    ...form.externalRecipients,
    { id: Date.now(), email, name: newEmailName.value.trim() || email.split('@')[0]! }
  ]
  newEmail.value = ''
  newEmailName.value = ''
  newEmailError.value = ''
}

function removeExternalRecipient(id: number) {
  form.externalRecipients = form.externalRecipients.filter(r => r.id !== id)
}

// Penerima aktif (untuk ringkasan & test email) — dari akun terpilih + email manual.
const activeRecipients = computed(() => {
  const fromUsers = (allUsers.value ?? [])
    .filter(u => form.recipientUserIds.includes(u.id))
    .map(u => ({ email: u.email, name: u.name }))
  const fromManual = form.externalRecipients.map(r => ({ email: r.email, name: r.name }))
  return [...fromUsers, ...fromManual]
})

const recipientCount = computed(() => activeRecipients.value.length)
const daysCount = computed(() => form.triggerWindows.length)
const mailerReady = computed(() => status.value?.mailerConfigured === true)

// ── Simpan ───────────────────────────────────────────────────────────────────
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    await $fetch('/api/settings/email-config', {
      method: 'PUT',
      body: {
        isEnabled: form.isEnabled,
        triggerWindows: form.triggerWindows,
        recipientUserIds: form.recipientUserIds,
        externalRecipients: form.externalRecipients.map(r => ({ email: r.email, name: r.name }))
      }
    })
    await Promise.all([refresh(), refreshHistory()])
    toast.add({ title: 'Konfigurasi email disimpan', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Gagal menyimpan konfigurasi', description: apiErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Test email ───────────────────────────────────────────────────────────────
const testOpen = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean, message: string } | null>(null)

function openTest() {
  testResult.value = null
  testOpen.value = true
}

async function sendTest() {
  testing.value = true
  testResult.value = null
  try {
    const res = await $fetch<{ sent: number }>('/api/settings/email-config/test', {
      method: 'POST',
      body: { recipients: activeRecipients.value.map(r => ({ email: r.email, name: r.name })) }
    })
    testResult.value = { ok: true, message: `Email uji terkirim ke ${res.sent} penerima.` }
    toast.add({ title: 'Email uji terkirim', color: 'success' })
  } catch (e) {
    testResult.value = { ok: false, message: apiErrorMessage(e, 'Gagal mengirim email uji') }
  } finally {
    testing.value = false
  }
}

// ── Riwayat ──────────────────────────────────────────────────────────────────
const historyOpen = ref(false)

function formatHistoryDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="space-y-5">
    <!-- Hero status -->
    <div class="dossier-rise overflow-hidden rounded-2xl border border-default bg-default">
      <div class="h-1.5 w-full" :class="form.isEnabled ? 'bg-success' : 'bg-neutral'" />
      <div class="flex flex-wrap items-center justify-between gap-4 p-5">
        <div class="flex items-start gap-3">
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl ring ring-inset"
            :class="form.isEnabled ? 'bg-success/10 ring-success/20' : 'bg-elevated ring-default'"
          >
            <UIcon
              :name="form.isEnabled ? 'i-lucide-bell-ring' : 'i-lucide-bell-off'"
              class="size-5"
              :class="form.isEnabled ? 'text-success' : 'text-muted'"
              aria-hidden="true"
            />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-highlighted">
                Notifikasi Email
              </h2>
              <UBadge :color="form.isEnabled ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ form.isEnabled ? 'Aktif' : 'Nonaktif' }}
              </UBadge>
            </div>
            <p class="mt-0.5 text-sm text-muted">
              <DashboardCountUp :value="recipientCount" /> penerima ·
              <DashboardCountUp :value="daysCount" /> hari pengiriman ·
              <span :class="mailerReady ? 'text-success' : 'text-warning'">
                {{ mailerReady ? 'Maileroo siap' : 'Maileroo belum dikonfigurasi' }}
              </span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">{{ form.isEnabled ? 'Aktif' : 'Nonaktif' }}</span>
          <USwitch v-model="form.isEnabled" aria-label="Aktifkan notifikasi email" />
        </div>
      </div>

      <div
        v-if="!mailerReady"
        class="flex items-start gap-2 border-t border-warning/20 bg-warning/5 px-5 py-3 text-xs text-warning"
      >
        <UIcon name="i-lucide-alert-triangle" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Kunci API layanan email (MAILEROO_API_KEY) belum diatur. Email tidak akan terkirim sampai dikonfigurasi.</span>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2" :class="{ 'pointer-events-none opacity-50': !form.isEnabled }">
      <!-- Hari pengiriman -->
      <section class="dossier-rise rounded-2xl border border-default bg-default" style="animation-delay: 60ms">
        <header class="flex items-center gap-2 border-b border-default p-4">
          <UIcon name="i-lucide-calendar-clock" class="size-4 text-muted" aria-hidden="true" />
          <h3 class="text-sm font-semibold text-highlighted">
            Hari Pengiriman
          </h3>
        </header>
        <div class="space-y-4 p-4">
          <p class="text-xs text-muted">
            Email pengingat dikirim sekian hari sebelum masa berlaku habis. Berlaku untuk kontrak, sertifikasi &amp; ijin, kontrak vendor, dan legal koperasi.
          </p>

          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Preset
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in WINDOW_PRESETS"
                :key="preset"
                type="button"
                class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                :class="form.triggerWindows.includes(preset)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-default text-muted hover:bg-elevated/60 hover:text-highlighted'"
                :aria-pressed="form.triggerWindows.includes(preset)"
                @click="toggleWindow(preset)"
              >
                {{ windowLabel(preset) }}
              </button>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Terpilih
            </p>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="win in form.triggerWindows"
                :key="win"
                :color="windowColor(win)"
                variant="subtle"
              >
                {{ windowLabel(win) }}
                <button
                  type="button"
                  class="ml-1 cursor-pointer hover:opacity-70"
                  :aria-label="`Hapus ${windowLabel(win)}`"
                  @click="removeWindow(win)"
                >
                  <UIcon name="i-lucide-x" class="size-3" aria-hidden="true" />
                </button>
              </UBadge>
              <span v-if="form.triggerWindows.length === 0" class="text-sm italic text-muted">
                Belum ada hari pengiriman
              </span>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <UInputNumber
                v-model="newWindowInput"
                :min="0"
                :max="365"
                placeholder="Hari kustom (0–365)"
                class="w-44"
                @keydown.enter.prevent="addWindow"
              />
              <UButton
                label="Tambah"
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                size="sm"
                @click="addWindow"
              />
            </div>
            <p v-if="newWindowError" class="text-xs text-error">
              {{ newWindowError }}
            </p>
          </div>
        </div>
      </section>

      <!-- Penerima -->
      <section class="dossier-rise rounded-2xl border border-default bg-default" style="animation-delay: 120ms">
        <header class="flex items-center justify-between gap-2 border-b border-default p-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users" class="size-4 text-muted" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-highlighted">
              Penerima
            </h3>
          </div>
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ recipientCount }} dipilih
          </UBadge>
        </header>
        <div class="space-y-4 p-4">
          <!-- Dari akun -->
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Dari Akun User
            </p>
            <p v-if="!allUsers || allUsers.length === 0" class="text-sm italic text-muted">
              Belum ada user terdaftar
            </p>
            <div v-else class="space-y-1">
              <button
                v-for="user in allUsers"
                :key="user.id"
                type="button"
                class="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors"
                :class="isUserSelected(user.id)
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-transparent hover:bg-elevated/60'"
                :aria-pressed="isUserSelected(user.id)"
                @click="toggleUser(user.id)"
              >
                <UIcon
                  :name="isUserSelected(user.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                  class="size-4 shrink-0"
                  :class="isUserSelected(user.id) ? 'text-primary' : 'text-muted'"
                  aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ user.name }}
                  </p>
                  <p class="truncate text-xs text-muted">
                    {{ user.email }}
                  </p>
                </div>
                <UBadge color="neutral" variant="subtle" size="xs">
                  Akun
                </UBadge>
              </button>
            </div>
          </div>

          <!-- Email manual -->
          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Email Tambahan
            </p>
            <p v-if="form.externalRecipients.length === 0" class="text-sm italic text-muted">
              Belum ada email tambahan
            </p>
            <div v-else class="space-y-1">
              <div
                v-for="recipient in form.externalRecipients"
                :key="recipient.id"
                class="flex items-center gap-3 rounded-lg border border-transparent p-2.5 hover:bg-elevated/60"
              >
                <UIcon name="i-lucide-at-sign" class="size-4 shrink-0 text-teal-500" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ recipient.name }}
                  </p>
                  <p class="truncate text-xs text-muted">
                    {{ recipient.email }}
                  </p>
                </div>
                <UBadge color="info" variant="subtle" size="xs">
                  Manual
                </UBadge>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Hapus ${recipient.email}`"
                  @click="removeExternalRecipient(recipient.id)"
                />
              </div>
            </div>
          </div>

          <!-- Tambah email -->
          <div class="rounded-lg border border-dashed border-default p-3">
            <div class="flex flex-col gap-2 sm:flex-row">
              <UInput
                v-model="newEmail"
                type="email"
                placeholder="email@domain.com"
                class="flex-1"
                @keydown.enter.prevent="addExternalRecipient"
              />
              <UInput
                v-model="newEmailName"
                placeholder="Nama (opsional)"
                class="sm:w-40"
                @keydown.enter.prevent="addExternalRecipient"
              />
              <UButton
                label="Tambah"
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                @click="addExternalRecipient"
              />
            </div>
            <p v-if="newEmailError" class="mt-1 text-xs text-error">
              {{ newEmailError }}
            </p>
            <p class="mt-1.5 text-xs text-muted">
              Tambahkan email tanpa harus membuat akun user. Cocok untuk pihak eksternal atau grup.
            </p>
          </div>
        </div>
      </section>
    </div>

    <!-- Riwayat perubahan -->
    <section class="rounded-2xl border border-default bg-default">
      <button
        type="button"
        class="flex w-full items-center gap-2 p-4 text-left"
        :aria-expanded="historyOpen"
        @click="historyOpen = !historyOpen"
      >
        <UIcon name="i-lucide-history" class="size-4 text-muted" aria-hidden="true" />
        <span class="text-sm font-semibold text-highlighted">Riwayat Perubahan</span>
        <span v-if="history?.length" class="text-xs text-muted">({{ history.length }})</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="ml-auto size-4 text-muted transition-transform"
          :class="{ 'rotate-180': historyOpen }"
          aria-hidden="true"
        />
      </button>
      <div v-show="historyOpen" class="border-t border-default p-4">
        <p v-if="!history || history.length === 0" class="text-sm italic text-muted">
          Belum ada riwayat perubahan
        </p>
        <ol v-else class="space-y-3">
          <li v-for="entry in history" :key="entry.id" class="flex items-start gap-3">
            <span class="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
            <div class="min-w-0">
              <p class="text-sm text-highlighted">
                Diubah oleh <span class="font-medium">{{ entry.changedBy }}</span>
              </p>
              <p class="truncate text-xs text-muted">
                {{ entry.description }}
              </p>
              <p class="text-xs text-muted">
                {{ formatHistoryDate(entry.createdAt) }}
              </p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- Aksi -->
    <div class="flex flex-wrap items-center justify-end gap-2">
      <UButton
        label="Kirim Test Email"
        icon="i-lucide-send"
        color="neutral"
        variant="outline"
        :disabled="recipientCount === 0"
        @click="openTest"
      />
      <UButton
        label="Simpan Konfigurasi"
        icon="i-lucide-save"
        color="primary"
        :loading="saving"
        :disabled="saving"
        @click="save"
      />
    </div>

    <!-- Modal Test Email -->
    <UModal v-model:open="testOpen" title="Kirim Test Email" :ui="{ content: 'sm:max-w-lg' }">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted">
            Email uji akan dikirim ke {{ recipientCount }} penerima terpilih menggunakan konfigurasi saat ini (belum harus disimpan).
          </p>

          <div class="max-h-56 space-y-1 overflow-y-auto overscroll-contain">
            <div
              v-for="(recipient, index) in activeRecipients"
              :key="index"
              class="flex items-center gap-2 rounded-lg bg-elevated/50 px-3 py-2"
            >
              <UIcon name="i-lucide-mail" class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ recipient.email }}</span>
              <span class="shrink-0 text-xs text-muted">{{ recipient.name }}</span>
            </div>
          </div>

          <div
            v-if="testResult"
            class="flex items-start gap-2 rounded-lg border p-3 text-sm"
            :class="testResult.ok ? 'border-success/30 bg-success/5 text-success' : 'border-error/30 bg-error/5 text-error'"
          >
            <UIcon
              :name="testResult.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
              class="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>{{ testResult.message }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Tutup"
            color="neutral"
            variant="ghost"
            @click="testOpen = false"
          />
          <UButton
            label="Kirim Sekarang"
            icon="i-lucide-send"
            color="primary"
            :loading="testing"
            :disabled="testing"
            @click="sendTest"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
