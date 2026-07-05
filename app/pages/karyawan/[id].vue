<script setup lang="ts">
import type { Employee } from '~/types'

const route = useRoute()
const toast = useToast()
const employeeId = computed(() => Number(route.params.id))

// Forward cookie dari SSR request ke Nitro API
const headers = useRequestHeaders(['cookie'])

const { data: employee, status, refresh, error } = await useFetch<Employee>(
  () => `/api/employees/${employeeId.value}`,
  {
    headers,
    watch: [employeeId],
  }
)

const fetchError = computed(() => error.value as any)

// Edit modal
const editModal = ref(false)
const editTarget = computed(() => employee.value ?? null)

// Offboarding modal
const offboardingModal = ref(false)
const offboardingTarget = computed(() => employee.value ?? null)

function onUpdated() {
  refresh()
  toast.add({ title: 'Data karyawan diperbarui', color: 'success' })
}

function onOffboarded() {
  refresh()
  offboardingModal.value = false
  toast.add({ title: 'Offboarding berhasil diproses', color: 'success' })
}

useHead({
  title: computed(() => employee.value ? `${employee.value.fullName} - Detail Karyawan` : 'Detail Karyawan'),
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
            label="Kembali"
          />
        </template>
        <template #title>
          <span v-if="employee">{{ employee.fullName }}</span>
          <span v-else>Detail Karyawan</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-20">
        <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-muted animate-spin" />
      </div>

      <!-- Error -->
      <div v-else-if="status === 'error' || fetchError || !employee" class="text-center py-20">
        <UIcon name="i-lucide-user-x" class="w-12 h-12 text-muted mx-auto mb-3" />
        <p class="text-muted">
          {{ fetchError?.data?.message ?? fetchError?.message ?? 'Karyawan tidak ditemukan.' }}
        </p>
        <UButton label="Kembali ke Daftar" icon="i-lucide-arrow-left" to="/karyawan" class="mt-4" />
      </div>

      <!-- Content -->
      <template v-else>
        <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <!-- A. Header Profil -->
          <KaryawanDetailProfileHeader
            :employee="employee"
            @edit="editModal = true"
            @offboard="offboardingModal = true"
          />

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left column -->
            <div class="lg:col-span-2 space-y-6">
              <!-- B. Ringkasan Utama -->
              <KaryawanDetailSummaryCards :employee="employee" />

              <!-- C. Section Status Kerja -->
              <KaryawanDetailEmploymentPanel :employee="employee" />

              <!-- E. Section Audit Status -->
              <KaryawanDetailStatusHistoryList
                :history="employee.statusHistory ?? []"
              />
            </div>

            <!-- Right column -->
            <div class="lg:col-span-1 space-y-6">
              <!-- D. Riwayat Kontrak -->
              <KaryawanDetailContractTimeline
                :contracts="employee.contracts ?? []"
              />

              <!-- F. Riwayat Surat Peringatan -->
              <KaryawanDetailWarningLetterList
                :letters="employee.warningLetters ?? []"
              />
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
</template>


