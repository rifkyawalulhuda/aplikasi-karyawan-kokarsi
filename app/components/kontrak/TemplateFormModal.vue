<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ContractTemplate } from '~/types'

interface LookupItem { id: number, name: string }

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit' | 'duplicate'
  template: ContractTemplate | null
  /** Template sumber saat menduplikat (konten diambil dari versi terbit terakhir). */
  source: ContractTemplate | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
  'duplicated': [template: ContractTemplate]
}>()

const toast = useToast()
const formId = useId()
const saving = ref(false)

const { data: contractTypesRes } = await useFetch<LookupItem[]>('/api/lookups/contract-types')
const { data: jobRolesRes } = await useFetch<LookupItem[]>('/api/lookups/job-roles')

const contractTypeOptions = computed(() =>
  (contractTypesRes.value ?? []).map(item => ({ label: item.name, value: item.id }))
)
const jobRoleOptions = computed(() =>
  (jobRolesRes.value ?? []).map(item => ({ label: item.name, value: item.id }))
)

const TEMPLATE_KEY_OPTIONS: Record<string, { label: string, value: string }[]> = {
  PKWT: [
    { label: 'PKWT_DRIVER — Driver', value: 'PKWT_DRIVER' },
    { label: 'PKWT_KASIR — Kasir', value: 'PKWT_KASIR' },
    { label: 'PKWT_STAFF — Staff', value: 'PKWT_STAFF' },
    { label: 'PKWT_WAREHOUSE — Karyawan Gudang', value: 'PKWT_WAREHOUSE' }
  ],
  MITRA: [
    { label: 'MITRA_DRIVER — Driver', value: 'MITRA_DRIVER' },
    { label: 'MITRA_DRIVER_TRUCK_B3 — Driver Truk B3', value: 'MITRA_DRIVER_TRUCK_B3' },
    { label: 'MITRA_KOMART — Kasir Kopmart', value: 'MITRA_KOMART' },
    { label: 'MITRA_STAFF — Staff', value: 'MITRA_STAFF' },
    { label: 'MITRA_WAREHOUSE — Karyawan Gudang', value: 'MITRA_WAREHOUSE' }
  ]
}

const ALL_TEMPLATE_KEYS = [
  'PKWT_DRIVER', 'PKWT_KASIR', 'PKWT_STAFF', 'PKWT_WAREHOUSE',
  'MITRA_DRIVER', 'MITRA_DRIVER_TRUCK_B3', 'MITRA_KOMART', 'MITRA_STAFF', 'MITRA_WAREHOUSE'
] as const

const state = reactive({
  code: '',
  name: '',
  family: 'PKWT' as 'PKWT' | 'MITRA',
  templateKey: undefined as string | undefined,
  contractTypeId: undefined as number | undefined,
  jobRoleId: undefined as number | undefined,
  description: '',
  notes: '',
  isActive: true
})

const isDuplicate = computed(() => props.mode === 'duplicate')
const isEdit = computed(() => props.mode === 'edit')
const isLockedMapping = computed(() => isDuplicate.value)

const title = computed(() => {
  if (isDuplicate.value) return 'Duplikat Template'
  if (isEdit.value) return 'Edit Template'
  return 'Tambah Template'
})

const description = computed(() => {
  if (isDuplicate.value) return 'Salinan dibuat sebagai DRAFT — tinjau lalu terbitkan.'
  if (isEdit.value) return `Perbarui detail template ${props.template?.name ?? ''}.`
  return 'Tentukan identitas dan pemetaan dokumen template.'
})

const templateKeyOptions = computed(() => TEMPLATE_KEY_OPTIONS[state.family] ?? [])

const familyOptions = [
  {
    value: 'PKWT' as const,
    label: 'PKWT',
    description: 'Kesepakatan Kerja Waktu Tertentu untuk karyawan.',
    icon: 'i-lucide-file-check'
  },
  {
    value: 'MITRA' as const,
    label: 'MITRA',
    description: 'Perjanjian kemitraan untuk tenaga mitra.',
    icon: 'i-lucide-handshake'
  }
]

