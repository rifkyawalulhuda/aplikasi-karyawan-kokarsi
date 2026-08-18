import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsInt, IsDateString, IsOptional, IsEnum, IsNumber } from 'class-validator'
import { ContractStatus, Prisma } from '@prisma/client'
import { resolveContractStatus, resolveEmploymentStatus } from '../employees/employment-status'
import { DAY_MS, startOfDay } from '../shared/date-utils'
import { NotificationsService } from '../notifications/notifications.service'
import { DashboardCacheService } from '../shared/dashboard-cache.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { buildDocumentNumber } from '../shared/document-number.util'

function calculateDaysRemaining(endDate: Date): number {
  const today = startOfDay(new Date()).getTime()
  const end = startOfDay(endDate).getTime()
  return Math.ceil((end - today) / DAY_MS)
}

export class CreateContractDto {
  @IsInt() employeeId: number
  @IsDateString() startDate: string
  @IsDateString() endDate: string
  @IsOptional() @IsInt() contractTypeId?: number
  @IsOptional() @IsInt() templateId?: number
  @IsOptional() @IsEnum(ContractStatus) status?: ContractStatus
  @IsOptional() @IsDateString() signedDate?: string
  @IsOptional() @IsString() positionLabel?: string
  @IsOptional() @IsString() workLocationLabel?: string
  @IsOptional() @IsNumber() baseCompensation?: number
  @IsOptional() templateData?: Record<string, any>
  @IsOptional() @IsString() documentUrl?: string
  @IsOptional() @IsInt() parentContractId?: number
}

export class UpdateContractDto extends CreateContractDto {}

