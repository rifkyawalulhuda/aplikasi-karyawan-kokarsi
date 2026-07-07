import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ContractStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MailerooService } from '../maileroo/maileroo.service'
import { DAY_MS, startOfDay } from '../shared/date-utils'

@Injectable()
export class ContractCronService {
  private readonly logger = new Logger(ContractCronService.name)

  constructor(
    private prisma: PrismaService,
    private maileroo: MailerooService,
  ) {}

  // Setiap hari jam 00:01 WIB (Asia/Jakarta)
  @Cron('1 0 * * *', { name: 'contract-status-sync', timeZone: 'Asia/Jakarta' })
  async syncContractStatuses() {
    this.logger.log('Starting contract status synchronization...')

    const now = new Date()
    const today = startOfDay(now).getTime()

    // Ambil semua kontrak dengan status AKTIF atau AKAN_HABIS
    const contracts = await this.prisma.contract.findMany({
      where: {
        status: { in: ['AKTIF', 'AKAN_HABIS'] },
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employmentStatus: true,
          },
        },
      },
    })

    if (contracts.length === 0) {
      this.logger.log('No active contracts to evaluate.')
      return
    }

    const updates: { id: number; newStatus: ContractStatus; employeeId: number; contractNo: string; employeeName: string; endDate: Date }[] = []

    for (const contract of contracts) {
      const end = startOfDay(contract.endDate).getTime()

      if (end < today) {
        updates.push({
          id: contract.id, newStatus: 'EXPIRED', employeeId: contract.employeeId,
          contractNo: contract.contractNo, employeeName: contract.employee.fullName, endDate: contract.endDate,
        })
      } else {
        const daysLeft = Math.ceil((end - today) / DAY_MS)
        const newStatus: ContractStatus = daysLeft <= 30 ? 'AKAN_HABIS' : 'AKTIF'

        // Hanya update jika status berubah
        if (newStatus !== contract.status) {
          updates.push({
            id: contract.id, newStatus, employeeId: contract.employeeId,
            contractNo: contract.contractNo, employeeName: contract.employee.fullName, endDate: contract.endDate,
          })
        }
      }
    }

    if (updates.length === 0) {
      this.logger.log('All contract statuses are up to date.')
      return
    }

    // Jalankan semua update dalam satu transaksi atomik
    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.contract.update({
          where: { id: update.id },
          data: { status: update.newStatus },
        })
      }

      // Kumpulkan employee unik yang kontraknya berubah
      const affectedEmployeeIds = [...new Set(updates.map(u => u.employeeId))]

      for (const employeeId of affectedEmployeeIds) {
        const employee = await tx.employee.findUnique({
          where: { id: employeeId },
          include: {
            contracts: true,
            offboarding: true,
          },
        })

        if (!employee) continue
        // Skip employee yang sudah offboarding
        if (employee.offboarding) continue

        // Cek apakah masih ada kontrak AKTIF/AKAN_HABIS
        const hasActiveContract = employee.contracts.some(
          c => c.status === 'AKTIF' || c.status === 'AKAN_HABIS',
        )

        const newEmploymentStatus = hasActiveContract ? 'AKTIF' : 'KONTRAK_EXPIRED'

        if (employee.employmentStatus !== newEmploymentStatus) {
          await tx.employee.update({
            where: { id: employeeId },
            data: { employmentStatus: newEmploymentStatus },
          })
          this.logger.log(
            `Employee ${employeeId}: ${employee.employmentStatus} -> ${newEmploymentStatus}`,
          )
        }
      }
    })

    this.logger.log(`Contract status sync complete. ${updates.length} contract(s) updated.`)

    // Kirim email notifikasi untuk kontrak yang berubah ke AKAN_HABIS atau EXPIRED
    const notifyChanges = updates
      .filter(u => u.newStatus === 'AKAN_HABIS' || u.newStatus === 'EXPIRED')
      .map(u => ({
        contractNo: u.contractNo,
        employeeName: u.employeeName,
        endDate: u.endDate,
        newStatus: u.newStatus as 'AKAN_HABIS' | 'EXPIRED',
      }))

    if (notifyChanges.length > 0) {
      this.logger.log(`Sending email notification for ${notifyChanges.length} contract change(s)...`)
      await this.maileroo
        .sendContractStatusNotification(notifyChanges)
        .catch(err => this.logger.error(`Email notification failed: ${err?.message}`))
    }
  }
}
