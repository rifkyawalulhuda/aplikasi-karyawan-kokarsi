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

export interface Department {
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
export type EmploymentStatus = 'AKTIF' | 'KONTRAK_EXPIRED' | 'RESIGN' | 'PHK'
export type Gender = 'MALE' | 'FEMALE'
export type EducationLevel = 'SMA' | 'D3' | 'S1' | 'S2'
export type TerminationType = 'RESIGN' | 'PHK'

export interface EmployeeOffboarding {
  id: number
  employeeId: number
  terminationType: TerminationType
  terminationDate: string
  reason?: string | null
  processedById: number
  processedByName: string
  processedByRole: string
  processedByKind: string
  createdAt: string
  updatedAt: string
}

export interface EmployeeStatusHistory {
  id: number
  employeeId: number
  oldStatus: string
  newStatus: string
  changedById?: number | null
  changedByName: string
  changedByRole: string
  changedAt: string
  notes?: string | null
}

export interface Employee {
  id: number
  employeeNo: string
  fullName: string
  nik?: string | null
  birthPlace?: string | null
  employmentStatus: EmploymentStatus
  taxStatusId: number
  taxStatus?: TaxStatus
  departmentId?: number | null
  department?: Department | null
  birthDate: string
  address?: string | null
  gender: Gender
  workLocationId: number
  workLocation?: WorkLocation
  jobRoleId: number
  jobRole?: JobRole
  jobLevelId: number
  jobLevel?: JobLevel
  educationLevel: EducationLevel
  joinDate: string
  phoneNumber?: string
  email: string
  fotoKaryawan?: string
  contracts?: Contract[]
  offboarding?: EmployeeOffboarding | null
  statusHistory?: EmployeeStatusHistory[]
  warningLetters?: WarningLetter[]
  createdAt?: string
  updatedAt?: string
}

// --- Contract ---
export type ContractStatus = 'DRAFT' | 'AKTIF' | 'AKAN_HABIS' | 'EXPIRED' | 'SELESAI' | 'DIBATALKAN'

export interface Contract {
  id: number
  employeeId: number
  employee?: Pick<Employee, 'id' | 'employeeNo' | 'fullName' | 'nik' | 'birthPlace' | 'address'> & {
    jobRole?: JobRole | null
    workLocation?: WorkLocation | null
    department?: Department | null
  }
  contractNo: string
  startDate: string
  endDate: string
  contractTypeId?: number | null
  contractType?: ContractType | null
  templateId?: number | null
  template?: ContractTemplate | null
  status: ContractStatus
  signedDate?: string | null
  positionLabel?: string | null
  workLocationLabel?: string | null
  baseCompensation?: number | null
  templateData?: Record<string, any> | null
  documentUrl?: string
  generatedPdfUrl?: string | null
  generatedAt?: string | null
  parentContractId?: number | null
  parentContract?: { id: number; contractNo: string; status: ContractStatus } | null
  createdAt: string
  updatedAt?: string
}

export interface ContractSummaryRow {
  employeeId: number
  employeeNo: string
  fullName: string
  contractId: number
  contractNo: string
  contractType: { id: number; name: string } | null
  startDate: string
  endDate: string
  status: ContractStatus
  daysRemaining: number
  historyCount: number
  canRenew: boolean
}

export interface ContractHistoryResponse {
  employee: { id: number; employeeNo: string; fullName: string; fotoKaryawan?: string | null }
  contracts: Contract[]
}

export type ContractFamily = 'MITRA' | 'PKWT'

export interface ContractTemplate {
  id: number
  code: string
  name: string
  family: ContractFamily
  contractTypeId?: number | null
  contractType?: ContractType | null
  jobRoleId?: number | null
  jobRole?: JobRole | null
  description?: string | null
  templateKey: string
  requiredFields?: unknown
  isActive: boolean
  version: number
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ContractDocumentPreview {
  id: number
  title: string
  subtitle?: string | null
  openingLine: string
  recitals: string[]
  locationLine: string
  termLine: string
  compensationLabel: string
  closingParagraphs: string[]
  firstPartyLabel: string
  secondPartyLabel: string
  missingFields: string[]
  downloadable: boolean
  generatedPdfUrl?: string | null
  renderEngine?: 'PDF_NATIVE'
  layoutMode?: 'LEGAL_PDF_TEMPLATE'
  employee: {
    employeeNo: string
    fullName: string
    nik?: string | null
    birthPlace?: string | null
    birthDate: string
    address?: string | null
  }
  contract: {
    contractNo: string
    contractTypeName: string
    templateName: string
    signedDate: string
    startDate: string
    endDate: string
    compensation: string
    locationLabel: string
    positionLabel: string
  }
  template: {
    id?: number | null
    name?: string | null
    code?: string | null
    templateKey?: string | null
    family?: ContractFamily | null
    sourceTemplateRelativePath?: string | null
    sourceTemplateFormat?: 'PDF' | null
    fidelityNote?: string | null
  }
  sections: Array<{
    heading: string
    paragraphs: string[]
  }>
}

// --- Warning Letter ---
export interface WarningLetter {
  id: number
  letterNumber: string
  employeeId: number
  employee?: Pick<Employee, 'id' | 'employeeNo' | 'fullName'> & { jobRole?: JobRole }
  violationType: string[]
  warningLevel: number
  letterDate: string
  validUntil: string
  processedById: number
  processedByName: string
  documentUrl?: string | null
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

export interface GeneralSettings {
  cooperativeChairmanName: string
  organizationName: string
  appLogoUrl: string
  loginLeftBgColor?: string
  loginRightBgColor?: string
  loginLeftImageUrl?: string
  loginRightImageUrl?: string
  loginLeftOverlayOpacity?: string
  loginRightOverlayOpacity?: string
  loginLeftTextColor?: string
  loginRightTextColor?: string
  agendaNotificationMorningHour?: string
}

// --- Email Notification ---
export interface EmailNotificationConfig {
  isEnabled: boolean
  triggerWindows: number[]
  recipients: EmailNotificationUser[]
}

export interface EmailNotificationUser {
  id: number
  name: string
  email: string
}

export type CalendarItemType = 'agenda' | 'employee_contract' | 'employee_document' | 'vendor_contract' | 'legal_koperasi'

export interface CalendarItem {
  id: string
  sourceId: number
  type: CalendarItemType
  title: string
  description?: string | null
  location?: string | null
  startDate: string
  endDate: string
  startTime?: string | null
  endTime?: string | null
  color: string
  readOnly: boolean
  status?: string | null
  deeplink?: string
  createdByName?: string | null
  assignedUserIds?: number[]
}

export interface CalendarEventInput {
  title: string
  description?: string
  location?: string
  startDate: string
  endDate: string
  startTime: string
  endTime?: string
  color: 'blue' | 'sky' | 'green' | 'teal' | 'yellow' | 'orange' | 'red' | 'pink' | 'purple' | 'indigo' | 'gray' | 'slate'
  assignedUserIds?: number[]
  assignAll?: boolean
}

// --- Misc ---
export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}
