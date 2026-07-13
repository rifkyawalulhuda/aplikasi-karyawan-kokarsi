import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ContractStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MailerooService } from '../maileroo/maileroo.service'
import { DAY_MS, startOfDay } from '../shared/date-utils'
import { VendorContractsService } from '../vendor-contracts/vendor-contracts.service'
import { LegalKoperasiService } from '../legal-koperasi/legal-koperasi.service'
import { NotificationsService } from '../notifications/notifications.service'
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'

@Injectable()
export class ContractCronService {
  private readonly logger = new Logger(ContractCronService.name)

  constructor(
    private prisma: PrismaService,
    private maileroo: MailerooService,
    private vendorContractsService: VendorContractsService,
    private legalKoperasiService: LegalKoperasiService,
    private notificationsService: NotificationsService,
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

    const updates: { id: number; newStatus: ContractStatus; employeeId: number; contractNo: string; employeeName: string; endDate: Date }[] = []

    if (contracts.length === 0) {
      this.logger.debug('No active contracts to evaluate.')
    } else {
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

    // ── EmployeeDocument status sync ─────────────────────────────────────────

    this.logger.debug('Starting employee document status synchronization...')

    const todayStart = startOfDay(now)
    const in30Days = new Date(todayStart.getTime() + 30 * DAY_MS)

    // 1. Dokumen yang akan expired dalam 30 hari (belum berstatus AKAN_EXPIRED)
    const expiringSoon = await this.prisma.employeeDocument.findMany({
      where: {
        expiryDate: { gte: todayStart, lte: in30Days },
        status: { not: 'AKAN_EXPIRED' },
      },
      include: {
        employee: { select: { employeeNo: true, fullName: true } },
        documentType: { select: { name: true } },
      },
    })

    if (expiringSoon.length > 0) {
      await this.prisma.employeeDocument.updateMany({
        where: { id: { in: expiringSoon.map(d => d.id) } },
        data: { status: 'AKAN_EXPIRED' },
      })
      this.logger.log(`${expiringSoon.length} document(s) marked as AKAN_EXPIRED.`)

      const docNotifyAkan = expiringSoon.map(d => ({
        documentName: d.documentType?.name ?? 'Dokumen',
        employeeName: d.employee.fullName,
        expiryDate: d.expiryDate,
        newStatus: 'AKAN_EXPIRED' as const,
      }))

      await this.maileroo
        .sendDocumentStatusNotification(docNotifyAkan)
        .catch(err => this.logger.error(`Document email notification failed: ${err?.message}`))
    }

    // 2. Dokumen yang sudah expired (belum berstatus EXPIRED)
    const expiredDocs = await this.prisma.employeeDocument.findMany({
      where: {
        expiryDate: { lt: now },
        status: { not: 'EXPIRED' },
      },
      include: {
        employee: { select: { employeeNo: true, fullName: true } },
        documentType: { select: { name: true } },
      },
    })

    if (expiredDocs.length > 0) {
      await this.prisma.employeeDocument.updateMany({
        where: { id: { in: expiredDocs.map(d => d.id) } },
        data: { status: 'EXPIRED' },
      })
      this.logger.log(`${expiredDocs.length} document(s) marked as EXPIRED.`)

      const docNotifyExpired = expiredDocs.map(d => ({
        documentName: d.documentType?.name ?? 'Dokumen',
        employeeName: d.employee.fullName,
        expiryDate: d.expiryDate,
        newStatus: 'EXPIRED' as const,
      }))

      await this.maileroo
        .sendDocumentStatusNotification(docNotifyExpired)
        .catch(err => this.logger.error(`Document email notification failed: ${err?.message}`))
    }

    this.logger.debug('Employee document status sync complete.')

    // ── VendorContract status sync ──────────────────────────────────────
    this.logger.debug('Syncing vendor contract statuses...')
    const { akanBerakhir: vcAkan, expired: vcExpired } = await this.vendorContractsService.syncExpiredStatuses()

    const vcChanges = [
      ...vcAkan.map((vc: any) => ({
        documentName: vc.documentName,
        documentNumber: vc.documentNumber,
        companyName: vc.company?.name ?? '-',
        endDate: vc.endDate!,
        newStatus: 'AKAN_BERAKHIR' as const,
      })),
      ...vcExpired.map((vc: any) => ({
        documentName: vc.documentName,
        documentNumber: vc.documentNumber,
        companyName: vc.company?.name ?? '-',
        endDate: vc.endDate!,
        newStatus: 'EXPIRED' as const,
      })),
    ]

    if (vcChanges.length > 0) {
      await this.maileroo.sendVendorContractNotification(vcChanges)
        .catch(err => this.logger.error(`Vendor contract notification failed: ${err?.message}`))
    }

    // ── LegalKoperasi status sync ──────────────────────────────────────
    this.logger.debug('Syncing legal koperasi statuses...')
    const { akanBerakhir: lkAkan, expired: lkExpired } = await this.legalKoperasiService.syncExpiredStatuses()

    const lkChanges = [
      ...lkAkan.map((lk: any) => ({
        documentName: lk.documentName,
        publisher: lk.publisher,
        endDate: lk.endDate!,
        newStatus: 'AKAN_BERAKHIR' as const,
      })),
      ...lkExpired.map((lk: any) => ({
        documentName: lk.documentName,
        publisher: lk.publisher,
        endDate: lk.endDate!,
        newStatus: 'EXPIRED' as const,
      })),
    ]

    if (lkChanges.length > 0) {
      await this.maileroo.sendLegalKoperasiNotification(lkChanges)
        .catch(err => this.logger.error(`Legal koperasi notification failed: ${err?.message}`))
    }

    // ── Generate in-app notifications ──────────────────────────────
    this.logger.debug('Generating expiry reminder notifications...')
    const notifResult = await this.notificationsService.generateNotifications()
      .catch(err => {
        this.logger.error(`Notification generation failed: ${err?.message}`)
        return { created: 0, resolved: 0 }
      })
    if (notifResult.created > 0 || notifResult.resolved > 0) {
      this.logger.log(`Notifications: ${notifResult.created} created, ${notifResult.resolved} resolved`)
    }
  }

  // Setiap 5 menit — refresh notifikasi untuk semua modul (safety net)
  @Cron('*/5 * * * *', { name: 'notification-refresh', timeZone: 'Asia/Jakarta' })
  async refreshNotifications() {
    // Silent — jalan setiap 5 menit, error tetap di-log
    await this.notificationsService.generateNotifications()
      .catch(err => this.logger.error(`Notification refresh failed: ${err?.message}`))
  }

  // Setiap hari jam 02:00 WIB — hapus file orphaned yang tidak ada referensinya di DB
  @Cron('0 2 * * *', { name: 'orphaned-files-cleanup', timeZone: 'Asia/Jakarta' })
  async cleanupOrphanedFiles() {
    this.logger.log('Starting orphaned files cleanup...')
    let deleted = 0
    const uploadsRoot = join(process.cwd(), 'uploads')
    if (!existsSync(uploadsRoot)) return

    try {
      // Ambil semua fileUrl aktif dari DB secara paralel
      const [
        employeeDocs, warningLetters, legalKoperasi, vendorContracts,
        akteDokumen, employees, contracts, appSettings,
      ] = await Promise.all([
        this.prisma.employeeDocument.findMany({ select: { fileUrl: true } }),
        this.prisma.warningLetter.findMany({ select: { documentUrl: true } }),
        this.prisma.legalKoperasi.findMany({ select: { fileUrl: true } }),
        this.prisma.vendorContract.findMany({ select: { fileUrl: true } }),
        this.prisma.akteDokumen.findMany({ select: { fileUrl: true } }),
        this.prisma.employee.findMany({ select: { fotoKaryawan: true } }),
        this.prisma.contract.findMany({ select: { documentUrl: true, generatedPdfUrl: true } }),
        // AppSetting menyimpan URL file logo & background di kolom `value`
        (this.prisma.appSetting as any).findMany({ select: { value: true } }),
      ])

      // Kumpulkan semua path yang aktif (relatif, tanpa leading slash)
      const activePaths = new Set<string>()
      const addPath = (url: string | null | undefined) => {
        if (!url) return
        activePaths.add(url.startsWith('/') ? url.slice(1) : url)
      }
      employeeDocs.forEach(d => addPath(d.fileUrl))
      warningLetters.forEach(d => addPath(d.documentUrl))
      legalKoperasi.forEach(d => addPath(d.fileUrl))
      vendorContracts.forEach(d => addPath(d.fileUrl))
      akteDokumen.forEach(d => addPath(d.fileUrl))
      employees.forEach(d => addPath(d.fotoKaryawan))
      contracts.forEach(d => { addPath(d.documentUrl); addPath(d.generatedPdfUrl) })
      // AppSetting: hanya nilai yang berisi path uploads (logo, background login)
      appSettings.forEach((s: { value: string | null }) => {
        if (s.value?.startsWith('/uploads/')) addPath(s.value)
      })

      // Scan semua file di uploads/ dan hapus yang orphaned
      const cutoff = Date.now() - 24 * 60 * 60 * 1000 // lebih dari 1 hari
      const scanDir = (dir: string, relBase: string) => {
        if (!existsSync(dir)) return
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry)
          const rel = `${relBase}/${entry}`
          const stat = statSync(full)
          if (stat.isDirectory()) {
            scanDir(full, rel)
          } else if (stat.isFile() && entry !== '.gitkeep') {
            if (!activePaths.has(rel) && stat.mtimeMs < cutoff) {
              try {
                unlinkSync(full)
                deleted++
                this.logger.debug(`Deleted orphaned file: ${rel}`)
              } catch {
                // non-fatal
              }
            }
          }
        }
      }
      scanDir(uploadsRoot, 'uploads')
      this.logger.log(`Orphaned files cleanup complete. ${deleted} file(s) deleted.`)
    } catch (err: any) {
      this.logger.error(`Orphaned files cleanup failed: ${err?.message}`)
    }
  }
}
