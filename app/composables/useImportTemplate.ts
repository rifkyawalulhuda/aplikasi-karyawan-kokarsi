import * as XLSX from 'xlsx'

interface LookupItem {
  id: number
  name: string
}

interface LookupsResponse {
  workLocations: LookupItem[]
  taxStatus: LookupItem[]
  departments: LookupItem[]
  jobRoles: LookupItem[]
  jobLevels: LookupItem[]
  educationLevels: string[]
  genders: { value: string; label: string }[]
}

export interface EmployeeImportRow {
  rowNumber: number
  employeeNo: string
  fullName: string
  nik?: string
  gender: 'MALE' | 'FEMALE'
  birthPlace?: string
  birthDate: string
  address?: string
  joinDate: string
  email: string
  phoneNumber?: string
  educationLevel: 'SMA' | 'D3' | 'S1' | 'S2'
  workLocationId: number
  jobRoleId: number
  jobLevelId: number
  departmentId: number
  taxStatusId: number
}

export interface InvalidImportRow {
  rowNumber: number
  data: Record<string, string>
  errors: string[]
}

export interface ParseResult {
  validRows: EmployeeImportRow[]
  invalidRows: InvalidImportRow[]
  totalRows: number
}

interface LookupMaps {
  workLocations: Map<string, number>
  jobRoles: Map<string, number>
  jobLevels: Map<string, number>
  departments: Map<string, number>
  taxStatus: Map<string, number>
}

const COLUMN_HEADERS = [
  'No. Induk Karyawan',
  'Nama Lengkap',
  'NIK',
  'Jenis Kelamin',
  'Tempat Lahir',
  'Tanggal Lahir',
  'Alamat',
  'Tanggal Bergabung',
  'Email',
  'No. HP',
  'Pendidikan',
  'Site',
  'Pekerjaan',
  'Level Jabatan',
  'Departemen',
  'Status Pajak',
]

const GENDER_MAP: Record<string, 'MALE' | 'FEMALE'> = {
  'Laki-laki': 'MALE',
  'Perempuan': 'FEMALE',
}

const GENDER_LABELS = ['Laki-laki', 'Perempuan']
const EDUCATION_LABELS = ['SMA', 'D3', 'S1', 'S2']

function buildLookupMaps(lookups: LookupsResponse): LookupMaps {
  return {
    workLocations: new Map(lookups.workLocations.map(l => [l.name, l.id])),
    jobRoles: new Map(lookups.jobRoles.map(l => [l.name, l.id])),
    jobLevels: new Map(lookups.jobLevels.map(l => [l.name, l.id])),
    departments: new Map(lookups.departments.map(l => [l.name, l.id])),
    taxStatus: new Map(lookups.taxStatus.map(l => [l.name, l.id])),
  }
}

