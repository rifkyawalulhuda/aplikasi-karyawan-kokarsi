<script setup lang="ts">
interface DocumentType {
  id: number
  name: string
  documentType: string  // e.g. 'KTP', 'SIM', 'NPWP', etc.
  code?: string
}

interface EmployeeDocument {
  id: number
  employeeId: number
  documentTypeId: number
  documentType: DocumentType
  documentNumber?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  status: 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED'
  notes?: string | null
  fileUrl?: string | null
  createdAt: string
  updatedAt: string
}

interface Employee {
  id: number
  fullName: string
  employeeNo?: string | null
  fotoKaryawan?: string | null
}

interface DocumentListResponse {
  data: EmployeeDocument[]
  total?: number
}

const props = defineProps<{
  open: boolean
  employeeId: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// --- Local open state (v-model bridge) ---
const localOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

// --- Form modal state ---
const formOpen = ref(false)
const editingDoc = ref<EmployeeDocument | null>(null)

function openAddForm() {
  editingDoc.value = null
  formOpen.value = true
}

function openEditForm(doc: EmployeeDocument) {
  editingDoc.value = doc
  formOpen.value = true
}

// --- Helpers ---
function formatDate(date: string | null | undefined) {
  if (!date) return 'Tidak ada masa berlaku'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// --- Status maps ---
const statusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_EXPIRED: 'warning',
  EXPIRED: 'error',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_EXPIRED: 'Akan Expired',
  EXPIRED: 'Expired',
}

// --- Worst status badge (header) ---
const worstStatusPriority: Record<string, number> = {
  EXPIRED: 3,
  AKAN_EXPIRED: 2,
  AKTIF: 1,
}

const worstStatus = computed(() => {
  if (!documents.value.length) return null
  return documents.value.reduce((worst, doc) => {
    const p = worstStatusPriority[doc.status] ?? 0
    const wp = worstStatusPriority[worst] ?? 0
    return p > wp ? doc.status : worst
  }, documents.value[0].status)
})

// --- Fetch employee info ---
const employeeData = ref<Employee | null>(null)

async function fetchEmployee(id: number | null) {
  if (!id) return
  try {
    employeeData.value = await $fetch<Employee>(`/api/employees/${id}`)
  } catch { /* non-fatal */ }
}

const employee = computed(() => employeeData.value ?? null)

// --- Fetch documents ---
const {
  data: docsData,
  pending: loading,
  error,
  refresh,
} = useFetch<DocumentListResponse | EmployeeDocument[]>('/api/employee-documents', {
  query: computed(() => ({
    employeeId: props.employeeId,
    limit: 100,
  })),
  watch: [() => props.employeeId],
  immediate: false,
  server: false,
})

// Trigger fetch when employeeId changes (immediate: true so it fires on first open)
watch(() => props.employeeId, (id) => {
  fetchEmployee(id)
  if (id) refresh()
}, { immediate: true })

const documents = computed<EmployeeDocument[]>(() => {
  if (!docsData.value) return []
  if (Array.isArray(docsData.value)) return docsData.value
  return (docsData.value as DocumentListResponse).data ?? []
})

// --- Summary counts ---
const countAktif = computed(() => documents.value.filter((d) => d.status === 'AKTIF').length)
const countAkanExpired = computed(() => documents.value.filter((d) => d.status === 'AKAN_EXPIRED').length)
const countExpired = computed(() => documents.value.filter((d) => d.status === 'EXPIRED').length)

// --- Split documents into sections ---
// Kode documentType yang termasuk Dokumen Pribadi (bukan Sertifikasi & Ijin)
const PERSONAL_DOC_CODES = ['KTP', 'SIM', 'NPWP', 'KK', 'PASPOR', 'BPJS_TK', 'BPJS_KES', 'IJAZAH', 'SERTIFIKAT']

const personalDocs = computed(() =>
  documents.value.filter(d => PERSONAL_DOC_CODES.includes(d.documentType?.documentType ?? ''))
)

const sertifikasiDocs = computed(() =>
  documents.value.filter(d => !PERSONAL_DOC_CODES.includes(d.documentType?.documentType ?? ''))
)

// --- Delete ---
const { confirmActionToast } = useConfirmActionToast()

function deleteDoc(id: number) {
  confirmActionToast({
    title: 'Hapus Dokumen',
    description: 'Dokumen ini akan dihapus secara permanen. Lanjutkan?',
    icon: 'i-lucide-trash-2',
    color: 'error',
    confirmLabel: 'Hapus',
    confirmColor: 'error',
    onConfirm: async () => {
      await $fetch(`/api/employee-documents/${id}`, { method: 'DELETE' })
      refresh()
    },
  })
}
</script>

<template>
  <USlideover
    v-model:open="localOpen"
    side="right"
    size="lg"
  >
    <template #header>
      <div class="flex items-center gap-3 w-full min-w-0">
        <!-- Avatar -->
        <div class="shrink-0">
          <img
            v-if="employee?.fotoKaryawan"
            :src="employee.fotoKaryawan"
            :alt="employee.fullName"
            class="size-10 rounded-full object-cover"
          />
          <div
            v-else
            class="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold"
          >
            {{ employee ? getInitials(employee.fullName) : '?' }}
          </div>
        </div>

        <!-- Name + ID -->
        <div class="min-w-0 flex-1">
          <p class="text-base font-semibold text-highlighted truncate">
            {{ employee?.fullName ?? '—' }}
          </p>
          <p v-if="employee?.employeeNo" class="text-xs text-muted font-mono">
            {{ employee.employeeNo }}
          </p>
        </div>

        <!-- Worst status badge -->
        <UBadge
          v-if="worstStatus"
          :label="statusLabel[worstStatus] ?? worstStatus"
          :color="statusColor[worstStatus] ?? 'neutral'"
          variant="subtle"
          size="sm"
          class="shrink-0"
        />
      </div>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex flex-col items-center gap-2 py-16 text-error">
        <UIcon name="i-lucide-alert-circle" class="size-8" />
        <p class="text-sm">Gagal memuat dokumen karyawan</p>
      </div>

      <div v-else class="p-4 space-y-4">
        <!-- Summary badges -->
        <div class="flex gap-2 flex-wrap">
          <UBadge
            :label="`Total: ${documents.length}`"
            color="neutral"
            variant="subtle"
          />
          <UBadge
            :label="`Aktif: ${countAktif}`"
            color="success"
            variant="subtle"
          />
          <UBadge
            :label="`Akan Expired: ${countAkanExpired}`"
            color="warning"
            variant="subtle"
          />
          <UBadge
            :label="`Expired: ${countExpired}`"
            color="error"
            variant="subtle"
          />
        </div>

        <!-- Section 1: Dokumen Pribadi -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-id-card" class="size-4 text-primary" />
              <h3 class="text-sm font-semibold text-highlighted">Dokumen Pribadi</h3>
              <UBadge :label="String(personalDocs.length)" variant="subtle" color="neutral" size="xs" />
            </div>
            <UButton
              icon="i-lucide-plus"
              size="xs"
              label="Tambah"
              @click="openAddForm"
            />
          </div>

          <div v-if="personalDocs.length === 0" class="text-xs text-muted italic py-2">
            Belum ada dokumen pribadi
          </div>

          <div
            v-for="doc in personalDocs"
            :key="doc.id"
            class="border border-default rounded-lg p-3 flex items-start gap-3"
          >
            <UIcon name="i-lucide-file-text" class="size-4 text-muted mt-0.5 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-highlighted truncate">{{ doc.documentType?.name ?? '—' }}</p>
              <p v-if="doc.documentNumber" class="text-xs font-mono text-muted">{{ doc.documentNumber }}</p>
              <p class="text-xs text-muted mt-0.5">
                Masa berlaku:
                <span :class="doc.expiryDate ? '' : 'italic'">
                  {{ doc.expiryDate ? formatDate(doc.expiryDate) : 'Tidak ada masa berlaku' }}
                </span>
              </p>
              <p v-if="doc.notes" class="text-xs text-muted mt-1 whitespace-pre-wrap">{{ doc.notes }}</p>
            </div>
            <div class="flex flex-col items-end gap-2 shrink-0">
              <UBadge :label="statusLabel[doc.status] ?? doc.status" :color="statusColor[doc.status] ?? 'neutral'" variant="subtle" size="xs" />
              <div class="flex gap-1">
                <a v-if="doc.fileUrl" :href="doc.fileUrl" target="_blank">
                  <UButton icon="i-lucide-download" size="xs" color="neutral" variant="ghost" aria-label="Unduh" />
                </a>
                <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" aria-label="Edit" @click="openEditForm(doc)" />
                <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" aria-label="Hapus" @click="deleteDoc(doc.id)" />
              </div>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <USeparator v-if="sertifikasiDocs.length > 0" class="my-2" />

        <!-- Section 2: Sertifikasi & Ijin (read-only, only shown if data exists) -->
        <div v-if="sertifikasiDocs.length > 0" class="space-y-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-award" class="size-4 text-warning" />
            <h3 class="text-sm font-semibold text-highlighted">Sertifikasi & Ijin</h3>
            <UBadge :label="String(sertifikasiDocs.length)" variant="subtle" color="warning" size="xs" />
            <UBadge label="Dari halaman Sertifikasi & Ijin" variant="subtle" color="neutral" size="xs" />
          </div>

          <div
            v-for="doc in sertifikasiDocs"
            :key="doc.id"
            class="border border-default rounded-lg p-3 flex items-start gap-3"
          >
            <UIcon name="i-lucide-file-text" class="size-4 text-muted mt-0.5 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-highlighted truncate">{{ doc.documentType?.name ?? '—' }}</p>
              <p v-if="doc.documentNumber" class="text-xs font-mono text-muted">{{ doc.documentNumber }}</p>
              <p class="text-xs text-muted mt-0.5">
                Masa berlaku:
                <span :class="doc.expiryDate ? '' : 'italic'">
                  {{ doc.expiryDate ? formatDate(doc.expiryDate) : 'Tidak ada masa berlaku' }}
                </span>
              </p>
              <p v-if="doc.notes" class="text-xs text-muted mt-1 whitespace-pre-wrap">{{ doc.notes }}</p>
            </div>
            <div class="flex flex-col items-end gap-2 shrink-0">
              <UBadge :label="statusLabel[doc.status] ?? doc.status" :color="statusColor[doc.status] ?? 'neutral'" variant="subtle" size="xs" />
              <div class="flex gap-1">
                <a v-if="doc.fileUrl" :href="doc.fileUrl" target="_blank">
                  <UButton icon="i-lucide-download" size="xs" color="neutral" variant="ghost" aria-label="Unduh" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>

  <!-- Form modal -->
  <DokKaryawanFormModal
    v-model:open="formOpen"
    :employee-id="employeeId"
    :doc="editingDoc"
    @saved="refresh()"
  />
</template>
