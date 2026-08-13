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
const editingDoc = ref<EmployeeDocument | null | undefined>(null)

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

type BadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

// --- Status visual maps ---
const statusIcon: Record<string, string> = {
  AKTIF: 'i-lucide-shield-check',
  AKAN_EXPIRED: 'i-lucide-alert-triangle',
  EXPIRED: 'i-lucide-clock',
}

const statusRingClass: Record<string, string> = {
  AKTIF: 'bg-success/10 text-success',
  AKAN_EXPIRED: 'bg-warning/10 text-warning',
  EXPIRED: 'bg-error/10 text-error',
}

const statusBarClass: Record<string, string> = {
  AKTIF: 'bg-success',
  AKAN_EXPIRED: 'bg-warning',
  EXPIRED: 'bg-error',
}

const statusTextClass: Record<string, string> = {
  AKTIF: 'text-success',
  AKAN_EXPIRED: 'text-warning',
  EXPIRED: 'text-error',
}

// --- Document type icons ---
const docTypeIcon: Record<string, string> = {
  KTP: 'i-lucide-id-card',
  SIM: 'i-lucide-car',
  NPWP: 'i-lucide-badge-percent',
  KK: 'i-lucide-users',
  PASPOR: 'i-lucide-book-open',
  BPJS_TK: 'i-lucide-shield-plus',
  BPJS_KES: 'i-lucide-heart-pulse',
  IJAZAH: 'i-lucide-graduation-cap',
  SERTIFIKAT: 'i-lucide-award',
}

function docIcon(doc: EmployeeDocument): string {
  return docTypeIcon[doc.documentType?.documentType ?? ''] ?? 'i-lucide-file-text'
}

function isPdf(url: string): boolean {
  return url.toLowerCase().includes('.pdf')
}