function formatDateForExcel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function parseDateString(val: unknown): string | null {
  if (!val) return null

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    const year = val.getFullYear()
    const month = String(val.getMonth() + 1).padStart(2, '0')
    const day = String(val.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const str = String(val).trim()
  if (!str) return null

  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`
  }

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return str.substring(0, 10)
  }

  const d = new Date(str)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCellValue(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return ''
    return formatDateForExcel(val)
  }
  return String(val).trim()
}

export function useImportTemplate() {
  async function generateTemplate(): Promise<void> {
    const blob = await $fetch<Blob>('/api/employees/import-template', {
      responseType: 'blob',
      credentials: 'include',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'template-import-karyawan.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function parseAndValidate(file: File): Promise<ParseResult> {
    const lookups = await $fetch<LookupsResponse>('/api/lookups')
    const lookupMaps = buildLookupMaps(lookups)

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { validRows: [], invalidRows: [], totalRows: 0 }
    }

    const sheet = workbook.Sheets[sheetName]!
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })

    if (jsonData.length < 2) {
      return { validRows: [], invalidRows: [], totalRows: 0 }
    }

    const dataRows = jsonData.slice(1).filter(row => {
      if (!Array.isArray(row)) return false
      return row.some(cell => cell !== '' && cell !== null && cell !== undefined)
    })

    const validRows: EmployeeImportRow[] = []
    const invalidRows: InvalidImportRow[] = []
    const seenEmployeeNos = new Map<string, number>()
    const seenEmails = new Map<string, number>()
    const seenNiks = new Map<string, number>()

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!
      const rowNum = i + 2
      const errors: string[] = []

      const raw = {
        employeeNo: getCellValue(row[0]),
        fullName: getCellValue(row[1]),
        nik: getCellValue(row[2]),
        gender: getCellValue(row[3]),
        birthPlace: getCellValue(row[4]),
        birthDate: getCellValue(row[5]),
        address: getCellValue(row[6]),
        joinDate: getCellValue(row[7]),
        email: getCellValue(row[8]),
        phoneNumber: getCellValue(row[9]),
        educationLevel: getCellValue(row[10]),
        workLocation: getCellValue(row[11]),
        jobRole: getCellValue(row[12]),
        jobLevel: getCellValue(row[13]),
        department: getCellValue(row[14]),
        taxStatus: getCellValue(row[15]),
      }

      if (!raw.employeeNo) errors.push('No. Induk Karyawan wajib diisi')
      else if (raw.employeeNo.length < 3) errors.push('No. Induk Karyawan min. 3 karakter')

      if (!raw.fullName) errors.push('Nama Lengkap wajib diisi')
      else if (raw.fullName.length < 3) errors.push('Nama Lengkap min. 3 karakter')

      if (!raw.gender) errors.push('Jenis Kelamin wajib diisi')
      else if (!GENDER_MAP[raw.gender]) errors.push(`Jenis Kelamin harus salah satu: ${GENDER_LABELS.join(', ')}`)

      const birthDate = parseDateString(raw.birthDate || row[5])
      if (!raw.birthDate && !row[5]) errors.push('Tanggal Lahir wajib diisi')
      else if (!birthDate) errors.push('Format Tanggal Lahir tidak valid (gunakan dd/mm/yyyy)')

      const joinDate = parseDateString(raw.joinDate || row[7])
      if (!raw.joinDate && !row[7]) errors.push('Tanggal Bergabung wajib diisi')
      else if (!joinDate) errors.push('Format Tanggal Bergabung tidak valid (gunakan dd/mm/yyyy)')

      if (!raw.email) errors.push('Email wajib diisi')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email)) errors.push('Format Email tidak valid')

      if (!raw.educationLevel) errors.push('Pendidikan wajib diisi')
      else if (!EDUCATION_LABELS.includes(raw.educationLevel)) errors.push(`Pendidikan harus salah satu: ${EDUCATION_LABELS.join(', ')}`)

      if (!raw.workLocation) errors.push('Site wajib diisi')
      else if (!lookupMaps.workLocations.has(raw.workLocation)) errors.push(`Site "${raw.workLocation}" tidak ditemukan di master data`)

      if (!raw.jobRole) errors.push('Jabatan wajib diisi')
      else if (!lookupMaps.jobRoles.has(raw.jobRole)) errors.push(`Jabatan "${raw.jobRole}" tidak ditemukan di master data`)

      if (!raw.jobLevel) errors.push('Level Jabatan wajib diisi')
      else if (!lookupMaps.jobLevels.has(raw.jobLevel)) errors.push(`Level Jabatan "${raw.jobLevel}" tidak ditemukan di master data`)

      if (!raw.department) errors.push('Departemen wajib diisi')
      else if (!lookupMaps.departments.has(raw.department)) errors.push(`Departemen "${raw.department}" tidak ditemukan di master data`)

      if (!raw.taxStatus) errors.push('Status Pajak wajib diisi')
      else if (!lookupMaps.taxStatus.has(raw.taxStatus)) errors.push(`Status Pajak "${raw.taxStatus}" tidak ditemukan di master data`)

      if (raw.nik && raw.nik.length < 8) errors.push('NIK min. 8 karakter')

      if (raw.phoneNumber && raw.phoneNumber.length < 8) errors.push('No. HP min. 8 karakter')

      if (raw.address && raw.address.length < 5) errors.push('Alamat min. 5 karakter')

      if (raw.employeeNo) {
        const key = raw.employeeNo.toLowerCase()
        if (seenEmployeeNos.has(key)) {
          errors.push(`No. Induk Karyawan duplikat dengan baris ${seenEmployeeNos.get(key)}`)
        } else {
          seenEmployeeNos.set(key, rowNum)
        }
      }

      if (raw.email) {
        const key = raw.email.toLowerCase()
        if (seenEmails.has(key)) {
          errors.push(`Email duplikat dengan baris ${seenEmails.get(key)}`)
        } else {
          seenEmails.set(key, rowNum)
        }
      }

      if (raw.nik) {
        if (seenNiks.has(raw.nik)) {
          errors.push(`NIK duplikat dengan baris ${seenNiks.get(raw.nik)}`)
        } else {
          seenNiks.set(raw.nik, rowNum)
        }
      }

      if (errors.length > 0) {
        invalidRows.push({
          rowNumber: rowNum,
          data: raw,
          errors,
        })
      } else {
        validRows.push({
          rowNumber: rowNum,
          employeeNo: raw.employeeNo,
          fullName: raw.fullName,
          nik: raw.nik || undefined,
          gender: GENDER_MAP[raw.gender]!,
          birthPlace: raw.birthPlace || undefined,
          birthDate: birthDate!,
          address: raw.address || undefined,
          joinDate: joinDate!,
          email: raw.email,
          phoneNumber: raw.phoneNumber || undefined,
          educationLevel: raw.educationLevel as 'SMA' | 'D3' | 'S1' | 'S2',
          workLocationId: lookupMaps.workLocations.get(raw.workLocation)!,
          jobRoleId: lookupMaps.jobRoles.get(raw.jobRole)!,
          jobLevelId: lookupMaps.jobLevels.get(raw.jobLevel)!,
          departmentId: lookupMaps.departments.get(raw.department)!,
          taxStatusId: lookupMaps.taxStatus.get(raw.taxStatus)!,
        })
      }
    }

    return {
      validRows,
      invalidRows,
      totalRows: dataRows.length,
    }
  }

  return {
    generateTemplate,
    parseAndValidate,
  }
}