const fieldUi = { error: 'mt-2 text-xs text-error-600 dark:text-error-400' }

const schema = computed(() => z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Kode minimal 3 karakter')
    .max(50, 'Kode maksimal 50 karakter')
    .refine(value => /^[A-Za-z0-9_-]+$/.test(value), 'Gunakan huruf, angka, garis bawah, atau tanda hubung'),
  name: z.string().trim().min(3, 'Nama minimal 3 karakter').max(120, 'Nama maksimal 120 karakter'),
  family: z.enum(['PKWT', 'MITRA'], { error: 'Keluarga wajib dipilih' }),
  templateKey: z.string({ error: 'Pilih template key yang valid' }).refine(
    value => (ALL_TEMPLATE_KEYS as readonly string[]).includes(value),
    'Pilih template key yang valid'
  ),
  contractTypeId: z.number().optional(),
  jobRoleId: z.number().optional(),
  description: z.string().max(500, 'Deskripsi maksimal 500 karakter').optional(),
  notes: z.string().max(1000, 'Catatan maksimal 1000 karakter').optional(),
  isActive: z.boolean()
}).superRefine((value, ctx) => {
  const validKeys = (TEMPLATE_KEY_OPTIONS[value.family] ?? []).map(option => option.value)
  if (value.templateKey && !validKeys.includes(value.templateKey)) {
    ctx.addIssue({
      code: 'custom',
      path: ['templateKey'],
      message: `Template key tidak cocok dengan keluarga ${value.family}`
    })
  }
}))

type Schema = z.output<typeof schema.value>

// Ganti keluarga → template key lama tidak valid lagi.
watch(() => state.family, (family) => {
  if (isLockedMapping.value) return
  const validKeys = (TEMPLATE_KEY_OPTIONS[family] ?? []).map(option => option.value)
  if (state.templateKey && !validKeys.includes(state.templateKey)) {
    state.templateKey = undefined
  }
})

function resetForm() {
  state.code = ''
  state.name = ''
  state.family = 'PKWT'
  state.templateKey = undefined
  state.contractTypeId = undefined
  state.jobRoleId = undefined
  state.description = ''
  state.notes = ''
  state.isActive = true
}

function fillFrom(template: ContractTemplate) {
  state.code = template.code
  state.name = template.name
  state.family = template.family
  state.templateKey = template.templateKey
  state.contractTypeId = template.contractTypeId ?? undefined
  state.jobRoleId = template.jobRoleId ?? undefined
  state.description = template.description ?? ''
  state.notes = template.notes ?? ''
  state.isActive = template.isActive
}

watch(() => props.open, (open) => {
  if (!open) return
  if (isDuplicate.value && props.source) {
    resetForm()
    fillFrom(props.source)
    // Kode unik di database: dikosongkan agar admin sadar perlu kode baru.
    state.code = ''
    state.name = `${props.source.name} (Salinan)`
    state.isActive = true
    return
  }
  if (isEdit.value && props.template) {
    fillFrom(props.template)
    return
  }
  resetForm()
}, { immediate: true })

