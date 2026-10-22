<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AdminRole, UserAccount } from '~/types'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  user: UserAccount | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const formId = useId()
const submitting = ref(false)
const showPassword = ref(false)

interface UserFormState {
  name: string
  nik: string
  email: string
  role: AdminRole
  username: string
  password: string
}

const state = reactive<UserFormState>({
  name: '',
  nik: '',
  email: '',
  role: 'PENGELOLA_KOPERASI',
  username: '',
  password: ''
})

const isCreate = computed(() => props.mode === 'create')

// Pesan error memakai shade lebih gelap di mode terang agar kontras = 4.5:1
// untuk teks kecil (default text-error hanya ~3.8:1 di atas kartu putih).
const fieldUi = { error: 'mt-2 text-xs text-error-600 dark:text-error-400' }

const schema = computed(() => z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(120, 'Nama maksimal 120 karakter'),
  nik: z.string().trim().min(1, 'NIK wajib diisi').max(50, 'NIK maksimal 50 karakter'),
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi')
    .refine(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Format email tidak valid (contoh: nama@domain.com)'),
  role: z.enum(['ADMIN', 'PENGELOLA_KOPERASI'], { error: 'Role wajib dipilih' }),
  username: z
    .string()
    .trim()
    .min(1, 'Username wajib diisi')
    .max(50, 'Username maksimal 50 karakter')
    .refine(value => /^[a-zA-Z0-9._-]+$/.test(value), 'Gunakan huruf, angka, titik, garis bawah, atau tanda hubung'),
  password: z.string()
}).superRefine((value, ctx) => {
  // Backend mewajibkan minimal 6 karakter. Pada mode edit, kosong = tidak diubah.
  if (!isCreate.value && !value.password) return
  if (!value.password) {
    ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password wajib diisi' })
    return
  }
  if (value.password.length < 6) {
    ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password minimal 6 karakter' })
  }
}))

type Schema = z.output<typeof schema.value>

const roleOptions: Array<{ label: string, value: AdminRole, description: string, icon: string }> = [
  {
    label: 'Admin',
    value: 'ADMIN',
    description: 'Akses penuh: master data, template kontrak, user, dan log aktivitas.',
    icon: 'i-lucide-shield-check'
  },
  {
    label: 'Pengelola Koperasi',
    value: 'PENGELOLA_KOPERASI',
    description: 'Operasional harian tanpa akses pengaturan sistem dan data user.',
    icon: 'i-lucide-user-cog'
  }
]

const passwordRules = computed(() => {
  const value = state.password
  return [
    { key: 'length', label: 'Minimal 6 karakter', met: value.length >= 6 },
    { key: 'mix', label: 'Kombinasi huruf & angka', met: /[a-zA-Z]/.test(value) && /[0-9]/.test(value) },
    { key: 'symbol', label: 'Satu simbol (disarankan)', met: /[^A-Za-z0-9]/.test(value) }
  ]
})

const passwordHint = computed(() => {
  if (isCreate.value) return 'Dipakai untuk login pertama pengguna ini.'
  return 'Kosongkan bila password tidak ingin diubah.'
})

// ── Sinkronisasi saat modal dibuka ──────────────────────────────────────────
function resetForm() {
  state.name = ''
  state.nik = ''
  state.email = ''
  state.role = 'PENGELOLA_KOPERASI'
  state.username = ''
  state.password = ''
  showPassword.value = false
}

watch(() => props.open, (open) => {
  if (!open) return
  if (props.mode === 'edit' && props.user) {
    state.name = props.user.name
    state.nik = props.user.nik
    state.email = props.user.email
    state.role = props.user.role
    state.username = props.user.username
    state.password = ''
  } else {
    resetForm()
  }
}, { immediate: true })

// ── Simpan ─────────────────────────────────────────────────────────────────
async function onSubmit(event: FormSubmitEvent<Schema>) {
  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      name: event.data.name.trim(),
      nik: event.data.nik.trim(),
      email: event.data.email.trim(),
      role: event.data.role,
      username: event.data.username.trim()
    }
    if (event.data.password.trim()) body.password = event.data.password

    if (isCreate.value) {
      await $fetch('/api/users', { method: 'POST', body })
      toast.add({ title: 'User berhasil ditambahkan', color: 'success' })
    } else if (props.user?.id) {
      await $fetch(`/api/users/${props.user.id}`, { method: 'PUT', body })
      toast.add({ title: 'User berhasil diperbarui', color: 'success' })
    }

    emit('saved')
    emit('update:open', false)
    resetForm()
  } catch (error) {
    const fieldErrors = (error as { data?: { fieldErrors?: Record<string, string> } })?.data?.fieldErrors
    const message = (error as { data?: { message?: string } })?.data?.message
      ?? (error as { message?: string })?.message
      ?? 'Terjadi kesalahan'
    toast.add({
      title: fieldErrors ? 'Data user sudah digunakan' : 'Gagal menyimpan user',
      description: message,
      color: 'error'
    })
  } finally {
    submitting.value = false
  }
}

