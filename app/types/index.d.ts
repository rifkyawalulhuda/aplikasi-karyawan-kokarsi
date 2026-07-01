// --- Lookup Types ---
export interface WorkLocation {
  id: number
  name: string
}

export interface TaxStatus {
  id: number
  name: string
}

export interface ContractType {
  id: number
  name: string
}

export interface JobRole {
  id: number
  name: string
}

export interface JobLevel {
  id: number
  name: string
}

// --- Employee ---
export type EmploymentStatus = 'MITRA' | 'KONTRAK'
export type Gender = 'MALE' | 'FEMALE'
export type EducationLevel = 'SMA' | 'D3' | 'S1' | 'S2'

export interface Employee {
  id: number
  employeeNo: string
  fullName: string
  employmentStatus: EmploymentStatus
  taxStatusId: number
  taxStatus?: TaxStatus
  birthDate: string
  gender: Gender
  workLocationId: number
  workLocation?: WorkLocation
  jobRoleId: number
  jobRole?: JobRole
  jobLevelId: number
  jobLevel?: JobLevel
  educationLevel: EducationLevel
  joinDate: string
  phoneNumber: string
  email: string
  fotoKaryawan?: string
}

// --- Contract ---
export type ContractStatus = 'AKTIF' | 'AKAN_HABIS' | 'EXPIRED' | 'DIBATALKAN'

export interface Contract {
  id: number
  employeeId: number
  employee?: Pick<Employee, 'id' | 'employeeNo' | 'fullName'>
  contractNo: string
  startDate: string
  endDate: string
  contractTypeId?: number | null
  contractType?: ContractType | null
  status: ContractStatus
  documentUrl?: string
  createdAt: string
  updatedAt?: string
}

// --- Dashboard ---
export interface DashboardStat {
  title: string
  icon: string
  value: number | string
  description?: string
  color?: string
}

// --- Auth ---
export type AdminRole = 'ADMIN' | 'PENGELOLA_KOPERASI'

export interface MasterAdmin {
  id: number
  employeeNo: string
  fullName: string
  role: AdminRole
}

export interface UserAccount {
  id: number
  name: string
  nik: string
  email: string
  role: AdminRole
  username: string
  createdAt?: string
  updatedAt?: string
}

// --- Misc ---
export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}
