<script setup lang="ts">
import type { Employee, ContractStatus, EmploymentStatus } from '~/types'

const props = defineProps<{
  employee: Employee
  employeeDocs?: any[]
}>()

const now = new Date()

function fmtDate(val?: string | null) {
  if (!val) return '-'
  const d = new Date(val)
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const employmentStatusLabelMap: Record<EmploymentStatus, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK',
}

const contractStatusLabelMap: Record<string, string> = {
  DRAFT: 'Draft',
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

const educationLabelMap: Record<string, string> = {
  SMA: 'SMA/SMK',
  D3: 'D3',
  S1: 'S1',
  S2: 'S2',
}

const docStatusLabel = (status?: string) => {
  switch (status) {
    case 'AKTIF': return 'Aktif'
    case 'AKAN_EXPIRED': return 'Akan Expired'
    case 'EXPIRED': return 'Expired'
    default: return status ?? '-'
  }
}

const initials = computed(() =>
  (props.employee?.fullName ?? '').split(' ').map(n => n[0] ?? '').filter(Boolean).slice(0, 2).join('').toUpperCase()
)

const activeContract = computed(() => {
  const contracts = props.employee?.contracts ?? []
  return contracts.find(c => c.status === 'AKTIF')
    ?? contracts.find(c => ['AKAN_HABIS', 'EXPIRED'].includes(c.status))
    ?? null
})

function contractStatusColor(status: ContractStatus) {
  switch (status) {
    case 'AKTIF': return 'success'
    case 'AKAN_HABIS': return 'warning'
    case 'EXPIRED': return 'error'
    case 'SELESAI': return 'info'
    default: return 'neutral'
  }
}

function docStatusClass(status?: string) {
  if (status === 'EXPIRED') return 'cv-status-error'
  if (status === 'AKAN_EXPIRED') return 'cv-status-warning'
  return 'cv-status-success'
}
</script>

<template>
  <div class="bg-white text-slate-900 p-8 sm:p-12">
    <!-- Header -->
    <div class="flex items-start gap-6 border-b-2 border-slate-800 pb-6">
      <div class="size-24 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-slate-200">
        <img v-if="employee.fotoKaryawan" :src="employee.fotoKaryawan" :alt="employee.fullName" class="h-full w-full object-cover" />
        <div v-else class="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-500">
          {{ initials }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-bold leading-tight">{{ employee.fullName }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ employee.employeeNo }}<span v-if="employee.memberNo"> · No. Anggota: {{ employee.memberNo }}</span></p>
        <p class="mt-2 text-base font-medium text-slate-700">
          {{ [employee.jobRole?.name, employee.workLocation?.name, employee.department?.name].filter(Boolean).join(' • ') || 'Karyawan' }}
        </p>
        <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
          <span v-if="employee.email">Email: {{ employee.email }}</span>
          <span v-if="employee.phoneNumber">HP: {{ employee.phoneNumber }}</span>
        </div>
      </div>
    </div>

    <!-- Data Pribadi -->
    <section class="mt-7">
      <h2 class="cv-section-title">Data Pribadi</h2>
      <dl class="cv-grid">
        <div class="cv-item"><dt>NIK</dt><dd>{{ employee.nik ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Jenis Kelamin</dt><dd>{{ employee.gender === 'MALE' ? 'Laki-laki' : employee.gender === 'FEMALE' ? 'Perempuan' : (employee.gender ?? '-') }}</dd></div>
        <div class="cv-item"><dt>Tempat Lahir</dt><dd>{{ employee.birthPlace ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Tgl. Lahir</dt><dd>{{ fmtDate(employee.birthDate) }}</dd></div>
        <div class="cv-item"><dt>Pendidikan</dt><dd>{{ educationLabelMap[employee.educationLevel] ?? employee.educationLevel ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Status Pajak</dt><dd>{{ employee.taxStatus?.name ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Status Kepegawaian</dt><dd>{{ employmentStatusLabelMap[employee.employmentStatus] ?? employee.employmentStatus }}</dd></div>
        <div class="cv-item"><dt>No. Kontrak Aktif</dt><dd>{{ activeContract?.contractNo ?? '-' }}</dd></div>
        <div class="cv-item cv-item-full"><dt>Alamat</dt><dd>{{ employee.address ?? '-' }}</dd></div>
      </dl>
    </section>

    <!-- Data Pekerjaan -->
    <section class="mt-7">
      <h2 class="cv-section-title">Data Pekerjaan</h2>
      <dl class="cv-grid">
        <div class="cv-item"><dt>Site</dt><dd>{{ employee.workLocation?.name ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Pekerjaan / Jabatan</dt><dd>{{ employee.jobRole?.name ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Level Jabatan</dt><dd>{{ employee.jobLevel?.name ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Departemen</dt><dd>{{ employee.department?.name ?? '-' }}</dd></div>
        <div class="cv-item"><dt>Tgl. Bergabung</dt><dd>{{ fmtDate(employee.joinDate) }}</dd></div>
      </dl>
    </section>

    <!-- Riwayat Kontrak -->
    <section v-if="(employee.contracts ?? []).length" class="mt-7">
      <h2 class="cv-section-title">Riwayat Kontrak</h2>
      <table class="cv-table">
        <thead>
          <tr>
            <th>No. Kontrak</th>
            <th>Jenis</th>
            <th>Periode</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in (employee.contracts ?? [])" :key="c.id">
            <td class="font-mono">{{ c.contractNo }}</td>
            <td>{{ c.contractType?.name ?? '-' }}</td>
            <td class="whitespace-nowrap">{{ fmtDate(c.startDate) }} → {{ fmtDate(c.endDate) }}</td>
            <td><span class="cv-status" :class="`cv-status-${contractStatusColor(c.status)}`">{{ contractStatusLabelMap[c.status] ?? c.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Sertifikasi & Ijin -->
    <section v-if="(employeeDocs ?? []).length" class="mt-7">
      <h2 class="cv-section-title">Sertifikasi &amp; Ijin</h2>
      <table class="cv-table">
        <thead>
          <tr>
            <th>Nama Dokumen</th>
            <th>No. Dokumen</th>
            <th>Berlaku Sampai</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in employeeDocs ?? []" :key="d.id">
            <td>{{ d.documentType?.name ?? '-' }}</td>
            <td class="font-mono">{{ d.documentNumber ?? '-' }}</td>
            <td class="whitespace-nowrap">{{ fmtDate(d.expiryDate) }}</td>
            <td><span class="cv-status" :class="docStatusClass(d.status)">{{ docStatusLabel(d.status) }}</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Surat Peringatan -->
    <section v-if="(employee.warningLetters ?? []).length" class="mt-7">
      <h2 class="cv-section-title">Riwayat Surat Peringatan</h2>
      <table class="cv-table">
        <thead>
          <tr>
            <th>Nomor Surat</th>
            <th>Level</th>
            <th>Jenis Pelanggaran</th>
            <th>Tanggal Surat</th>
            <th>Berlaku Sampai</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in employee.warningLetters ?? []" :key="w.id">
            <td class="font-mono">{{ w.letterNumber }}</td>
            <td>SP {{ w.warningLevel }}</td>
            <td>{{ Array.isArray(w.violationType) ? w.violationType.join(', ') : (w.violationType ?? '-') }}</td>
            <td class="whitespace-nowrap">{{ fmtDate(w.letterDate) }}</td>
            <td class="whitespace-nowrap">{{ fmtDate(w.validUntil) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Footer -->
    <div class="mt-8 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
      <span>Dicetak: {{ now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) }} {{ now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}</span>
      <span>{{ employee.fullName }} • {{ employee.employeeNo }}</span>
    </div>
  </div>
</template>