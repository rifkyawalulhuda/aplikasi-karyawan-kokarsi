<script setup lang="ts">
import type { Employee, ContractStatus, EmploymentStatus } from '~/types'
import type { EmployeeDocumentLike } from '~/utils/employee-metrics'
import { computeEmployeeMetrics, formatDateId } from '~/utils/employee-metrics'

const props = withDefaults(defineProps<{
  employee: Employee
  employeeDocs?: EmployeeDocumentLike[]
  includeWarningLetters?: boolean
}>(), {
  employeeDocs: () => [],
  includeWarningLetters: false
})

// Tanggal dihitung hanya di klien: dokumen ini juga di-SSR (teleport selalu ada),
// dan waktu server selalu berbeda dari waktu klien → hydration mismatch.
const mounted = useMounted()

const metrics = computed(() => computeEmployeeMetrics(props.employee, props.employeeDocs))

const employmentStatusLabelMap: Record<EmploymentStatus, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK'
}

const employmentStatusColorMap: Record<EmploymentStatus, string> = {
  AKTIF: 'success',
  KONTRAK_EXPIRED: 'warning',
  RESIGN: 'neutral',
  PHK: 'error'
}

const contractStatusLabelMap: Record<string, string> = {
  DRAFT: 'Draft',
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan'
}

const educationLabelMap: Record<string, string> = {
  SMA: 'SMA/SMK',
  D3: 'D3',
  S1: 'S1',
  S2: 'S2'
}

const genderLabelMap: Record<string, string> = {
  MALE: 'Laki-laki',
  FEMALE: 'Perempuan'
}

function contractStatusColor(status: ContractStatus) {
  switch (status) {
    case 'AKTIF': return 'success'
    case 'AKAN_HABIS': return 'warning'
    case 'EXPIRED': return 'error'
    case 'SELESAI': return 'info'
    default: return 'neutral'
  }
}

function docStatusLabel(status?: string) {
  switch (status) {
    case 'AKTIF': return 'Aktif'
    case 'AKAN_EXPIRED': return 'Akan Expired'
    case 'EXPIRED': return 'Expired'
    default: return status ?? '-'
  }
}

function docStatusColor(status?: string) {
  switch (status) {
    case 'EXPIRED': return 'error'
    case 'AKAN_EXPIRED': return 'warning'
    default: return 'success'
  }
}