export class RenewContractDto {
  @IsDateString() startDate: string
  @IsDateString() endDate: string
  @IsOptional() @IsInt() contractTypeId?: number
  @IsOptional() @IsInt() templateId?: number
  @IsOptional() @IsDateString() signedDate?: string
  @IsOptional() @IsString() positionLabel?: string
  @IsOptional() @IsString() workLocationLabel?: string
  @IsOptional() @IsNumber() baseCompensation?: number
  @IsOptional() templateData?: Record<string, any>
  @IsOptional() @IsString() documentUrl?: string
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

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private dashboardCache: DashboardCacheService,
    private notificationsService: NotificationsService,
    private activityLog: ActivityLogService,
  ) {}

  private include = {
    employee: {
      select: {
        id: true,
        employeeNo: true,
        fullName: true,
        employmentStatus: true,
        nik: true,
        birthPlace: true,
        address: true,
      },
    },
    contractType: { select: { id: true, name: true } },
    template: {
      select: {
        id: true,
        code: true,
        name: true,
        family: true,
        templateKey: true,
        isActive: true,
      },
    },
    parentContract: {
      select: {
        id: true,
        contractNo: true,
        status: true,
      },
    },
  }

  async generateContractNo(refDate: Date = new Date()): Promise<string> {
    const year = refDate.getFullYear()
    const existing = await this.prisma.contract.findMany({
      where: { contractNo: { endsWith: `/${year}` } },
      select: { contractNo: true },
    })
    return buildDocumentNumber(existing.map(c => c.contractNo), 'KK', refDate)
  }

  private withComputedStatus<T extends { startDate: Date; endDate: Date; status: ContractStatus }>(contract: T) {
    const employeeStatus = (contract as any).employee?.employmentStatus
    return {
      ...contract,
      status: resolveContractStatus(contract, employeeStatus),
    }
  }

  private withComputedStatuses<T extends { startDate: Date; endDate: Date; status: ContractStatus }>(contracts: T[]) {
    return contracts.map(contract => this.withComputedStatus(contract))
  }

  private async syncEmployeeStatus(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        contracts: true,
        offboarding: true,
      },
    })

    if (!employee) return

    const employmentStatus = resolveEmploymentStatus(employee.contracts, employee.offboarding)
    if (employmentStatus !== employee.employmentStatus) {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus },
      })
    }
  }

  private async checkSp3Lockout(employeeId: number) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sp3 = await this.prisma.warningLetter.findFirst({
      where: {
        employeeId,
        warningLevel: 3,
        validUntil: { gte: today },
      },
    })
    if (sp3) {
      throw new ForbiddenException(
        'Pembuatan atau perpanjangan kontrak diblokir karena status eskalasi SP3 karyawan masih aktif.',
      )
    }
  }

  private async checkTerminationLockout(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        employmentStatus: true,
        offboarding: true,
      },
    })
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan')

    if (employee.employmentStatus === 'RESIGN' || employee.employmentStatus === 'PHK') {
      // Jika tidak ada offboarding record, status stale — reset otomatis dan izinkan
      if (!employee.offboarding) {
        await this.prisma.employee.update({
          where: { id: employeeId },
          data: { employmentStatus: 'KONTRAK_EXPIRED' },
        })
        return
      }
      throw new ForbiddenException(
        'Pembuatan atau perpanjangan kontrak diblokir karena karyawan sudah tidak aktif (RESIGN/PHK).',
      )
    }
  }

  private async getBlockingContract(employeeId: number) {
    return this.prisma.contract.findFirst({
      where: {
        employeeId,
        status: { in: ['AKTIF', 'AKAN_HABIS'] },
      },
      include: {
        contractType: { select: { id: true, name: true } },
      },
    })
  }

  private async getLatestExpiredContract(employeeId: number) {
    return this.prisma.contract.findFirst({
      where: {
        employeeId,
        status: 'EXPIRED',
      },
      orderBy: { endDate: 'desc' },
    })
  }

  private pickRepresentativeContract(contracts: any[]) {
    const nonCancelled = contracts.filter(c => c.status !== 'DIBATALKAN')
    if (nonCancelled.length === 0) return null

    const priority: ContractStatus[] = ['AKTIF', 'AKAN_HABIS', 'EXPIRED']
    for (const status of priority) {
      const match = nonCancelled.find(c => c.status === status)
      if (match) return match
    }

    return nonCancelled.sort((a, b) =>
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )[0]
  }

  async findAll(params: { page?: number; limit?: number; status?: string; employeeId?: number; search?: string }) {
    const { page = 1, limit = 10, status, employeeId, search } = params
    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (search) {
      where.OR = [
        { contractNo: { contains: search, mode: 'insensitive' } },
        { employee: { fullName: { contains: search, mode: 'insensitive' } } },
        { employee: { employeeNo: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const data = this.withComputedStatuses(await this.prisma.contract.findMany({
      where,
      include: this.include,
      orderBy: { startDate: 'desc' },
    }))

    const filtered = status ? data.filter(contract => contract.status === status) : data
    const total = filtered.length
    const skip = (page - 1) * limit
    const paged = filtered.slice(skip, skip + limit)

    return { data: paged, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { ...this.include, documents: true },
    })
    if (!contract) throw new NotFoundException('Kontrak tidak ditemukan')
    return this.withComputedStatus(contract)
  }

  async findSummary(): Promise<ContractSummaryRow[]> {
    const employees = await this.prisma.employee.findMany({
      include: {
        contracts: {
          include: {
            contractType: { select: { id: true, name: true } },
          },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { fullName: 'asc' },
    })

    const rows: ContractSummaryRow[] = []

    for (const emp of employees) {
      const computedContracts = this.withComputedStatuses(emp.contracts)
      const representative = this.pickRepresentativeContract(computedContracts)

      if (!representative) continue

      const isOffboarded = emp.employmentStatus === 'RESIGN' || emp.employmentStatus === 'PHK'
      const contractStatus: ContractStatus = isOffboarded ? 'SELESAI' : representative.status
      const historyCount = computedContracts.length
      const daysRemaining = isOffboarded ? 0 : calculateDaysRemaining(representative.endDate)
      const canRenew = !isOffboarded && (representative.status === 'AKAN_HABIS' || representative.status === 'EXPIRED')

      rows.push({
        employeeId: emp.id,
        employeeNo: emp.employeeNo,
        fullName: emp.fullName,
        contractId: representative.id,
        contractNo: representative.contractNo,
        contractType: representative.contractType ?? null,
        startDate: representative.startDate.toISOString(),
        endDate: representative.endDate.toISOString(),
        status: contractStatus,
        daysRemaining,
        historyCount,
        canRenew,
      })
    }

    return rows
  }

  async findHistoryByEmployee(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeNo: true, fullName: true, fotoKaryawan: true },
    })
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan')

    const contracts = await this.prisma.contract.findMany({
      where: { employeeId },
      include: { ...this.include, documents: true },
      orderBy: { startDate: 'desc' },
    })

    return {
      employee,
      contracts: this.withComputedStatuses(contracts),
    }
  }

  async create(dto: CreateContractDto, actor: { name: string; role: string }) {
    await this.checkTerminationLockout(dto.employeeId)
    await this.checkSp3Lockout(dto.employeeId)

    const blocking = await this.getBlockingContract(dto.employeeId)
    if (blocking) {
      throw new ConflictException('Karyawan masih memiliki kontrak aktif berjalan.')
    }

    let autoParentId = dto.parentContractId
    if (!autoParentId) {
      const latestExpired = await this.getLatestExpiredContract(dto.employeeId)
      if (latestExpired) {
        autoParentId = latestExpired.id

        const newStart = startOfDay(new Date(dto.startDate)).getTime()
        const parentEnd = startOfDay(latestExpired.endDate).getTime()
        if (newStart < parentEnd) {
          throw new BadRequestException(
            `Tanggal mulai kontrak baru tidak boleh lebih kecil dari tanggal selesai kontrak sebelumnya (${latestExpired.endDate.toISOString().split('T')[0]}).`,
          )
        }
      }
    }

    try {
      const contractNo = await this.generateContractNo(new Date(dto.startDate))
      const contract = await this.prisma.contract.create({
        data: {
          ...dto,
          contractNo,
          parentContractId: autoParentId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
        },
        include: this.include,
      })
      await this.syncEmployeeStatus(dto.employeeId)
      this.dashboardCache.invalidate()
      this.notificationsService.generateNotifications().catch(() => {})
      const result = this.withComputedStatus(contract)
      void this.activityLog.log({ action: 'CREATE', module: 'Kontrak', targetLabel: contract.contractNo, detail: `Periode: ${contract.startDate ? new Date(contract.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'} – ${contract.endDate ? new Date(contract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'} | Status: ${(result as any).status}`, performedBy: actor.name, performedByRole: actor.role })
      return result
    } catch (error: any) {
      if (error?.code === 'P2002' && error?.meta?.constraint?.fields?.includes('"contractNo"')) {
        throw new ConflictException(`Nomor kontrak sudah digunakan. Silakan coba lagi.`)
      }
      throw error
    }
  }

  async renew(parentId: number, dto: RenewContractDto) {
    const parent = await this.prisma.contract.findUnique({
      where: { id: parentId },
      include: this.include,
    })
    if (!parent) throw new NotFoundException('Kontrak induk tidak ditemukan')

    const computedParent = this.withComputedStatus(parent)
    if (computedParent.status !== 'AKAN_HABIS' && computedParent.status !== 'EXPIRED') {
      throw new BadRequestException(
        'Perpanjangan hanya dapat dilakukan untuk kontrak dengan status Akan Habis atau Expired.',
      )
    }

    await this.checkTerminationLockout(parent.employeeId)
    await this.checkSp3Lockout(parent.employeeId)

    const newStart = startOfDay(new Date(dto.startDate)).getTime()
    const parentEnd = startOfDay(parent.endDate).getTime()
    if (newStart < parentEnd) {
      throw new BadRequestException(
        `Tanggal mulai kontrak baru tidak boleh lebih kecil dari tanggal selesai kontrak sebelumnya (${parent.endDate.toISOString().split('T')[0]}).`,
      )
    }

    const blocking = await this.prisma.contract.findFirst({
      where: {
        employeeId: parent.employeeId,
        id: { not: parentId },
        status: { in: ['AKTIF', 'AKAN_HABIS'] },
      },
    })
    if (blocking) {
      throw new ConflictException('Karyawan masih memiliki kontrak aktif lain yang berjalan.')
    }

    try {
      const contractNo = await this.generateContractNo(new Date(dto.startDate))
      const contract = await this.prisma.contract.create({
        data: {
          employeeId: parent.employeeId,
          contractNo,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          contractTypeId: dto.contractTypeId,
          templateId: dto.templateId,
          signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
          positionLabel: dto.positionLabel,
          workLocationLabel: dto.workLocationLabel,
          baseCompensation: dto.baseCompensation,
          templateData: dto.templateData as any,
          documentUrl: dto.documentUrl,
          parentContractId: parentId,
        },
        include: this.include,
      })
      await this.syncEmployeeStatus(parent.employeeId)
      this.dashboardCache.invalidate()
      this.notificationsService.generateNotifications().catch(() => {})
      return this.withComputedStatus(contract)
    } catch (error: any) {
      if (error?.code === 'P2002' && error?.meta?.constraint?.fields?.includes('"contractNo"')) {
        throw new ConflictException(`Nomor kontrak sudah digunakan. Silakan coba lagi.`)
      }
      throw error
    }
  }

  async update(id: number, dto: UpdateContractDto, actor: { name: string; role: string }) {
    const existing = await this.findOne(id)

    if (existing.documentUrl) {
      const lockedFields = ['baseCompensation', 'startDate', 'endDate', 'employeeId'] as const
      for (const field of lockedFields) {
        const newValue = dto[field]
        if (newValue === undefined) continue

        const oldRaw = existing[field]
        const oldValue = oldRaw instanceof Date
          ? oldRaw.toISOString().split('T')[0]
          : oldRaw

        if (newValue !== oldValue) {
          throw new BadRequestException(
            'Kontrak ini sudah memiliki dokumen yang ditandatangani. Tanggal, kompensasi, dan data karyawan tidak dapat diubah. Hapus dokumen terlebih dahulu jika perlu melakukan perubahan.',
          )
        }
      }
    }

    const contract = await this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        signedDate: dto.signedDate ? new Date(dto.signedDate) : null,
      },
      include: this.include,
    })
    await this.syncEmployeeStatus(existing.employeeId)
    if (dto.employeeId !== existing.employeeId) {
      await this.syncEmployeeStatus(dto.employeeId)
    }
    this.dashboardCache.invalidate()
    this.notificationsService.generateNotifications().catch(() => {})
    const result = this.withComputedStatus(contract)
    void this.activityLog.log({ action: 'UPDATE', module: 'Kontrak', targetLabel: contract.contractNo, detail: `Periode: ${contract.startDate ? new Date(contract.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'} – ${contract.endDate ? new Date(contract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'} | Status: ${(result as any).status}`, performedBy: actor.name, performedByRole: actor.role })
    return result
  }

  async remove(id: number, actor: { name: string; role: string }) {
    const contract = await this.findOne(id)
    const removed = await this.prisma.contract.delete({ where: { id } })
    await this.syncEmployeeStatus(contract.employeeId)
    this.dashboardCache.invalidate()
    void this.activityLog.log({ action: 'DELETE', module: 'Kontrak', targetLabel: contract.contractNo, detail: `Status terakhir: ${(contract as any).status}`, performedBy: actor.name, performedByRole: actor.role })
    return removed
  }

  async getExpiring(days: number) {
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + days)
    const contracts = await this.prisma.contract.findMany({
      where: {
        endDate: { gte: now, lte: future },
      },
      include: this.include,
      orderBy: { endDate: 'asc' },
    })
    return this.withComputedStatuses(contracts).filter(contract => contract.status === 'AKAN_HABIS')
  }

  async updateDocumentUrl(id: number, documentUrl: string) {
    await this.findOne(id)
    const contract = await this.prisma.contract.update({
      where: { id },
      data: { documentUrl },
      include: this.include,
    })
    return this.withComputedStatus(contract)
  }
}
