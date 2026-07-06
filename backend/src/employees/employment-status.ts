import { ContractStatus, EmploymentStatus, TerminationType } from '@prisma/client'
import { DAY_MS, startOfDay } from '../shared/date-utils'

type ContractLike = {
  startDate: Date
  endDate: Date
  status: ContractStatus
}

type OffboardingLike = {
  terminationType: TerminationType
}

export function isTerminatedStatus(status?: EmploymentStatus | null) {
  return status === 'RESIGN' || status === 'PHK'
}

export function resolveContractStatus(
  contract: ContractLike,
  employmentStatus?: EmploymentStatus | null,
  now = new Date(),
): ContractStatus {
  if (contract.status === 'DIBATALKAN') return 'DIBATALKAN'
  if (contract.status === 'SELESAI') return 'SELESAI'
  if (contract.status === 'DRAFT') return 'DRAFT'
  if (isTerminatedStatus(employmentStatus)) return 'SELESAI'

  const today = startOfDay(now).getTime()
  const end = startOfDay(contract.endDate).getTime()

  if (end < today) return 'EXPIRED'

  const daysLeft = Math.ceil((end - today) / DAY_MS)
  return daysLeft <= 30 ? 'AKAN_HABIS' : 'AKTIF'
}

export function resolveEmploymentStatus(
  contracts: ContractLike[],
  offboarding?: OffboardingLike | null,
  now = new Date(),
): EmploymentStatus {
  if (offboarding?.terminationType === 'RESIGN') return 'RESIGN'
  if (offboarding?.terminationType === 'PHK') return 'PHK'

  const latestContract = [...contracts]
    .filter(contract => contract.status !== 'DIBATALKAN' && contract.status !== 'DRAFT')
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]

  if (!latestContract) return 'KONTRAK_EXPIRED'

  const latestStatus = resolveContractStatus(latestContract, undefined, now)
  return latestStatus === 'AKTIF' || latestStatus === 'AKAN_HABIS'
    ? 'AKTIF'
    : 'KONTRAK_EXPIRED'
}

