import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IsString, IsEnum, IsEmail, IsOptional, IsInt, IsDateString } from 'class-validator'
import { EmploymentStatus, Gender, EducationLevel, TerminationType } from '@prisma/client'
import { resolveContractStatus, resolveEmploymentStatus } from './employment-status'
import { DashboardCacheService } from '../shared/dashboard-cache.service'
import ExcelJS from 'exceljs'

export class CreateEmployeeDto {
  @IsString() employeeNo: string
  @IsString() fullName: string
  @IsOptional() @IsString() nik?: string
  @IsOptional() @IsString() birthPlace?: string
  @IsEnum(Gender) gender: Gender
  @IsDateString() birthDate: string
  @IsDateString() joinDate: string
  @IsEmail() email: string
  @IsOptional() @IsString() phoneNumber?: string
  @IsOptional() @IsString() address?: string
  @IsEnum(EducationLevel) educationLevel: EducationLevel
  @IsInt() workLocationId: number
  @IsInt() jobRoleId: number
  @IsInt() jobLevelId: number
  @IsInt() taxStatusId: number
  @IsInt() departmentId: number
  @IsOptional() @IsString() fotoKaryawan?: string
}

export class UpdateEmployeeDto extends CreateEmployeeDto {}

export class OffboardingDto {
  @IsEnum(TerminationType) terminationType: TerminationType
  @IsDateString() terminationDate: string
  @IsOptional() @IsString() reason?: string
}

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private dashboardCache: DashboardCacheService,
  ) {}

  private include = {
    workLocation: true,
    jobRole: true,
    jobLevel: true,
    taxStatus: true,
    department: true,
    offboarding: true,
  }

  private mapContractsWithComputedStatus<T extends { status: any; startDate: Date; endDate: Date }>(
    employeeStatus: EmploymentStatus,
    contracts: T[],
  ) {
    return contracts.map(contract => ({
      ...contract,
      status: resolveContractStatus(contract, employeeStatus),
    }))
  }

  private mapEmployee<T extends { contracts?: any[]; offboarding?: any | null; employmentStatus: EmploymentStatus }>(employee: T) {
    const contracts = Array.isArray(employee.contracts) ? employee.contracts : []
    const employmentStatus = Array.isArray(employee.contracts)
      ? resolveEmploymentStatus(contracts, employee.offboarding)
      : employee.employmentStatus

    return {
      ...employee,
      employmentStatus,
      contracts: contracts.length ? this.mapContractsWithComputedStatus(employmentStatus, contracts) : undefined,
    }
  }

  private async recomputeEmployeeStatus(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        contracts: true,
        offboarding: true,
      },
    })

    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan')

    const nextStatus = resolveEmploymentStatus(employee.contracts, employee.offboarding)

    if (employee.employmentStatus !== nextStatus) {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: nextStatus },
      })
    }

    return nextStatus
  }

  async findAll(params: {
    page?: number
    limit?: number
    search?: string
    employmentStatus?: string
    includeContracts?: boolean
  }) {
    const { page = 1, limit = 10, search, employmentStatus, includeContracts = false } = params
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeNo: { contains: search, mode: 'insensitive' } },
        { nik: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (employmentStatus) where.employmentStatus = employmentStatus

    const [rawData, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: includeContracts
          ? {
              ...this.include,
              contracts: {
                orderBy: { startDate: 'desc' },
                include: { contractType: true },
              },
            }
          : this.include,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ])

    const data = rawData.map(employee => this.mapEmployee(employee))

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: number) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        ...this.include,
        contracts: {
          orderBy: { startDate: 'desc' },
          include: {
            contractType: true,
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
        },
        warningLetters: {
          orderBy: { letterDate: 'desc' },
        },
      },
    })
    if (!emp) throw new NotFoundException('Karyawan tidak ditemukan')
    return this.mapEmployee(emp)
  }

  async create(dto: CreateEmployeeDto) {
    const employee = await this.prisma.employee.create({
      data: {
        ...dto,
        employmentStatus: 'KONTRAK_EXPIRED',
        birthDate: new Date(dto.birthDate),
        joinDate: new Date(dto.joinDate),
      },
      include: this.include,
    })
    this.dashboardCache.invalidate()
    return this.findOne(employee.id)
  }

  async bulkCreate(employees: CreateEmployeeDto[]) {
    if (!employees.length) {
      return { imported: 0, errors: [] }
    }

    const employeeNos = employees.map(e => e.employeeNo)
    const emails = employees.map(e => e.email)
    const niks = employees.filter(e => e.nik).map(e => e.nik!)

    const [existingEmployeeNos, existingEmails, existingNiks] = await Promise.all([
      this.prisma.employee.findMany({
        where: { employeeNo: { in: employeeNos } },
        select: { employeeNo: true },
      }),
      this.prisma.employee.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
      niks.length > 0
        ? this.prisma.employee.findMany({
            where: { nik: { in: niks } },
            select: { nik: true },
          })
        : Promise.resolve([]),
    ])

    const conflicts = new Set<string>()
    existingEmployeeNos.forEach(e => conflicts.add(`employeeNo:${e.employeeNo}`))
    existingEmails.forEach(e => conflicts.add(`email:${e.email}`))
    existingNiks.forEach(e => conflicts.add(`nik:${e.nik}`))

    if (conflicts.size > 0) {
      const errors: Array<{ row: number; message: string }> = []
      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i]!
        const row = i + 2
        if (conflicts.has(`employeeNo:${emp.employeeNo}`)) {
          errors.push({ row, message: `No. Induk Karyawan "${emp.employeeNo}" sudah ada di database` })
        }
        if (conflicts.has(`email:${emp.email}`)) {
          errors.push({ row, message: `Email "${emp.email}" sudah ada di database` })
        }
        if (emp.nik && conflicts.has(`nik:${emp.nik}`)) {
          errors.push({ row, message: `NIK "${emp.nik}" sudah ada di database` })
        }
      }
      throw new BadRequestException({
        message: 'Import dibatalkan. Beberapa data sudah ada di database.',
        errors,
      })
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const created = []
        for (const emp of employees) {
          const { rowNumber, ...employeeData } = emp as any
          const record = await tx.employee.create({
            data: {
              ...employeeData,
              employmentStatus: 'KONTRAK_EXPIRED',
              birthDate: new Date(emp.birthDate),
              joinDate: new Date(emp.joinDate),
            },
          })
          created.push(record)
        }
        return created
      })
      return { imported: result.length, errors: [] }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err
      throw new BadRequestException({
        message: 'Import gagal. Pastikan semua data valid dan tidak ada duplikat.',
        details: err?.message ?? 'Unknown error',
      })
    }
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id)
    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        birthDate: new Date(dto.birthDate),
        joinDate: new Date(dto.joinDate),
      },
      include: this.include,
    })
    await this.recomputeEmployeeStatus(id)
    this.dashboardCache.invalidate()
    return this.findOne(employee.id)
  }

  async updatePhoto(id: number, fotoKaryawan: string) {
    await this.findOne(id)
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { fotoKaryawan },
      include: this.include,
    })
    return this.mapEmployee(employee)
  }

  async remove(id: number) {
    await this.findOne(id)

    const [warningLetterCount, contractCount] = await Promise.all([
      this.prisma.warningLetter.count({ where: { employeeId: id } }),
      this.prisma.contract.count({ where: { employeeId: id } }),
    ])

    const parts: string[] = []
    if (warningLetterCount > 0) parts.push(`${warningLetterCount} surat peringatan`)
    if (contractCount > 0) parts.push(`${contractCount} kontrak`)

    if (parts.length > 0) {
      throw new BadRequestException(
        `Karyawan tidak dapat dihapus karena masih memiliki ${parts.join(' dan ')}. Hapus data terkait terlebih dahulu.`
      )
    }

    // Hapus related records yang tidak punya cascade delete sebelum hapus employee
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.employeeStatusHistory.deleteMany({ where: { employeeId: id } })
      await tx.employeeOffboarding.deleteMany({ where: { employeeId: id } })
      return tx.employee.delete({ where: { id } })
    })
    this.dashboardCache.invalidate()
    return result
  }

  async offboard(id: number, dto: OffboardingDto, actor: { sub: number; fullName?: string; role?: string; kind?: string }) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        contracts: true,
        offboarding: true,
      },
    })

    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan')

    const oldStatus = resolveEmploymentStatus(employee.contracts, employee.offboarding)
    const nextStatus: EmploymentStatus = dto.terminationType

    await this.prisma.client.$transaction(async (tx) => {
      await tx.employeeOffboarding.upsert({
        where: { employeeId: id },
        update: {
          terminationType: dto.terminationType,
          terminationDate: new Date(dto.terminationDate),
          reason: dto.reason,
          processedById: actor.sub,
          processedByName: actor.fullName ?? 'System',
          processedByRole: actor.role ?? 'UNKNOWN',
          processedByKind: actor.kind ?? 'unknown',
        },
        create: {
          employeeId: id,
          terminationType: dto.terminationType,
          terminationDate: new Date(dto.terminationDate),
          reason: dto.reason,
          processedById: actor.sub,
          processedByName: actor.fullName ?? 'System',
          processedByRole: actor.role ?? 'UNKNOWN',
          processedByKind: actor.kind ?? 'unknown',
        },
      })

      await tx.employee.update({
        where: { id },
        data: { employmentStatus: nextStatus },
      })

      await tx.contract.updateMany({
        where: {
          employeeId: id,
          status: { in: ['AKTIF', 'AKAN_HABIS'] },
        },
        data: {
          status: 'SELESAI',
          endDate: new Date(dto.terminationDate),
        },
      })

      await tx.employeeStatusHistory.create({
        data: {
          employeeId: id,
          oldStatus,
          newStatus: nextStatus,
          changedById: actor.sub,
          changedByName: actor.fullName ?? 'System',
          changedByRole: actor.role ?? 'UNKNOWN',
          notes: dto.reason,
        },
      })
    })

    return this.findOne(id)
  }

  async getDashboardStats() {
    const cached = this.dashboardCache.get()
    if (cached) return cached

    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const currentYear = new Date().getFullYear()

    const [
      total, aktif, kontrakExpired, resign, phk, expiringContracts, locations, levels,
      spGroups, genderGroups, educationGroups, deptData, contractFamilyGroups,
      recruitTrend, offboardTrend,
    ] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { employmentStatus: 'AKTIF' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'KONTRAK_EXPIRED' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'RESIGN' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'PHK' } }),
      this.prisma.contract.count({
        where: {
          endDate: { gte: now, lte: in30Days },
          status: { notIn: ['DIBATALKAN', 'SELESAI'] },
        }
      }),
      this.prisma.workLocation.findMany({
        select: {
          name: true,
          _count: { select: { employees: true } }
        }
      }),
      this.prisma.jobLevel.findMany({
        select: {
          name: true,
          _count: { select: { employees: true } }
        }
      }),
      // SP breakdown
      this.prisma.warningLetter.groupBy({ by: ['warningLevel'], _count: true }),
      // Gender breakdown
      this.prisma.employee.groupBy({ by: ['gender'], _count: true }),
      // Education breakdown
      this.prisma.employee.groupBy({ by: ['educationLevel'], _count: true }),
      // Department breakdown
      this.prisma.department.findMany({
        select: { name: true, _count: { select: { employees: true } } }
      }),
      // Contract family breakdown
      this.prisma.contract.findMany({
        where: { template: { isNot: null }, status: { notIn: ['DIBATALKAN', 'SELESAI'] } },
        select: { template: { select: { family: true } } }
      }),
      // Recruitment trend (last 5 years) — fetch joinDate, group in JS
      this.prisma.employee.findMany({
        where: { joinDate: { gte: new Date(`${currentYear - 4}-01-01`) } },
        select: { joinDate: true },
      }),
      // Offboarding trend — fetch all, group in JS
      this.prisma.employeeOffboarding.findMany({
        select: { terminationDate: true, terminationType: true },
      }),
    ])

    const byLocation = locations
      .map(l => ({ name: l.name, count: l._count.employees }))
      .filter(l => l.count > 0)

    const byLevel = levels
      .map(l => ({ name: l.name, count: l._count.employees }))
      .filter(l => l.count > 0)

    // SP breakdown
    const sp1 = spGroups.find(s => s.warningLevel === 1)?._count ?? 0
    const sp2 = spGroups.find(s => s.warningLevel === 2)?._count ?? 0
    const sp3 = spGroups.find(s => s.warningLevel === 3)?._count ?? 0

    // Gender breakdown
    const male = genderGroups.find(g => g.gender === 'MALE')?._count ?? 0
    const female = genderGroups.find(g => g.gender === 'FEMALE')?._count ?? 0

    // Education breakdown
    const sma = educationGroups.find(e => e.educationLevel === 'SMA')?._count ?? 0
    const d3 = educationGroups.find(e => e.educationLevel === 'D3')?._count ?? 0
    const s1 = educationGroups.find(e => e.educationLevel === 'S1')?._count ?? 0
    const s2 = educationGroups.find(e => e.educationLevel === 'S2')?._count ?? 0

    // Contract family breakdown
    const mitra = contractFamilyGroups.filter(c => c.template?.family === 'MITRA').length
    const pkwt = contractFamilyGroups.filter(c => c.template?.family === 'PKWT').length

    // Recruitment trend — group joinDate by year in JS
    const recruitMap = new Map<number, number>()
    for (const emp of recruitTrend) {
      const year = new Date(emp.joinDate).getFullYear()
      recruitMap.set(year, (recruitMap.get(year) ?? 0) + 1)
    }
    const recruitmentTrend = Array.from(recruitMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count }))

    // Offboarding trend — group terminationDate+type by year in JS
    const offboardMap = new Map<number, { resign: number; phk: number }>()
    for (const ob of offboardTrend) {
      const year = new Date(ob.terminationDate).getFullYear()
      if (!offboardMap.has(year)) offboardMap.set(year, { resign: 0, phk: 0 })
      const entry = offboardMap.get(year)!
      if (ob.terminationType === 'RESIGN') entry.resign++
      else if (ob.terminationType === 'PHK') entry.phk++
    }
    const offboardingTrend = Array.from(offboardMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, vals]) => ({ year, ...vals }))

    const stats = {
      total, aktif, kontrakExpired, resign, phk, expiringContracts, byLocation, byLevel,
      bySp: { sp1, sp2, sp3 },
      byContractFamily: { mitra, pkwt },
      byGender: { male, female },
      byEducation: { sma, d3, s1, s2 },
      byDepartment: deptData
        .filter(d => d._count.employees > 0)
        .map(d => ({ name: d.name, count: d._count.employees })),
      recruitmentTrend,
      offboardingTrend,
    }

    this.dashboardCache.set(stats)
    return stats
  }

  async generateImportTemplate(): Promise<Buffer> {
    const [workLocations, jobRoles, jobLevels, departments, taxStatus] = await Promise.all([
      this.prisma.workLocation.findMany(),
      this.prisma.jobRole.findMany(),
      this.prisma.jobLevel.findMany(),
      this.prisma.department.findMany(),
      this.prisma.taxStatus.findMany(),
    ])

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Data Karyawan')

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
      'Lokasi Kerja',
      'Jabatan',
      'Level Jabatan',
      'Departemen',
      'Status Pajak',
    ]

    const GENDER_LABELS = ['Laki-laki', 'Perempuan']
    const EDUCATION_LABELS = ['SMA', 'D3', 'S1', 'S2']

    const headerFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    }
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11,
    }

    const requiredColumns = new Set([1, 2, 4, 6, 8, 9, 11, 12, 13, 14, 15, 16])

    const headerRow = sheet.addRow(COLUMN_HEADERS)
    headerRow.eachCell((cell, colNumber) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    })
    sheet.getRow(1).height = 24

    const hiddenSheet = workbook.addWorksheet('RefData')
    hiddenSheet.state = 'hidden'

    const maxDataRow = 101

    const addDropdown = (
      colNumber: number,
      sheetColTitle: string,
      items: string[],
      errorTitle: string,
      errorMsg: string,
    ) => {
      if (items.length === 0) return

      const colLetter = String.fromCharCode(64 + colNumber)
      const range = `${colLetter}2:${colLetter}${maxDataRow}`
      const formulaStr = `"${items.join(',')}"`

      if (formulaStr.length <= 255) {
        ;(sheet as any).dataValidations.add(range, {
          type: 'list',
          allowBlank: false,
          showErrorMessage: true,
          formulae: [formulaStr],
          errorTitle,
          error: errorMsg,
        })
      } else {
        const refCol = hiddenSheet.getColumn(hiddenSheet.columnCount + 1)
        refCol.header = sheetColTitle
        items.forEach((item, i) => {
          hiddenSheet.getCell(i + 2, refCol.number).value = item
        })
        const refLetter = refCol.letter
        const endRow = items.length + 1
        ;(sheet as any).dataValidations.add(range, {
          type: 'list',
          allowBlank: false,
          showErrorMessage: true,
          formulae: [`=RefData!$${refLetter}$2:$${refLetter}$${endRow}`],
          errorTitle,
          error: errorMsg,
        })
      }
    }

    addDropdown(4, 'JK', GENDER_LABELS, 'Jenis Kelamin Tidak Valid', `Pilih salah satu: ${GENDER_LABELS.join(', ')}`)
    addDropdown(11, 'Pendidikan', EDUCATION_LABELS, 'Pendidikan Tidak Valid', `Pilih salah satu: ${EDUCATION_LABELS.join(', ')}`)
    addDropdown(12, 'Lokasi', workLocations.map(l => l.name), 'Lokasi Kerja Tidak Valid', 'Pilih dari daftar lokasi kerja yang tersedia.')
    addDropdown(13, 'Jabatan', jobRoles.map(l => l.name), 'Jabatan Tidak Valid', 'Pilih dari daftar jabatan yang tersedia.')
    addDropdown(14, 'Level', jobLevels.map(l => l.name), 'Level Jabatan Tidak Valid', 'Pilih dari daftar level jabatan yang tersedia.')
    addDropdown(15, 'Departemen', departments.map(l => l.name), 'Departemen Tidak Valid', 'Pilih dari daftar departemen yang tersedia.')
    addDropdown(16, 'Pajak', taxStatus.map(l => l.name), 'Status Pajak Tidak Valid', 'Pilih dari daftar status pajak yang tersedia.')

    for (let i = 2; i <= 101; i++) {
      for (let col = 1; col <= COLUMN_HEADERS.length; col++) {
        const cell = sheet.getCell(i, col)
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        }
      }
      // Set dd/mm/yyyy number format for date columns (F=6 birthDate, H=8 joinDate)
      sheet.getCell(i, 6).numFmt = 'dd/mm/yyyy'
      sheet.getCell(i, 8).numFmt = 'dd/mm/yyyy'
    }

    const columnWidths = [22, 30, 22, 16, 18, 16, 40, 18, 30, 18, 14, 22, 22, 18, 22, 18]
    COLUMN_HEADERS.forEach((_, i) => {
      sheet.getColumn(i + 1).width = columnWidths[i]
    })

    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }
}
