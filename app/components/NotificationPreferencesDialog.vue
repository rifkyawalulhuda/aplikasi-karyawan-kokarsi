<script setup lang="ts">
import {
  NOTIFICATION_CATEGORY_META,
  NOTIFICATION_CATEGORY_ORDER,
  type NotificationCategoryKey
} from '~/utils/notification-meta'
import type { NotificationPreference } from '~/composables/useNotifications'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const open = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const { preference, fetchPreference, updatePreference } = useNotifications()
const toast = useToast()

const DEFAULT_QUIET_START = '21:00'
const DEFAULT_QUIET_END = '07:00'

const mutedCategories = ref<string[]>([])
const quietEnabled = ref(false)
const quietStart = ref(DEFAULT_QUIET_START)
const quietEnd = ref(DEFAULT_QUIET_END)
const soundEnabled = ref(false)
const osNotificationEnabled = ref(true)

const isSaving = ref(false)
const osPermission = ref<NotificationPermission | 'unsupported'>('default')

function syncFromPreference(pref: NotificationPreference | null) {
  mutedCategories.value = [...(pref?.mutedCategories ?? [])]
  quietEnabled.value = Boolean(pref?.quietHoursStart && pref?.quietHoursEnd)
  quietStart.value = pref?.quietHoursStart ?? DEFAULT_QUIET_START
  quietEnd.value = pref?.quietHoursEnd ?? DEFAULT_QUIET_END
  soundEnabled.value = pref?.soundEnabled ?? false
  osNotificationEnabled.value = pref?.osNotificationEnabled ?? true
}

function refreshPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    osPermission.value = 'unsupported'
    return
  }
  osPermission.value = Notification.permission
}

watch(open, async (value) => {
  if (!value) return
  refreshPermission()
  await fetchPreference()
  syncFromPreference(preference.value)
})

const categoryItems = computed(() =>
  NOTIFICATION_CATEGORY_ORDER.map((key: NotificationCategoryKey) => ({
    key,
    ...NOTIFICATION_CATEGORY_META[key]
  }))
)

function toggleMute(key: string) {
  mutedCategories.value = mutedCategories.value.includes(key)
    ? mutedCategories.value.filter(c => c !== key)
    : [...mutedCategories.value, key]
}

async function enableOsNotification(value: boolean) {
  if (!value) {
    osNotificationEnabled.value = false
    return
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    toast.add({
      title: 'Browser tidak mendukung notifikasi',
      icon: 'i-lucide-triangle-alert',
      color: 'warning',
      duration: 4000
    })
    osNotificationEnabled.value = false
    return
  }
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  refreshPermission()
  if (Notification.permission === 'granted') {
    osNotificationEnabled.value = true
  } else {
    osNotificationEnabled.value = false
    toast.add({
      title: 'Izin notifikasi ditolak',
      description: 'Aktifkan izin notifikasi di pengaturan browser untuk menerima pemberitahuan.',
      icon: 'i-lucide-bell-off',
      color: 'warning',
      duration: 5000
    })
  }
}

async function save() {
  isSaving.value = true
  try {
    await updatePreference({
      mutedCategories: mutedCategories.value,
      quietHoursStart: quietEnabled.value ? quietStart.value : null,
      quietHoursEnd: quietEnabled.value ? quietEnd.value : null,
      soundEnabled: soundEnabled.value,
      osNotificationEnabled: osNotificationEnabled.value
    })
    toast.add({
      title: 'Preferensi notifikasi disimpan',
      icon: 'i-lucide-check',
      duration: 3000
    })
    open.value = false
  } catch {
    toast.add({
      title: 'Gagal menyimpan preferensi',
      icon: 'i-lucide-circle-alert',
      color: 'error',
      duration: 4000
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Preferensi Notifikasi"
    description="Atur notifikasi yang ingin Anda terima dan kapan."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Kategori -->
        <section class="space-y-2">
          <div>
            <h3 class="text-sm font-medium text-highlighted">
              Kategori
            </h3>
            <p class="text-xs text-muted">
              Nonaktifkan kategori yang tidak ingin Anda terima. Notifikasi kategori ini tidak akan dibuat.
            </p>
          </div>
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <div
              v-for="item in categoryItems"
              :key="item.key"
              class="flex items-center gap-2.5 rounded-lg border border-default px-3 py-2 transition-colors hover:bg-elevated/60"
              :class="mutedCategories.includes(item.key) ? 'opacity-60' : ''"
            >
              <USwitch
                :model-value="!mutedCategories.includes(item.key)"
                size="sm"
                :aria-label="`Aktifkan ${item.label}`"
                @update:model-value="toggleMute(item.key)"
              />
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 text-left"
                @click="toggleMute(item.key)"
              >
                <UIcon :name="item.icon" class="size-4 shrink-0 text-muted" />
                <span class="truncate text-xs font-medium text-default">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </section>

        <USeparator />

        <!-- Quiet hours -->
        <section class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-medium text-highlighted">
                Jam tenang
              </h3>
              <p class="text-xs text-muted">
                Tahan notifikasi non-kritis pada rentang jam ini. Notifikasi kritis tetap masuk.
              </p>
            </div>
            <USwitch v-model="quietEnabled" />
          </div>
          <div v-if="quietEnabled" class="flex items-center gap-2">
            <UInput
              v-model="quietStart"
              type="time"
              size="sm"
              class="w-32"
              aria-label="Jam mulai tenang"
            />
            <span class="text-xs text-muted">sampai</span>
            <UInput
              v-model="quietEnd"
              type="time"
              size="sm"
              class="w-32"
              aria-label="Jam selesai tenang"
            />
          </div>
        </section>

        <USeparator />

        <!-- Suara & notifikasi OS -->
        <section class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-medium text-highlighted">
                Suara
              </h3>
              <p class="text-xs text-muted">
                Bunyikan nada singkat saat notifikasi baru masuk.
              </p>
            </div>
            <USwitch v-model="soundEnabled" />
          </div>

          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-medium text-highlighted">
                Notifikasi sistem
              </h3>
              <p class="text-xs text-muted">
                Tampilkan pemberitahuan dari sistem operasi saat aplikasi terbuka.
              </p>
              <p v-if="osPermission === 'denied'" class="mt-1 text-xs text-red-500">
                Izin notifikasi diblokir di browser. Aktifkan lewat pengaturan situs.
              </p>
              <p v-else-if="osPermission === 'unsupported'" class="mt-1 text-xs text-amber-500">
                Browser ini tidak mendukung notifikasi sistem.
              </p>
            </div>
            <USwitch
              :model-value="osNotificationEnabled"
              :disabled="osPermission === 'unsupported'"
              @update:model-value="enableOsNotification($event as boolean)"
            />
          </div>
        </section>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          label="Simpan"
          icon="i-lucide-check"
          :loading="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
