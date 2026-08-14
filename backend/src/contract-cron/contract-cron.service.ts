import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ContractStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MailerooService } from '../maileroo/maileroo.service'
import { DAY_MS, startOfDay } from '../shared/date-utils'
import { VendorContractsService } from '../vendor-contracts/vendor-contracts.service'
import { LegalKoperasiService } from '../legal-koperasi/legal-koperasi.service'
import { NotificationsService } from '../notifications/notifications.service'
import { EmailNotificationConfigService } from '../email-notification-config/email-notification-config.service'
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
    private emailConfig: EmailNotificationConfigService,
  ) {}

  // Setiap hari jam 00:01 WIB (Asia/Jakarta)
  @Cron('1 0 * * *', { name: 'contract-status-sync', timeZone: 'Asia/Jakarta' })
  async syncContractStatuses() {
    this.logger.log('Starting contract status synchronization...')

    // Read email config from DB
    const emailEnabled = await this.emailConfig.isEnabled()
    const recipients = emailEnabled ? await this.emailConfig.getActiveRecipients() : []
    const triggerWindows = await this.emailConfig.getTriggerWindows()

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

    // Kirim email notifikasi per trigger window dengan deduplication
    if (emailEnabled && recipients.length > 0 && updates.length > 0) {
      const todayMs = startOfDay(new Date())

      // AKAN_HABIS: kirim per window, skip jika sudah pernah dikirim
      for (const window of triggerWindows) {
        const changesForWindow: typeof updates = []
        for (const u of updates) {
          if (u.newStatus === 'AKAN_HABIS') {
            const daysLeft = Math.ceil((startOfDay(u.endDate).getTime() - todayMs.getTime()) / DAY_MS)
            if (daysLeft === window) {
              const alreadySent = await this.emailConfig.hasSent('contract', u.id, window)
              if (!alreadySent) changesForWindow.push(u)
            }
          }
        }
        if (changesForWindow.length > 0) {
          this.logger.log(`Sending contract email for window=${window}d: ${changesForWindow.length} contract(s)`)
          const sent = await this.maileroo
            .sendContractStatusNotification(
              changesForWindow.map(u => ({
                contractNo: u.contractNo,
                employeeName: u.employeeName,
                endDate: u.endDate,
                newStatus: u.newStatus as 'AKAN_HABIS' | 'EXPIRED',
              })),
              recipients,
            )
            .catch(err => { this.logger.error(`Email notification failed: ${err?.message}`); return false })
          if (sent) {
            for (const u of changesForWindow) {
              await this.emailConfig.recordSent('contract', u.id, window)
            }
          }
        }
      }

      // EXPIRED: sentinel -1, kirim sekali per kontrak
      const expiredUnsent: typeof updates = []
      for (const u of updates.filter(u => u.newStatus === 'EXPIRED')) {
        const alreadySent = await this.emailConfig.hasSent('contract', u.id, -1)
        if (!alreadySent) expiredUnsent.push(u)
      }
      if (expiredUnsent.length > 0) {
        this.logger.log(`Sending expired contract email: ${expiredUnsent.length} contract(s)`)
        const sent = await this.maileroo
          .sendContractStatusNotification(
            expiredUnsent.map(u => ({
              contractNo: u.contractNo,
              employeeName: u.employeeName,
              endDate: u.endDate,
              newStatus: u.newStatus as 'AKAN_HABIS' | 'EXPIRED',
            })),
            recipients,
          )
          .catch(err => { this.logger.error(`Email notification failed: ${err?.message}`); return false })
        if (sent) {
          for (const u of expiredUnsent) {
            await this.emailConfig.recordSent('contract', u.id, -1)
          }
        }
      }
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
      // Filter yang belum pernah dikirim email (dedup via sentinel -1)
      const unsent: typeof expiringSoon = []
      for (const d of expiringSoon) {
        const alreadySent = await this.emailConfig.hasSent('employee_document', d.id, -1)
        if (!alreadySent) unsent.push(d)
      }

      // Commit status SELALU dijalankan agar status tetap ter-sync meski email nonaktif
      await this.prisma.employeeDocument.updateMany({
        where: { id: { in: expiringSoon.map(d => d.id) } },
        data: { status: 'AKAN_EXPIRED' },
      })
      this.logger.log(`${expiringSoon.length} document(s) marked as AKAN_EXPIRED.`)

      if (unsent.length > 0 && emailEnabled && recipients.length > 0) {
        const docNotifyAkan = unsent.map(d => ({
          documentName: d.documentType?.name ?? 'Dokumen',
          employeeName: d.employee.fullName,
          expiryDate: d.expiryDate,
          newStatus: 'AKAN_EXPIRED' as const,
        }))

        const sent = await this.maileroo
          .sendDocumentStatusNotification(docNotifyAkan, recipients)
          .catch(err => { this.logger.error(`Document email notification failed: ${err?.message}`); return false })

        if (sent) {
          for (const d of unsent) {
            await this.emailConfig.recordSent('employee_document', d.id, -1)
          }
        }
      }
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
      // Filter yang belum pernah dikirim email (dedup via sentinel -1)
      const unsent: typeof expiredDocs = []
      for (const d of expiredDocs) {
        const alreadySent = await this.emailConfig.hasSent('employee_document', d.id, -1)
        if (!alreadySent) unsent.push(d)
      }

      // Commit status SELALU dijalankan agar status tetap ter-sync meski email nonaktif
      await this.prisma.employeeDocument.updateMany({
        where: { id: { in: expiredDocs.map(d => d.id) } },
        data: { status: 'EXPIRED' },
      })
      this.logger.log(`${expiredDocs.length} document(s) marked as EXPIRED.`)

      if (unsent.length > 0 && emailEnabled && recipients.length > 0) {
        const docNotifyExpired = unsent.map(d => ({
          documentName: d.documentType?.name ?? 'Dokumen',
          employeeName: d.employee.fullName,
          expiryDate: d.expiryDate,
          newStatus: 'EXPIRED' as const,
        }))

        const sent = await this.maileroo
          .sendDocumentStatusNotification(docNotifyExpired, recipients)
          .catch(err => { this.logger.error(`Document email notification failed: ${err?.message}`); return false })

        if (sent) {
          for (const d of unsent) {
            await this.emailConfig.recordSent('employee_document', d.id, -1)
          }
        }
      }
    }

    this.logger.debug('Employee document status sync complete.')

    // ── VendorContract status sync ──────────────────────────────────────
    this.logger.debug('Syncing vendor contract statuses...')
    const { akanBerakhir: vcAkan, expired: vcExpired } = await this.vendorContractsService.syncExpiredStatuses()

    // Filter yang belum pernah dikirim email (dedup via sentinel -1)
    const vcUnsentAkan: any[] = []
    for (const vc of vcAkan) {
      if (!(await this.emailConfig.hasSent('vendor_contract', vc.id, -1))) vcUnsentAkan.push(vc)
    }
    const vcUnsentExpired: any[] = []
    for (const vc of vcExpired) {
      if (!(await this.emailConfig.hasSent('vendor_contract', vc.id, -1))) vcUnsentExpired.push(vc)
    }

    const vcChanges = [
      ...vcUnsentAkan.map((vc: any) => ({
        documentName: vc.documentName,
        documentNumber: vc.documentNumber,
        companyName: vc.company?.name ?? '-',
        endDate: vc.endDate!,
        newStatus: 'AKAN_BERAKHIR' as const,
      })),
      ...vcUnsentExpired.map((vc: any) => ({
        documentName: vc.documentName,
        documentNumber: vc.documentNumber,
        companyName: vc.company?.name ?? '-',
        endDate: vc.endDate!,
        newStatus: 'EXPIRED' as const,
      })),
    ]

    // Commit status SELALU dijalankan agar status tetap ter-sync meski email nonaktif
    await this.vendorContractsService.commitStatuses(
      vcAkan.map((vc: any) => vc.id),
      vcExpired.map((vc: any) => vc.id),
    )

    if (vcChanges.length > 0 && emailEnabled && recipients.length > 0) {
      const sent = await this.maileroo.sendVendorContractNotification(vcChanges, recipients)
        .catch(err => { this.logger.error(`Vendor contract notification failed: ${err?.message}`); return false })

      if (sent) {
        for (const vc of vcUnsentAkan) await this.emailConfig.recordSent('vendor_contract', vc.id, -1)
        for (const vc of vcUnsentExpired) await this.emailConfig.recordSent('vendor_contract', vc.id, -1)
      }
    }

    // ── LegalKoperasi status sync ──────────────────────────────────────
    this.logger.debug('Syncing legal koperasi statuses...')
    const { akanBerakhir: lkAkan, expired: lkExpired } = await this.legalKoperasiService.syncExpiredStatuses()

    // Filter yang belum pernah dikirim email (dedup via sentinel -1)
    const lkUnsentAkan: any[] = []
    for (const lk of lkAkan) {
      if (!(await this.emailConfig.hasSent('legal_koperasi', lk.id, -1))) lkUnsentAkan.push(lk)
    }
    const lkUnsentExpired: any[] = []
    for (const lk of lkExpired) {
      if (!(await this.emailConfig.hasSent('legal_koperasi', lk.id, -1))) lkUnsentExpired.push(lk)
    }

    const lkChanges = [
      ...lkUnsentAkan.map((lk: any) => ({
        documentName: lk.documentName,
        publisher: lk.publisher,
        endDate: lk.endDate!,
        newStatus: 'AKAN_BERAKHIR' as const,
      })),
      ...lkUnsentExpired.map((lk: any) => ({
        documentName: lk.documentName,
        publisher: lk.publisher,
        endDate: lk.endDate!,
        newStatus: 'EXPIRED' as const,
      })),
    ]

    // Commit status SELALU dijalankan agar status tetap ter-sync meski email nonaktif
    await this.legalKoperasiService.commitStatuses(
      lkAkan.map((lk: any) => lk.id),
      lkExpired.map((lk: any) => lk.id),
    )

    if (lkChanges.length > 0 && emailEnabled && recipients.length > 0) {
      const sent = await this.maileroo.sendLegalKoperasiNotification(lkChanges, recipients)
        .catch(err => { this.logger.error(`Legal koperasi notification failed: ${err?.message}`); return false })

      if (sent) {
        for (const lk of lkUnsentAkan) await this.emailConfig.recordSent('legal_koperasi', lk.id, -1)
        for (const lk of lkUnsentExpired) await this.emailConfig.recordSent('legal_koperasi', lk.id, -1)
      }
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