function apiErrorMessage(error: unknown, fallback: string) {
  const e = error as { data?: { message?: string }, message?: string }
  return e?.data?.message ?? e?.message ?? fallback
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  const source = props.source
  try {
    if (isDuplicate.value && source) {
      // `family`/`templateKey` tidak dikirim: backend mewarisinya dari sumber.
      const created = await $fetch<ContractTemplate>(`/api/contract-templates/${source.id}/duplicate`, {
        method: 'POST',
        body: {
          code: event.data.code,
          name: event.data.name,
          contractTypeId: event.data.contractTypeId,
          jobRoleId: event.data.jobRoleId,
          description: event.data.description,
          notes: event.data.notes,
          isActive: event.data.isActive
        }
      })
      toast.add({
        title: 'Template diduplikat',
        description: `Konten disalin dari versi terbit "${source.name}". Salinan masih DRAFT — tinjau lalu terbitkan.`,
        color: 'success'
      })
      emit('duplicated', created)
      emit('update:open', false)
      resetForm()
      return
    }

    if (isEdit.value && props.template) {
      await $fetch(`/api/contract-templates/${props.template.id}`, { method: 'PUT', body: event.data })
      toast.add({ title: 'Template kontrak diperbarui', color: 'success' })
    } else {
      await $fetch('/api/contract-templates', { method: 'POST', body: event.data })
      toast.add({ title: 'Template kontrak ditambahkan', color: 'success' })
    }

    emit('saved')
    emit('update:open', false)
    resetForm()
  } catch (error) {
    toast.add({
      title: isDuplicate.value ? 'Gagal menduplikat template' : 'Gagal menyimpan template',
      description: apiErrorMessage(error, 'Terjadi kesalahan'),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

function onFormError(event: { errors?: { id?: string, name?: string }[] }) {
  const first = event.errors?.[0]
  nextTick(() => {
    requestAnimationFrame(() => {
      const byId = first?.id ? document.getElementById(first.id) : null
      const byName = first?.name
        ? document.querySelector<HTMLElement>(`[data-template-form] [data-field="${first.name}"]`)
        : null
      const byInvalid = document.querySelector<HTMLElement>('[data-template-form] [aria-invalid="true"]')
      const target = byId ?? byName ?? byInvalid
      if (!target) return
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  })
}

const selectedKeyLabel = computed(() => {
  const option = templateKeyOptions.value.find(item => item.value === state.templateKey)
  return option?.label.split(' — ')[1] ?? '—'
})
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-2xl', header: 'relative' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex w-full items-start gap-3 pr-10">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UIcon
            :name="isDuplicate ? 'i-lucide-copy' : isEdit ? 'i-lucide-pencil' : 'i-lucide-file-plus'"
            class="size-5"
            aria-hidden="true"
          />
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-highlighted">
            {{ title }}
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ description }}
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
        data-template-form
        @submit="onSubmit"
        @error="onFormError"
      >
        <div
          v-if="isDuplicate"
          class="flex items-start gap-2 rounded-xl border border-info/30 bg-info/10 p-3 text-xs leading-relaxed text-muted"
        >
          <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <span>
            Konten disalin dari versi terbit terakhir
            <span class="font-medium text-highlighted">{{ source?.name }}</span>.
            Keluarga dan template key mengikuti sumber, sedangkan
            <span class="font-medium text-highlighted">kode harus baru</span>.
          </span>
        </div>

        <!-- Identitas -->
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-tag" class="size-4 text-muted" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-highlighted">
              Identitas Template
            </h3>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Kode"
              name="code"
              required
              hint="Unik, dipakai sebagai referensi internal"
              :ui="fieldUi"
            >
              <UInput
                v-model="state.code"
                class="w-full font-mono"
                placeholder="PKWT_STAFF_ADMIN"
                autocomplete="off"
                data-field="code"
              />
            </UFormField>

            <UFormField
              label="Nama template"
              name="name"
              required
              :ui="fieldUi"
            >
              <UInput
                v-model="state.name"
                class="w-full"
                placeholder="PKWT Staff Admin"
                autocomplete="off"
                data-field="name"
              />
            </UFormField>
          </div>

          <UFormField
            label="Deskripsi"
            name="description"
            :ui="fieldUi"
            :hint="`${state.description.length}/500`"
          >
            <UTextarea
              v-model="state.description"
              :rows="2"
              class="w-full"
              placeholder="Ringkasan singkat kegunaan template ini (opsional)"
              data-field="description"
            />
          </UFormField>
        </section>

        <div class="border-t border-default" />

        <!-- Pemetaan dokumen -->
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-file-cog" class="size-4 text-muted" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-highlighted">
              Pemetaan Dokumen
            </h3>
          </div>

          <UFormField
            label="Keluarga"
            name="family"
            required
            :hint="isLockedMapping ? 'Mengikuti template sumber' : undefined"
            :ui="fieldUi"
          >
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="option in familyOptions"
                :key="option.value"
                type="button"
                class="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                :class="[
                  state.family === option.value
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-default bg-elevated/20 hover:border-primary/30 hover:bg-elevated/40',
                  isLockedMapping ? 'cursor-not-allowed opacity-70' : ''
                ]"
                :disabled="isLockedMapping"
                :aria-pressed="state.family === option.value"
                data-field="family"
                @click="state.family = option.value"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  :class="state.family === option.value ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
                >
                  <UIcon :name="option.icon" class="size-4" aria-hidden="true" />
                </span>
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
                    {{ option.label }}
                    <UIcon
                      v-if="state.family === option.value"
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
            label="Template key"
            name="templateKey"
            required
            :hint="isLockedMapping ? 'Mengikuti template sumber' : 'Menentukan struktur pasal dokumen PDF'"
            :ui="fieldUi"
          >
            <USelect
              v-model="state.templateKey"
              :items="templateKeyOptions"
              placeholder="Pilih template key..."
              :disabled="isLockedMapping"
              class="w-full"
              data-field="templateKey"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Tipe kontrak"
              name="contractTypeId"
              :ui="fieldUi"
              hint="Opsional"
            >
              <USelect
                v-model="state.contractTypeId"
                :items="contractTypeOptions"
                placeholder="Semua tipe"
                class="w-full"
                data-field="contractTypeId"
              />
            </UFormField>

            <UFormField
              label="Jabatan"
              name="jobRoleId"
              :ui="fieldUi"
              hint="Opsional"
            >
              <USelect
                v-model="state.jobRoleId"
                :items="jobRoleOptions"
                placeholder="Semua jabatan"
                class="w-full"
                data-field="jobRoleId"
              />
            </UFormField>
          </div>
        </section>

        <div class="border-t border-default" />

        <!-- Catatan & status -->
        <section class="space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-notebook-pen" class="size-4 text-muted" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-highlighted">
              Catatan & Status
            </h3>
          </div>

          <UFormField
            label="Catatan internal"
            name="notes"
            :ui="fieldUi"
            hint="Tidak tercetak di dokumen"
          >
            <UTextarea
              v-model="state.notes"
              :rows="2"
              class="w-full"
              placeholder="Catatan untuk admin lain (opsional)"
              data-field="notes"
            />
          </UFormField>

          <label class="flex items-start gap-3 rounded-xl border border-default bg-elevated/30 p-3">
            <USwitch v-model="state.isActive" class="mt-0.5" aria-label="Template aktif" />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-highlighted">Template aktif</span>
              <span class="mt-0.5 block text-xs leading-relaxed text-muted">
                Template nonaktif tidak muncul sebagai pilihan saat membuat atau memperpanjang kontrak.
                Kontrak lama tetap aman.
              </span>
            </span>
          </label>
        </section>

        <!-- Ringkasan -->
        <div class="flex items-start gap-3 rounded-xl border border-default bg-elevated/30 p-3">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon
              :name="state.family === 'PKWT' ? 'i-lucide-file-check' : 'i-lucide-handshake'"
              class="size-4"
              aria-hidden="true"
            />
          </span>
          <div class="min-w-0 text-xs leading-relaxed text-muted">
            <p class="text-sm font-medium text-highlighted">
              {{ state.name || 'Nama template' }}
            </p>
            <p class="mt-0.5">
              {{ state.family }} · {{ selectedKeyLabel }} ·
              <span class="font-mono">{{ state.code || 'KODE' }}</span>
            </p>
          </div>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <p class="hidden text-xs text-muted sm:block">
          Template key menentukan konten dokumen PDF.
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
            :label="isDuplicate ? 'Duplikat Template' : isEdit ? 'Simpan Perubahan' : 'Simpan Template'"
            :icon="isDuplicate ? 'i-lucide-copy' : 'i-lucide-check'"
            color="primary"
            :loading="saving"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
