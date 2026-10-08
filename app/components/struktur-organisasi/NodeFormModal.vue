<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'
import type { OrgNode, OrgPositionStatus } from '~/types/org-structure'

const props = defineProps<{
  open: boolean
  mode: 'add' | 'edit' | 'add-child'
  periodId: number
  initialData?: OrgNode | null
  parentNode?: OrgNode | null
  allNodes?: OrgNode[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const replacePhoto = ref(false)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// ── DatePicker refs ──────────────────────────────────────────────────────────
const skDateCal    = shallowRef<CalendarDate | null>(null)
const startDateCal = shallowRef<CalendarDate | null>(null)
const endDateCal   = shallowRef<CalendarDate | null>(null)

watch(skDateCal,    val => { state.skDate    = fromCalDate(val) })
watch(startDateCal, val => { state.startDate = fromCalDate(val) })
watch(endDateCal,   val => { state.endDate   = fromCalDate(val) })

// ── Lookups ──────────────────────────────────────────────────────────────────
interface EmployeeItem {
  id: number
  fullName: string
  employeeNo: string
  fotoKaryawan?: string | null
  jobRole?: { id: number; name: string } | null
  department?: { id: number; name: string } | null
}

const { data: employeesRes } = useFetch<{ data: EmployeeItem[] }>('/api/employees', {
  query: { limit: 999 },
  lazy: true,
  credentials: 'include',
})

const { data: departmentsRes } = useFetch<{ id: number; name: string }[]>('/api/lookups/departments', {
  lazy: true,
  credentials: 'include',
})

const employeeItems = computed(() =>
  (employeesRes.value?.data ?? []).map(e => ({
    label: `${e.fullName} (${e.employeeNo})`,
    value: e.id,
  })),
)

const departmentNames = computed(() => (departmentsRes.value ?? []).map(d => d.name))

// ── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  position: z.string().min(1, 'Jabatan wajib diisi'),
  unitUsaha: z.string().optional(),
  skNumber: z.string().optional(),
  skDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['AKTIF', 'AKAN_BERAKHIR', 'EXPIRED', 'TIDAK_AKTIF']).optional(),
  notes: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive({
  parentId: 0,
  employeeId: undefined as number | undefined,
  name: '',
  position: '',
  unitUsaha: '',
  skNumber: '',
  skDate: '',
  startDate: '',
  endDate: '',
  status: 'AKTIF' as OrgPositionStatus,
  sortOrder: 0,
  notes: '',
})

const statusOptions = [
  { label: 'Aktif', value: 'AKTIF' },
  { label: 'Akan Berakhir', value: 'AKAN_BERAKHIR' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Tidak Aktif', value: 'TIDAK_AKTIF' },
]

// ── Atasan options (exclude self + descendants to prevent cycle) ─────────────
const parentOptions = computed(() => {
  const nodes = props.allNodes ?? []
  const excluded = new Set<number>()
  if (props.initialData) {
    excluded.add(props.initialData.id)
    const walk = (id: number) => {
      for (const n of nodes) {
        if (n.parentId === id && !excluded.has(n.id)) {
          excluded.add(n.id)
          walk(n.id)
        }
      }
    }
    walk(props.initialData.id)
  }
  return [
    { label: '— Tanpa atasan (jabatan tertinggi) —', value: 0 },
    ...nodes
      .filter(n => !excluded.has(n.id))
      .map(n => ({ label: `${n.name} — ${n.position}`, value: n.id })),
  ]
})

const isEditMode = computed(() => props.mode === 'edit')
const title = computed(() => {
  if (props.mode === 'add') return 'Tambah Jabatan'
  if (props.mode === 'add-child') return 'Tambah Bawahan'
  return 'Edit Jabatan'
})
const hasExistingPhoto = computed(() => !!props.initialData?.photoUrl)

// ── Populate on open ─────────────────────────────────────────────────────────
watch(() => props.open, (open) => {
  if (!open) return
  selectedFile.value = null
  replacePhoto.value = false
  if (fileInput.value) fileInput.value.value = ''

  const d = props.initialData
  if (props.mode === 'edit' && d) {
    state.parentId = d.parentId ?? 0
    state.employeeId = d.employeeId ?? undefined
    state.name = d.name ?? ''
    state.position = d.position ?? ''
    state.unitUsaha = d.unitUsaha ?? ''
    state.skNumber = d.skNumber ?? ''
    state.skDate = d.skDate ? d.skDate.slice(0, 10) : ''
    state.startDate = d.startDate ? d.startDate.slice(0, 10) : ''
    state.endDate = d.endDate ? d.endDate.slice(0, 10) : ''
    state.status = d.status ?? 'AKTIF'
    state.sortOrder = d.sortOrder ?? 0
    state.notes = d.notes ?? ''
  } else {
    state.parentId = props.mode === 'add-child' ? (props.parentNode?.id ?? 0) : 0
    state.employeeId = undefined
    state.name = ''
    state.position = ''
    state.unitUsaha = ''
    state.skNumber = ''
    state.skDate = ''
    state.startDate = ''
    state.endDate = ''
    state.status = 'AKTIF'
    state.sortOrder = 0
    state.notes = ''
  }
  skDateCal.value = state.skDate ? toCalDate(state.skDate) : null
  startDateCal.value = state.startDate ? toCalDate(state.startDate) : null
  endDateCal.value = state.endDate ? toCalDate(state.endDate) : null
})

// ── Autofill from employee ───────────────────────────────────────────────────
function onEmployeeSelect(id: number | undefined | null) {
  state.employeeId = id ?? undefined
  if (!id) return
  const emp = (employeesRes.value?.data ?? []).find(e => e.id === id)
  if (!emp) return
  state.name = emp.fullName
  if (emp.jobRole?.name) state.position = emp.jobRole.name
  if (!state.unitUsaha && emp.department?.name) state.unitUsaha = emp.department.name
}

// ── File handling ────────────────────────────────────────────────────────────
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

async function uploadPhoto(nodeId: number) {
  if (!selectedFile.value) return
  const formData = new FormData()
  formData.append('photo', selectedFile.value)
  await $fetch(`/api/org-structure/nodes/${nodeId}/photo`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
}

// ── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (selectedFile.value && selectedFile.value.size > 2 * 1024 * 1024) {
    toast.add({ title: 'Ukuran foto maksimal 2MB', color: 'error' })
    return
  }

  loading.value = true
  try {
    const payload = {
      periodId: props.periodId,
      parentId: state.parentId || null,
      employeeId: state.employeeId ?? null,
      name: event.data.name,
      position: event.data.position,
      unitUsaha: event.data.unitUsaha || undefined,
      skNumber: event.data.skNumber || undefined,
      skDate: event.data.skDate || undefined,
      startDate: event.data.startDate || undefined,
      endDate: event.data.endDate || undefined,
      status: event.data.status,
      sortOrder: state.sortOrder,
      notes: event.data.notes || undefined,
    }

    let nodeId: number
    if (isEditMode.value && props.initialData) {
      await $fetch(`/api/org-structure/nodes/${props.initialData.id}`, {
        method: 'PUT',
        body: payload,
        credentials: 'include',
      })
      nodeId = props.initialData.id
    } else {
      const created = await $fetch<{ id: number }>('/api/org-structure/nodes', {
        method: 'POST',
        body: payload,
        credentials: 'include',
      })
      nodeId = created.id
    }

    if (selectedFile.value) {
      try {
        await uploadPhoto(nodeId)
      } catch {
        toast.add({ title: 'Jabatan tersimpan', description: 'Namun gagal mengunggah foto.', color: 'warning' })
        emit('saved')
        emit('update:open', false)
        return
      }
    }

    toast.add({
      title: isEditMode.value ? 'Jabatan berhasil diperbarui' : 'Jabatan berhasil ditambahkan',
      color: 'success',
    })
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    toast.add({
      title: 'Gagal menyimpan jabatan',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{ wrapper: 'items-start sm:items-center', content: 'w-full max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <!-- Karyawan (opsional) -->
        <UFormField label="Ambil dari Data Karyawan" hint="Opsional — biarkan kosong untuk pengurus/anggota luar">
          <UInputMenu
            :model-value="state.employeeId"
            :items="employeeItems"
            value-key="value"
            placeholder="Cari nama karyawan..."
            icon="i-lucide-user-search"
            class="w-full"
            :search-input="{ placeholder: 'Ketik untuk mencari...' }"
            @update:model-value="onEmployeeSelect"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Nama" name="name" required>
            <UInput v-model="state.name" placeholder="Nama lengkap" class="w-full" />
          </UFormField>
          <UFormField label="Jabatan" name="position" required>
            <UInput v-model="state.position" placeholder="Contoh: Ketua, Manajer, Kasir" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Unit Usaha / Divisi" name="unitUsaha">
            <UInputMenu
              v-model="state.unitUsaha"
              :items="departmentNames"
              create-item
              placeholder="Ketik atau pilih unit..."
              class="w-full"
              :search-input="{ placeholder: 'Cari atau tambah unit...' }"
            />
          </UFormField>
          <UFormField label="Atasan" name="parentId" hint="Struktur hierarki">
            <USelectMenu
              v-model="state.parentId"
              :items="parentOptions"
              value-key="value"
              class="w-full"
              :search-input="{ placeholder: 'Cari atasan...' }"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Nomor SK" name="skNumber">
            <UInput v-model="state.skNumber" placeholder="Contoh: 001/SK/KOP/2024" class="w-full" />
          </UFormField>
          <UFormField label="Tanggal SK" name="skDate">
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!skDateCal && 'text-muted'"
              >
                {{ skDateCal ? formatDisplay(skDateCal) : 'Pilih tanggal SK' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="skDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UFormField label="Masa Jabatan Mulai" name="startDate">
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!startDateCal && 'text-muted'"
              >
                {{ startDateCal ? formatDisplay(startDateCal) : 'Mulai' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="startDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
          <UFormField label="Masa Jabatan Selesai" name="endDate">
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!endDateCal && 'text-muted'"
              >
                {{ endDateCal ? formatDisplay(endDateCal) : 'Selesai' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="endDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
          <UFormField label="Status" name="status">
            <USelect v-model="state.status" :items="statusOptions" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Urutan Tampil" name="sortOrder" hint="Angka kecil tampil lebih dulu">
            <UInput v-model.number="state.sortOrder" type="number" min="0" class="w-full" />
          </UFormField>
        </div>

        <!-- Foto -->
        <UFormField label="Foto">
          <div class="space-y-2">
            <div v-if="hasExistingPhoto && !replacePhoto" class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm">
              <UAvatar :src="initialData!.photoUrl!" :alt="initialData!.name" size="sm" />
              <span class="min-w-0 flex-1 truncate text-muted">Foto sudah ada</span>
              <UButton label="Ganti" size="xs" color="neutral" variant="subtle" @click="replacePhoto = true" />
            </div>

            <div v-if="!hasExistingPhoto || replacePhoto">
              <input ref="fileInput" type="file" accept=".jpg,.jpeg,.png,.webp" class="hidden" @change="onFileChange">
              <div
                class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-default px-3 py-3 text-sm text-muted transition hover:border-primary hover:text-primary"
                @click="fileInput?.click()"
              >
                <UIcon name="i-lucide-upload" class="size-4 shrink-0" />
                <span v-if="!selectedFile">Klik untuk pilih foto (JPG, PNG, WEBP · maks. 2 MB)</span>
                <span v-else class="truncate text-highlighted">{{ selectedFile.name }}</span>
                <UButton
                  v-if="selectedFile"
                  icon="i-lucide-x"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="ml-auto shrink-0"
                  @click.stop="selectedFile = null"
                />
              </div>
            </div>
          </div>
        </UFormField>

        <UFormField label="Keterangan" name="notes">
          <UTextarea v-model="state.notes" placeholder="Catatan tambahan (opsional)" :rows="3" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton type="submit" label="Simpan" color="primary" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