const initials = computed(() =>
  (props.employee?.fullName ?? '')
    .split(' ')
    .map(n => n[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const roleLine = computed(() =>
  [props.employee.jobRole?.name, props.employee.workLocation?.name, props.employee.department?.name]
    .filter(Boolean)
    .join(' · ')
)

const stats = computed(() => [
  { label: 'Masa Kerja', value: metrics.value.tenureLabel },
  { label: 'Status', value: employmentStatusLabelMap[props.employee.employmentStatus] },
  { label: 'Departemen', value: props.employee.department?.name ?? '-' },
  { label: 'Site', value: props.employee.workLocation?.name ?? '-' }
])

/** Ringkasan profil disusun otomatis dari data yang tersedia (read-only). */
const summary = computed(() => {
  const e = props.employee
  const clauses: string[] = []

  const head = e.jobRole?.name || 'Karyawan'
  clauses.push(e.workLocation?.name ? `${head} di ${e.workLocation.name}` : head)
  if (e.department?.name) clauses.push(`tergabung di Departemen ${e.department.name}`)
  if (e.jobLevel?.name) clauses.push(`level jabatan ${e.jobLevel.name}`)
  if (metrics.value.tenureLabel && metrics.value.tenureLabel !== '—') {
    clauses.push(`masa kerja ${metrics.value.tenureLabel}`)
  }

  const body = clauses.join(', ')
  const sentence = body.charAt(0).toUpperCase() + body.slice(1)
  return `${sentence}. Status kepegawaian saat ini: ${employmentStatusLabelMap[e.employmentStatus]}.`
})

const contracts = computed(() =>
  [...(props.employee.contracts ?? [])].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )
)

const documents = computed(() =>
  [...props.employeeDocs].sort(
    (a, b) => new Date(a.expiryDate ?? 0).getTime() - new Date(b.expiryDate ?? 0).getTime()
  )
)

const letters = computed(() =>
  [...(props.employee.warningLetters ?? [])].sort(
    (a, b) => new Date(b.letterDate).getTime() - new Date(a.letterDate).getTime()
  )
)

const place = computed(() => props.employee.workLocation?.name ?? '')

const today = computed(() =>
  mounted.value ? formatDateId(new Date().toISOString()) : ''
)

const signatureDate = computed(() => {
  if (!today.value) return ''
  return place.value ? `${place.value}, ${today.value}` : today.value
})

const printedAt = computed(() => {
  if (!mounted.value) return ''
  const d = new Date()
  return `${formatDateId(d.toISOString())}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
})
</script>

<template>
  <div class="cv-doc">
    <!-- Kepala dokumen -->
    <div class="cv-head">
      <span class="cv-doctype">Daftar Riwayat Hidup</span>
      <span class="cv-docref">No. Induk: {{ employee.employeeNo }}</span>
    </div>
    <div class="cv-toprule" />

    <!-- Hero: foto + identitas -->
    <div class="cv-band">
      <div class="cv-photo">
        <img
          v-if="employee.fotoKaryawan"
          :src="employee.fotoKaryawan"
          :alt="employee.fullName"
        >
        <div v-else class="cv-photo-fallback">
          {{ initials }}
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="cv-name">
              {{ employee.fullName }}
            </h1>
            <p v-if="roleLine" class="cv-role">
              {{ roleLine }}
            </p>
          </div>
          <span class="cv-status" :class="`cv-status-${employmentStatusColorMap[employee.employmentStatus]}`">
            {{ employmentStatusLabelMap[employee.employmentStatus] }}
          </span>
        </div>

        <div class="cv-contact">
          <span v-if="employee.email">
            <UIcon name="i-lucide-mail" class="size-3.5" aria-hidden="true" />
            {{ employee.email }}
          </span>
          <span v-if="employee.phoneNumber">
            <UIcon name="i-lucide-phone" class="size-3.5" aria-hidden="true" />
            {{ employee.phoneNumber }}
          </span>
          <span v-if="employee.memberNo">
            <UIcon name="i-lucide-badge" class="size-3.5" aria-hidden="true" />
            No. Anggota {{ employee.memberNo }}
          </span>
        </div>
      </div>
    </div>

    <!-- Stat strip -->
    <div class="cv-stats">
      <div v-for="stat in stats" :key="stat.label" class="cv-stat">
        <div class="cv-stat-label">
          {{ stat.label }}
        </div>
        <div class="cv-stat-value">
          {{ stat.value }}
        </div>
      </div>
    </div>

    <!-- Ringkasan profil -->
    <p class="cv-summary">
      {{ summary }}
    </p>

    <!-- Data Pribadi -->
    <section class="cv-section">
      <h2 class="cv-section-title">
        Data Pribadi
      </h2>
      <dl class="cv-grid">
        <div class="cv-item">
          <dt>NIK</dt><dd>{{ employee.nik ?? '-' }}</dd>
        </div>
        <div class="cv-item">
          <dt>Jenis Kelamin</dt><dd>{{ genderLabelMap[employee.gender] ?? employee.gender }}</dd>
        </div>
        <div class="cv-item">
          <dt>Tempat Lahir</dt><dd>{{ employee.birthPlace ?? '-' }}</dd>
        </div>
        <div class="cv-item">
          <dt>Tgl. Lahir</dt><dd>{{ formatDateId(employee.birthDate) }}</dd>
        </div>
        <div class="cv-item">
          <dt>Pendidikan</dt><dd>{{ educationLabelMap[employee.educationLevel] ?? employee.educationLevel }}</dd>
        </div>
        <div class="cv-item">
          <dt>Status Pajak</dt><dd>{{ employee.taxStatus?.name ?? '-' }}</dd>
        </div>
        <div class="cv-item">
          <dt>Status Kepegawaian</dt><dd>{{ employmentStatusLabelMap[employee.employmentStatus] }}</dd>
        </div>
        <div class="cv-item">
          <dt>No. Kontrak Aktif</dt><dd>{{ metrics.current.contractNo ?? '-' }}</dd>
        </div>
        <div class="cv-item cv-item-full">
          <dt>Alamat</dt><dd>{{ employee.address ?? '-' }}</dd>
        </div>
      </dl>
    </section>

    <!-- Data Pekerjaan -->
    <section class="cv-section">
      <h2 class="cv-section-title">
        Data Pekerjaan
      </h2>
      <dl class="cv-grid">
        <div class="cv-item">
          <dt>Site</dt><dd>{{ employee.workLocation?.name ?? '-' }}</dd>
        </div>
        <div class="cv-item">
          <dt>Pekerjaan / Jabatan</dt><dd>{{ employee.jobRole?.name ?? '-' }}</dd>
        </div>
        <div class="cv-item">
          <dt>Level Jabatan</dt><dd>{{ employee.jobLevel?.name ?? '-' }}</dd>
        </div>
        <div class="cv-item">
          <dt>Departemen</dt><dd>{{ employee.department?.name ?? '-' }}</dd>
        </div>
        <div class="cv-item">
          <dt>Tgl. Bergabung</dt><dd>{{ formatDateId(employee.joinDate) }}</dd>
        </div>
      </dl>
    </section>

    <!-- Riwayat Kontrak -->
    <section v-if="contracts.length" class="cv-section">
      <h2 class="cv-section-title">
        Riwayat Kontrak
      </h2>
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
          <tr v-for="c in contracts" :key="c.id">
            <td class="font-mono">
              {{ c.contractNo }}
            </td>
            <td>{{ c.contractType?.name ?? '-' }}</td>
            <td class="whitespace-nowrap">
              {{ formatDateId(c.startDate) }} → {{ formatDateId(c.endDate) }}
            </td>
            <td>
              <span class="cv-status" :class="`cv-status-${contractStatusColor(c.status)}`">
                {{ contractStatusLabelMap[c.status] ?? c.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Sertifikasi & Ijin -->
    <section v-if="documents.length" class="cv-section">
      <h2 class="cv-section-title">
        Sertifikasi &amp; Ijin
      </h2>
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
          <tr v-for="d in documents" :key="d.id">
            <td>{{ d.documentType?.name ?? '-' }}</td>
            <td class="font-mono">
              {{ d.documentNumber ?? '-' }}
            </td>
            <td class="whitespace-nowrap">
              {{ formatDateId(d.expiryDate) }}
            </td>
            <td>
              <span class="cv-status" :class="`cv-status-${docStatusColor(d.status)}`">
                {{ docStatusLabel(d.status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Surat Peringatan (opsional) -->
    <section v-if="includeWarningLetters && letters.length" class="cv-section">
      <h2 class="cv-section-title">
        Riwayat Surat Peringatan
      </h2>
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
          <tr v-for="w in letters" :key="w.id">
            <td class="font-mono">
              {{ w.letterNumber }}
            </td>
            <td>SP {{ w.warningLevel }}</td>
            <td>{{ Array.isArray(w.violationType) ? w.violationType.join(', ') : (w.violationType ?? '-') }}</td>
            <td class="whitespace-nowrap">
              {{ formatDateId(w.letterDate) }}
            </td>
            <td class="whitespace-nowrap">
              {{ formatDateId(w.validUntil) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Tanda tangan -->
    <div class="cv-sign">
      <div class="cv-sign-box">
        <div>{{ signatureDate }}</div>
        <div>Yang bersangkutan,</div>
        <div class="cv-sign-gap" />
        <div class="cv-sign-line" />
        <div class="cv-sign-name">
          {{ employee.fullName }}
        </div>
        <div v-if="employee.nik" class="cv-sign-meta">
          NIK {{ employee.nik }}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="cv-foot">
      <span v-if="printedAt">Dicetak {{ printedAt }}</span>
      <span v-else />
      <span>{{ employee.fullName }} • {{ employee.employeeNo }}</span>
    </div>
  </div>
</template>