// --- Days until expiry ---
function daysUntilExpiry(date: string | null | undefined): number | null {
  if (!date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(date); expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function daysText(date: string | null | undefined): string {
  const d = daysUntilExpiry(date)
  if (d === null) return ''
  if (d < 0) return `Expired ${Math.abs(d)} hari lalu`
  if (d === 0) return 'Expired hari ini'
  return `Sisa ${d} hari`
}

// --- Preview state (per dokumen, toggle accordion) ---
const previewDocId = ref<number | null>(null)

function togglePreview(docId: number) {
  previewDocId.value = previewDocId.value === docId ? null : docId
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
  }, documents.value[0]!.status)
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

watch(() => props.employeeId, () => {
  previewDocId.value = null
})

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
  <USlideover v-model:open="localOpen" side="right" size="lg">

    <!-- HEADER -->
    <template #header>
      <div class="flex items-center gap-3 w-full min-w-0">
        <!-- Avatar dengan ring status -->
        <div class="shrink-0">
          <img
            v-if="employee?.fotoKaryawan"
            :src="employee.fotoKaryawan"
            :alt="employee.fullName"
            class="size-12 rounded-full object-cover ring-2 ring-offset-2 ring-default"
          />
          <div
            v-else
            class="size-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0"
          >
            {{ employee ? getInitials(employee.fullName) : '?' }}
          </div>
        </div>
        <!-- Nama + ID -->
        <div class="min-w-0 flex-1">
          <p class="text-base font-semibold text-highlighted truncate">{{ employee?.fullName ?? 'Memuat...' }}</p>
          <p v-if="employee?.employeeNo" class="text-xs text-muted font-mono">{{ employee.employeeNo }}</p>
        </div>
        <!-- Status ring worst (kanan header) -->
        <div
          v-if="worstStatus"
          class="shrink-0 flex size-9 items-center justify-center rounded-full"
          :class="statusRingClass[worstStatus]"
        >
          <UIcon :name="statusIcon[worstStatus] ?? 'i-lucide-file-badge'" class="size-4" />
        </div>
      </div>
    </template>

    <!-- BODY -->
    <template #body>
      <div class="space-y-5 p-4">

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-12 gap-3 text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
          <p class="text-sm">Memuat dokumen...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex flex-col items-center justify-center py-12 gap-3 text-muted">
          <UIcon name="i-lucide-alert-circle" class="size-8 text-error" />
          <p class="text-sm">Gagal memuat dokumen.</p>
        </div>

        <template v-else>

          <!-- Summary strip (4 stat grid) -->
          <div class="rounded-xl border border-default bg-elevated/40 p-3">
            <div class="grid grid-cols-4 gap-2 text-center">
              <div>
                <p class="text-lg font-bold tabular-nums text-highlighted">{{ documents.length }}</p>
                <p class="text-xs text-muted">Total</p>
              </div>
              <div>
                <p class="text-lg font-bold tabular-nums text-success">{{ countAktif }}</p>
                <p class="text-xs text-muted">Aktif</p>
              </div>
              <div>
                <p class="text-lg font-bold tabular-nums text-warning">{{ countAkanExpired }}</p>
                <p class="text-xs text-muted">Akan Exp.</p>
              </div>
              <div>
                <p class="text-lg font-bold tabular-nums text-error">{{ countExpired }}</p>
                <p class="text-xs text-muted">Expired</p>
              </div>
            </div>
          </div>

          <!-- SECTION: Dokumen Pribadi -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-semibold text-muted uppercase tracking-wide">Dokumen Pribadi</p>
              <UButton
                icon="i-lucide-plus"
                label="Tambah"
                size="xs"
                color="primary"
                variant="soft"
                @click="openAddForm"
              />
            </div>

            <!-- Empty state Pribadi -->
            <div v-if="personalDocs.length === 0" class="rounded-xl border border-dashed border-default bg-elevated/20 p-6 text-center">
              <UIcon name="i-lucide-folder-open" class="size-8 text-muted mx-auto mb-2 opacity-50" />
              <p class="text-sm text-muted">Belum ada dokumen pribadi.</p>
            </div>

            <!-- Card dokumen pribadi -->
            <div v-else class="space-y-2">
              <div
                v-for="doc in personalDocs"
                :key="doc.id"
                class="relative rounded-xl border border-default bg-default overflow-hidden"
              >
                <!-- Status accent bar (signature element) -->
                <span
                  class="absolute left-0 inset-y-0 w-1 rounded-l-xl"
                  :class="statusBarClass[doc.status] ?? 'bg-muted'"
                />

                <div class="p-3.5 pl-5 flex items-start gap-3">
                  <!-- Ikon dokumen spesifik -->
                  <div class="size-9 shrink-0 rounded-lg bg-elevated/60 flex items-center justify-center mt-0.5">
                    <UIcon :name="docIcon(doc)" class="size-4 text-muted" />
                  </div>

                  <!-- Info utama -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-highlighted truncate">{{ doc.documentType?.name ?? '—' }}</p>
                        <p v-if="doc.documentNumber" class="text-xs font-mono text-muted truncate">{{ doc.documentNumber }}</p>
                      </div>
                      <UBadge
                        :label="statusLabel[doc.status] ?? doc.status"
                        :color="(statusColor[doc.status] ?? 'neutral') as BadgeColor"
                        variant="subtle"
                        size="sm"
                        class="shrink-0"
                      />
                    </div>

                    <!-- Expiry + sisa hari -->
                    <div class="mt-1.5 flex items-center gap-1.5">
                      <UIcon
                        :name="statusIcon[doc.status] ?? 'i-lucide-calendar'"
                        class="size-3 shrink-0"
                        :class="doc.expiryDate ? (statusTextClass[doc.status] ?? 'text-muted') : 'text-muted'"
                      />
                      <p class="text-xs" :class="doc.expiryDate ? (statusTextClass[doc.status] ?? 'text-muted') : 'text-muted italic'">
                        <template v-if="doc.expiryDate">
                          <span class="font-medium">{{ daysText(doc.expiryDate) }}</span>
                          <span class="text-muted"> · {{ formatDate(doc.expiryDate) }}</span>
                        </template>
                        <template v-else>Tidak ada masa berlaku</template>
                      </p>
                    </div>

                    <p v-if="doc.notes" class="text-xs text-muted mt-1.5 whitespace-pre-wrap">{{ doc.notes }}</p>
                  </div>

                  <!-- Aksi: preview, unduh, edit, hapus -->
                  <div class="flex gap-1 shrink-0">
                    <UButton
                      v-if="doc.fileUrl"
                      :icon="previewDocId === doc.id ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      size="xs"
                      color="primary"
                      variant="ghost"
                      :aria-label="previewDocId === doc.id ? 'Tutup Preview' : 'Preview Dokumen'"
                      @click="togglePreview(doc.id)"
                    />
                    <a v-if="doc.fileUrl" :href="doc.fileUrl" target="_blank">
                      <UButton icon="i-lucide-download" size="xs" color="neutral" variant="ghost" aria-label="Unduh" />
                    </a>
                    <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" aria-label="Edit" @click="openEditForm(doc)" />
                    <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" aria-label="Hapus" @click="deleteDoc(doc.id)" />
                  </div>
                </div>

                <!-- Preview inline (accordion, satu sekaligus) -->
                <div v-if="previewDocId === doc.id && doc.fileUrl" class="border-t border-default mx-4 mb-4 pt-3">
                  <div class="rounded-lg overflow-hidden bg-elevated/30 max-h-[400px] overflow-y-auto">
                    <ClientOnly>
                      <PdfViewer v-if="isPdf(doc.fileUrl)" :src="doc.fileUrl" class="w-full" />
                      <img v-else :src="doc.fileUrl" :alt="doc.documentType?.name" class="w-full h-auto object-contain" />
                    </ClientOnly>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SECTION: Sertifikasi & Ijin (read-only) -->
          <div v-if="sertifikasiDocs.length > 0">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-semibold text-muted uppercase tracking-wide">Sertifikasi &amp; Ijin</p>
              <UBadge :label="`${sertifikasiDocs.length} dokumen`" color="neutral" variant="subtle" size="xs" />
            </div>

            <div class="space-y-2">
              <div
                v-for="doc in sertifikasiDocs"
                :key="doc.id"
                class="relative rounded-xl border border-default bg-default overflow-hidden"
              >
                <!-- Status accent bar -->
                <span
                  class="absolute left-0 inset-y-0 w-1 rounded-l-xl"
                  :class="statusBarClass[doc.status] ?? 'bg-muted'"
                />

                <div class="p-3.5 pl-5 flex items-start gap-3">
                  <!-- Ikon dokumen -->
                  <div class="size-9 shrink-0 rounded-lg bg-elevated/60 flex items-center justify-center mt-0.5">
                    <UIcon :name="docIcon(doc)" class="size-4 text-muted" />
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-highlighted truncate">{{ doc.documentType?.name ?? '—' }}</p>
                        <p v-if="doc.documentNumber" class="text-xs font-mono text-muted truncate">{{ doc.documentNumber }}</p>
                      </div>
                      <UBadge
                        :label="statusLabel[doc.status] ?? doc.status"
                        :color="(statusColor[doc.status] ?? 'neutral') as BadgeColor"
                        variant="subtle"
                        size="sm"
                        class="shrink-0"
                      />
                    </div>

                    <div class="mt-1.5 flex items-center gap-1.5">
                      <UIcon
                        :name="statusIcon[doc.status] ?? 'i-lucide-calendar'"
                        class="size-3 shrink-0"
                        :class="doc.expiryDate ? (statusTextClass[doc.status] ?? 'text-muted') : 'text-muted'"
                      />
                      <p class="text-xs" :class="doc.expiryDate ? (statusTextClass[doc.status] ?? 'text-muted') : 'text-muted italic'">
                        <template v-if="doc.expiryDate">
                          <span class="font-medium">{{ daysText(doc.expiryDate) }}</span>
                          <span class="text-muted"> · {{ formatDate(doc.expiryDate) }}</span>
                        </template>
                        <template v-else>Tidak ada masa berlaku</template>
                      </p>
                    </div>

                    <p v-if="doc.notes" class="text-xs text-muted mt-1.5 whitespace-pre-wrap">{{ doc.notes }}</p>
                  </div>

                  <!-- Aksi: hanya preview dan unduh (read-only) -->
                  <div class="flex gap-1 shrink-0">
                    <UButton
                      v-if="doc.fileUrl"
                      :icon="previewDocId === doc.id ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      size="xs"
                      color="primary"
                      variant="ghost"
                      :aria-label="previewDocId === doc.id ? 'Tutup Preview' : 'Preview Dokumen'"
                      @click="togglePreview(doc.id)"
                    />
                    <a v-if="doc.fileUrl" :href="doc.fileUrl" target="_blank">
                      <UButton icon="i-lucide-download" size="xs" color="neutral" variant="ghost" aria-label="Unduh" />
                    </a>
                  </div>
                </div>

                <!-- Preview inline -->
                <div v-if="previewDocId === doc.id && doc.fileUrl" class="border-t border-default mx-4 mb-4 pt-3">
                  <div class="rounded-lg overflow-hidden bg-elevated/30 max-h-[400px] overflow-y-auto">
                    <ClientOnly>
                      <PdfViewer v-if="isPdf(doc.fileUrl)" :src="doc.fileUrl" class="w-full" />
                      <img v-else :src="doc.fileUrl" :alt="doc.documentType?.name" class="w-full h-auto object-contain" />
                    </ClientOnly>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state total kosong -->
          <div v-if="!loading && documents.length === 0" class="flex flex-col items-center justify-center py-12 gap-3 text-muted">
            <UIcon name="i-lucide-folder-open" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada dokumen untuk karyawan ini.</p>
          </div>

        </template>
      </div>
    </template>

    <!-- FOOTER -->
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton label="Tutup" color="neutral" variant="subtle" @click="localOpen = false" />
      </div>
    </template>

  </USlideover>

  <!-- Form modal -->
  <DokKaryawanFormModal
    v-model:open="formOpen"
    :employee-id="employeeId"
    :doc="editingDoc as any"
    @saved="refresh()"
  />
</template>
