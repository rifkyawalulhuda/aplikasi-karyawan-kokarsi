<script setup lang="ts">
import type { Employee } from '~/types'
import type { EmployeeDocumentLike } from '~/utils/employee-metrics'

const route = useRoute()
const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const employeeId = computed(() => Number(route.params.id))

// Forward cookie dari SSR request ke Nitro API
const headers = useRequestHeaders(['cookie'])

const { data: employee, status, refresh, error } = await useFetch<Employee>(
  () => `/api/employees/${employeeId.value}`,
  {
    headers,
    watch: [employeeId]
  }
)

// Fetch dokumen karyawan (sertifikasi & ijin only — CERTIFICATION category)
const { data: docsRes } = await useFetch<{ data: EmployeeDocumentLike[], total: number }>(
  () => `/api/employee-documents?employeeId=${employeeId.value}&limit=999&documentTypeCategory=CERTIFICATION`,
  {
    credentials: 'include',
    watch: [employeeId]
  }
)
const employeeDocs = computed(() => docsRes.value?.data ?? [])

const errorMessage = computed(() => apiErrorMessage(error.value, 'Karyawan tidak ditemukan.'))

const isOffboarded = computed(() =>
  employee.value?.employmentStatus === 'RESIGN' || employee.value?.employmentStatus === 'PHK'
)

// Edit modal
const editModal = ref(false)
const editTarget = computed(() => employee.value ?? null)

// Offboarding modal
const offboardingModal = ref(false)
const offboardingTarget = computed(() => employee.value ?? null)

// Print CV modal
const printCvOpen = ref(false)

function onUpdated() {
  refresh()
  toast.add({ title: 'Data karyawan diperbarui', color: 'success' })
}

function onOffboarded() {
  refresh()
  offboardingModal.value = false
  toast.add({ title: 'Offboarding berhasil diproses', color: 'success' })
}

function onDelete() {
  if (!employee.value) return
  confirmDeleteToast({
    title: 'Hapus data karyawan?',
    description: `Data ${employee.value.fullName} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Karyawan',
    onConfirm: async () => {
      try {
        await $fetch(`/api/employees/${employeeId.value}`, { method: 'DELETE' })
        toast.add({ title: 'Karyawan dihapus', color: 'success' })
        await navigateTo('/karyawan')
      } catch (e) {
        toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
      }
    }
  })
}

useHead({
  title: computed(() => employee.value ? `${employee.value.fullName} - Detail Karyawan` : 'Detail Karyawan')
})
</script>

<template>
  <UDashboardPanel id="karyawan-detail">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/karyawan"
            aria-label="Kembali ke daftar karyawan"
          />
        </template>
        <template #title>
          <div class="flex min-w-0 items-center gap-2">
            <NuxtLink to="/karyawan" class="hidden shrink-0 text-sm text-muted transition-colors hover:text-highlighted sm:inline">
              Karyawan
            </NuxtLink>
            <UIcon v-if="employee" name="i-lucide-chevron-right" class="hidden size-3.5 shrink-0 text-muted sm:inline" />
            <span class="truncate">{{ employee?.fullName ?? 'Detail Karyawan' }}</span>
          </div>
        </template>
        <template #right>
          <UButton
            label="Cetak CV"
            icon="i-lucide-printer"
            color="neutral"
            variant="subtle"
            :disabled="!employee"
            @click="printCvOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading skeleton -->
      <div v-if="status === 'pending'" class="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <USkeleton class="h-36 w-full rounded-2xl" />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-xl" />
        </div>
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <USkeleton class="h-80 w-full rounded-2xl lg:col-span-2" />
          <USkeleton class="h-80 w-full rounded-2xl" />
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="status === 'error' || error || !employee" class="py-20 text-center">
        <UIcon name="i-lucide-user-x" class="mx-auto mb-3 size-12 text-muted" aria-hidden="true" />
        <p class="text-muted">
          {{ errorMessage }}
        </p>
        <UButton
          label="Kembali ke Daftar"
          icon="i-lucide-arrow-left"
          to="/karyawan"
          class="mt-4"
        />
      </div>

      <!-- Content -->
      <template v-else>
        <div class="mx-auto max-w-6xl space-y-6 px-4 py-6">
          <!-- Hero profil -->
          <KaryawanDetailDossierHero
            :employee="employee"
            @edit="editModal = true"
            @offboard="offboardingModal = true"
            @delete="onDelete"
          />

          <!-- KPI ringkas -->
          <KaryawanDetailKpiStrip :employee="employee" :documents="employeeDocs" />

          <!-- Panel offboarding (hanya untuk RESIGN/PHK) -->
          <KaryawanDetailOffboardingPanel v-if="isOffboarded" :employee="employee" />

          <!-- Konten utama -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <KaryawanDetailSummaryPanel :employee="employee" />
            </div>
            <div class="lg:col-span-1">
              <KaryawanDetailCareerTimeline :employee="employee" :documents="employeeDocs" />
            </div>
          </div>
        </div>
      </template>
    </template>
  </UDashboardPanel>

  <!-- Edit Modal -->
  <KaryawanEditModal
    v-model="editModal"
    :employee="editTarget"
    @updated="onUpdated"
  />

  <!-- Offboarding Modal -->
  <KaryawanOffboardingModal
    v-if="offboardingTarget"
    v-model="offboardingModal"
    :employee="offboardingTarget"
    @saved="onOffboarded"
  />

  <!-- Print CV Modal -->
  <KaryawanDetailPrintCvModal
    v-if="employee"
    v-model:open="printCvOpen"
    :employee="employee"
    :employee-docs="employeeDocs"
  />
</template>