function onFormError(event: { errors?: { id?: string, name?: string }[] }) {
  const first = event.errors?.[0]
  nextTick(() => {
    requestAnimationFrame(() => {
      const byId = first?.id ? document.getElementById(first.id) : null
      const byName = first?.name
        ? document.querySelector<HTMLElement>(`[data-user-form] [data-field="${first.name}"]`)
        : null
      const byInvalid = document.querySelector<HTMLElement>('[data-user-form] [aria-invalid="true"]')
      const target = byId ?? byName ?? byInvalid
      if (!target) return
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  })
}

const initials = computed(() =>
  (state.name || '?')
    .trim()
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const selectedRole = computed(() =>
  roleOptions.find(option => option.value === state.role) ?? roleOptions[1]!
)
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-xl', header: 'relative' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex w-full items-start gap-3 pr-10">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UIcon :name="isCreate ? 'i-lucide-user-plus' : 'i-lucide-user-cog'" class="size-5" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-highlighted">
            {{ isCreate ? 'Tambah User' : 'Edit User' }}
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ isCreate
              ? 'Buat akun internal untuk login dengan username atau NIK.'
              : `Perbarui data akun ${user?.name ?? ''}.` }}
          </p>
        </div>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        square
        class="absolute end-2 top-2 size-9"
        aria-label="Tutup form"
        @click="emit('update:open', false)"
      />
    </template>

    <template #body>
      <UForm
        :id="formId"
        :schema="schema"
        :state="state"
        class="space-y-5"
        data-user-form
        @submit="onSubmit"
        @error="onFormError"
      >
        <!-- Identitas -->
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-id-card" class="size-4 text-muted" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-highlighted">
              Identitas
            </h3>
          </div>

          <UFormField
            label="Nama lengkap"
            name="name"
            required
            :ui="fieldUi"
          >
            <UInput
              v-model="state.name"
              class="w-full"
              placeholder="Contoh: Rina Permata"
              autocomplete="off"
              data-field="name"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="NIK"
              name="nik"
              required
              hint="Nomor identitas internal"
              :ui="fieldUi"
            >
              <UInput
                v-model="state.nik"
                class="w-full"
                placeholder="Contoh: SKY-ADM-002"
                autocomplete="off"
                data-field="nik"
              />
            </UFormField>

            <UFormField
              label="Email"
              name="email"
              required
              :ui="fieldUi"
            >
              <UInput
                v-model="state.email"
                type="email"
                class="w-full"
                placeholder="nama@domain.com"
                autocomplete="off"
                data-field="email"
              />
            </UFormField>
          </div>
        </section>

        <div class="border-t border-default" />

        <!-- Akses -->
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-key-round" class="size-4 text-muted" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-highlighted">
              Akses & Keamanan
            </h3>
          </div>

          <UFormField
            label="Username"
            name="username"
            required
            hint="Dipakai untuk login"
            :ui="fieldUi"
          >
            <UInput
              v-model="state.username"
              class="w-full"
              placeholder="Contoh: rina.permata"
              autocomplete="off"
              data-field="username"
            />
          </UFormField>

          <UFormField
            label="Role"
            name="role"
            required
            :ui="fieldUi"
          >
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="option in roleOptions"
                :key="option.value"
                type="button"
                class="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                :class="state.role === option.value
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                  : 'border-default bg-elevated/20 hover:border-primary/30 hover:bg-elevated/40'"
                :aria-pressed="state.role === option.value"
                data-field="role"
                @click="state.role = option.value"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  :class="state.role === option.value ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
                >
                  <UIcon :name="option.icon" class="size-4" aria-hidden="true" />
                </span>
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
                    {{ option.label }}
                    <UIcon
                      v-if="state.role === option.value"
                      name="i-lucide-circle-check"
                      class="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="mt-0.5 block text-xs leading-relaxed text-muted">
                    {{ option.description }}
                  </span>
                </span>
              </button>
            </div>
          </UFormField>

          <UFormField
            :label="isCreate ? 'Password' : 'Password baru'"
            name="password"
            :required="isCreate"
            :hint="isCreate ? undefined : 'Opsional'"
            :ui="fieldUi"
          >
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              class="w-full"
              :placeholder="isCreate ? 'Minimal 6 karakter' : 'Kosongkan jika tidak diubah'"
              :autocomplete="isCreate ? 'new-password' : 'off'"
              data-field="password"
            >
              <template #trailing>
                <UButton
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  color="neutral"
                  variant="ghost"
                  square
                  class="size-8 -me-1.5"
                  :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
            <p class="mt-1.5 text-xs text-muted">
              {{ passwordHint }}
            </p>
            <ul v-if="state.password" class="mt-2 grid gap-1.5 sm:grid-cols-2">
              <li
                v-for="rule in passwordRules"
                :key="rule.key"
                class="flex items-center gap-1.5 text-xs"
                :class="rule.met ? 'text-success-700 dark:text-success-400' : 'text-muted'"
              >
                <UIcon
                  :name="rule.met ? 'i-lucide-circle-check' : 'i-lucide-circle'"
                  class="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {{ rule.label }}
              </li>
            </ul>
          </UFormField>
        </section>

        <!-- Ringkasan -->
        <div class="flex items-start gap-3 rounded-xl border border-default bg-elevated/30 p-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {{ initials }}
          </div>
          <div class="min-w-0 text-xs leading-relaxed text-muted">
            <p class="text-sm font-medium text-highlighted">
              {{ state.name || 'Nama pengguna' }}
            </p>
            <p class="mt-0.5">
              <span class="font-mono">{{ state.username || 'username' }}</span>
              · {{ selectedRole.label }}
            </p>
          </div>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <p class="hidden text-xs text-muted sm:block">
          User dapat login memakai username atau NIK.
        </p>
        <div class="flex w-full justify-end gap-2 sm:w-auto">
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="emit('update:open', false)"
          />
          <UButton
            type="submit"
            :form="formId"
            :label="isCreate ? 'Simpan User' : 'Simpan Perubahan'"
            icon="i-lucide-check"
            color="primary"
            :loading="submitting"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
