export type OrgPositionStatus = 'AKTIF' | 'AKAN_BERAKHIR' | 'EXPIRED' | 'TIDAK_AKTIF'

export interface OrgPeriod {
  id: number
  name: string
  startDate: string
  endDate?: string | null
  isActive: boolean
  notes?: string | null
  _count?: { nodes: number }
  createdAt: string
  updatedAt: string
}

export interface OrgNodeEmployee {
  id: number
  employeeNo: string
  fullName: string
  fotoKaryawan?: string | null
}

export interface OrgNode {
  id: number
  periodId: number
  parentId: number | null
  employeeId: number | null
  name: string
  position: string
  unitUsaha?: string | null
  photoUrl?: string | null
  skNumber?: string | null
  skDate?: string | null
  startDate?: string | null
  endDate?: string | null
  status: OrgPositionStatus
  sortOrder: number
  notes?: string | null
  employee?: OrgNodeEmployee | null
  children?: OrgNode[]
  createdAt: string
  updatedAt: string
}
