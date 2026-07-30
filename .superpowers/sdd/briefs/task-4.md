# Task 4: Frontend EmailConfigTab Component

## Objective
Create a Vue 3 component `app/components/settings/EmailConfigTab.vue` that renders the Email Config tab UI.

## File to Create
- `app/components/settings/EmailConfigTab.vue`

## Reference Files to Read First
- `app/pages/settings/index.vue` — study the pattern for useFetch, reactive forms, toast, UCard, UForm, UToggle, UIcon, UModal, watchEffect
- `app/types/index.d.ts` — to see the `EmailNotificationConfig` and `EmailNotificationUser` types added in Task 8
- Any existing component in `app/components/` for style reference

## UI Structure

The component has these sections inside a `div` wrapper (no outer page wrapper needed — settings/index.vue handles layout):

### Section 1 — Global Toggle (UCard)
```
UCard with header "Notifikasi Email"
  UToggle v-model="form.isEnabled" with label "Aktifkan Notifikasi Email"
  Hint text when disabled: "Notifikasi email dinonaktifkan. Tidak ada email yang akan dikirim."
```

### Section 2 — Trigger Windows (UCard, shown always but dimmed if !form.isEnabled)
```
UCard with header "Hari Pengiriman"
Description: "Email akan dikirim N hari sebelum kontrak/sertifikasi habis"

Current windows: displayed as badges/chips
  - Each badge shows the number + " hari" 
  - Each badge has an X button to remove it
  - Badge color: "warning" if <= 7 days, "info" otherwise
  - 0 days shows as "Hari H" instead of "0 hari"

Add new window input:
  - Number input (min=0) 
  - "Tambah" button
  - Validation: must be a non-negative integer, no duplicates
  - Error message shown inline if validation fails
```

### Section 3 — Recipients (UCard, shown always but dimmed if !form.isEnabled)
```
UCard with header "Penerima Notifikasi"
Description: "User yang akan menerima email notifikasi"

List of all users as checkboxes:
  - Fetch from /api/settings/email-config-users
  - Each row: checkbox + user name + email (muted)
  - Checked if user.id is in form.recipientUserIds
  - Empty state: "Belum ada user terdaftar" if allUsers is empty

Selected count shown: "X penerima dipilih"
```

### Section 4 — Save Button
```
UButton "Simpan Konfigurasi" color="primary"
  - Disabled if saving
  - Loading state while saving
  - onClick: opens confirmation modal

UModal (confirm dialog):
  Title: "Konfirmasi Perubahan"
  Body: "Perubahan konfigurasi akan langsung berlaku pada cron berikutnya. Lanjutkan?"
  Buttons: "Batal" (cancel) + "Ya, Simpan" (confirm, triggers save)
```

## Script Setup

```typescript
import type { EmailNotificationConfig, EmailNotificationUser } from '~/types'

const toast = useToast()

// Fetch config
const { data: config, refresh } = await useFetch<EmailNotificationConfig>('/api/settings/email-config')

// Fetch all users
const { data: allUsers } = await useFetch<EmailNotificationUser[]>('/api/settings/email-config-users')

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
```

## Style Notes
- Use `UCard` with `class="mb-4"` between sections
- Dimmed sections when disabled: add `class="opacity-50 pointer-events-none"` on the UCard wrapper when `!form.isEnabled`
- UBadge for trigger window chips — add `cursor-pointer` X button inline
- Follow Nuxt UI component names (UCard, UButton, UToggle, UBadge, UModal, UIcon) — these are auto-imported

## Verify
Component renders without errors when viewed in the browser. TypeScript check: `npx tsc --noEmit` from the `app/` directory if a tsconfig exists there, or skip if not.

## Commit Message
`feat(frontend): EmailConfigTab component`
