<script setup lang="ts">
import type { Employee, Contract } from '~/types'

const props = defineProps<{
  employee: Employee
}>()

function formatDate(val: string | undefined) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const contractStatusColorMap: Record<string, string> = {
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'neutral',
  DIBATALKAN: 'neutral',
}

const contractStatusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

const latestContract = computed<Contract | null>(() => {
  const contracts = props.employee.contracts ?? []
  return contracts[0] ?? null
})

const activeContract = computed<Contract | null>(() => {
  const contracts = props.employee.contracts ?? []
  return contracts.find(c => c.status === 'AKTIF' || c.status === 'AKAN_HABIS') ?? null
})

const status = computed(() => props.employee.employmentStatus)
</script>

<template>
  <div>
    <h2 class="text-base font-semibold text-highlighted mb-3">Status Kerja</h2>

    <!-- AKTIF -->
    <div v-if="status === 'AKTIF'" class="p-4 rounded-lg bg-success/5 border border-success/20">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-check-circle" class="w-5 h-5 text-success" />
        <span class="font-semibold text-success">Karyawan Aktif</span>
      </div>
      <template v-if="activeContract">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-muted text-xs mb-0.5">No. Kontrak</p>
            <p class="font-medium text-highlighted font-mono">{{ activeContract.contractNo }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Tipe Kontrak</p>
            <p class="font-medium text-highlighted">{{ activeContract.contractType?.name ?? '-' }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Status</p>
            <UBadge :color="(contractStatusColorMap[activeContract.status] as any)" variant="subtle" size="sm">
              {{ contractStatusLabelMap[activeContract.status] }}
            </UBadge>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Mulai</p>
            <p class="font-medium text-highlighted">{{ formatDate(activeContract.startDate) }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Selesai</p>
            <p class="font-medium text-highlighted">{{ formatDate(activeContract.endDate) }}</p>
          </div>
        </div>
      </template>
    </div>

    <!-- KONTRAK_EXPIRED -->
    <div v-else-if="status === 'KONTRAK_EXPIRED'" class="p-4 rounded-lg bg-warning/5 border border-warning/20">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-clock" class="w-5 h-5 text-warning" />
        <span class="font-semibold text-warning">Kontrak Habis</span>
      </div>
      <p class="text-sm text-muted mb-3">Kontrak karyawan sudah berakhir. Perlu perpanjangan atau proses offboarding.</p>
      <template v-if="latestContract">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-muted text-xs mb-0.5">No. Kontrak Terakhir</p>
            <p class="font-medium text-highlighted font-mono">{{ latestContract.contractNo }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Tipe Kontrak</p>
            <p class="font-medium text-highlighted">{{ latestContract.contractType?.name ?? '-' }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Berakhir</p>
            <p class="font-medium text-highlighted">{{ formatDate(latestContract.endDate) }}</p>
          </div>
        </div>
      </template>
    </div>

    <!-- RESIGN / PHK — Offboarding Panel -->
    <div
      v-else-if="status === 'RESIGN' || status === 'PHK'"
      class="p-4 rounded-lg bg-elevated border border-default"
    >
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-user-x" class="w-5 h-5 text-muted" />
        <span class="font-semibold text-highlighted">
          {{ status === 'RESIGN' ? 'Mengundurkan Diri (Resign)' : 'Pemutusan Hubungan Kerja (PHK)' }}
        </span>
      </div>
      <template v-if="employee.offboarding">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-muted text-xs mb-0.5">Jenis Offboarding</p>
            <UBadge :color="status === 'RESIGN' ? 'neutral' : 'error'" variant="subtle" size="sm">
              {{ employee.offboarding.terminationType }}
            </UBadge>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Tanggal Efektif</p>
            <p class="font-medium text-highlighted">{{ formatDate(employee.offboarding.terminationDate) }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Diproses Oleh</p>
            <p class="font-medium text-highlighted">{{ employee.offboarding.processedByName }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Role Pemroses</p>
            <p class="font-medium text-highlighted">{{ employee.offboarding.processedByRole }}</p>
          </div>
          <div>
            <p class="text-muted text-xs mb-0.5">Waktu Input</p>
            <p class="font-medium text-highlighted">{{ formatDate(employee.offboarding.createdAt) }}</p>
          </div>
          <div v-if="employee.offboarding.reason" class="col-span-2 sm:col-span-3">
            <p class="text-muted text-xs mb-0.5">Alasan / Catatan</p>
            <p class="font-medium text-highlighted">{{ employee.offboarding.reason }}</p>
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-default">
          <p class="text-xs text-muted">
            <UIcon name="i-lucide-info" class="w-3.5 h-3.5 inline mr-1" />
            Semua kontrak non-dibatalkan telah diubah ke status <strong>Selesai</strong> saat offboarding.
          </p>
        </div>
      </template>
      <p v-else class="text-sm text-muted">Data offboarding tidak ditemukan.</p>
    </div>
  </div>
</template>
