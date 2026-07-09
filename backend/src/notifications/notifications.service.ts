import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { startOfDay } from '../shared/date-utils'

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(limit = 10) {
    return this.prisma.notification.findMany({
      where: { resolvedAt: null },
      orderBy: [
        { severity: 'desc' }, // CRITICAL > WARNING (alphabetically desc)
        { createdAt: 'desc' },
      ],
      take: limit,
    })
  }

  async getUnreadCount(): Promise<number> {
    return this.prisma.notification.count({
      where: { isRead: false, resolvedAt: null },
    })
  }

  async markAllRead() {
    return this.prisma.notification.updateMany({
      where: { isRead: false, resolvedAt: null },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markOneRead(id: number) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async generateNotifications(): Promise<{ created: number; resolved: number }> {
    const TRIGGER_DAYS = [90, 60, 30, 7, 0]
    const today = startOfDay(new Date())
    let created = 0
    let resolved = 0

    for (const triggerDay of TRIGGER_DAYS) {
      const targetDate = new Date(today.getTime() + triggerDay * 24 * 60 * 60 * 1000)
      const severity = triggerDay <= 7 ? 'CRITICAL' : 'WARNING'
      const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

      // 1. KONTRAK_KARYAWAN - contracts table
      const contracts = await this.prisma.contract.findMany({
        where: {
          endDate: { gte: targetDate, lt: nextDay },
          status: { in: ['AKTIF', 'AKAN_HABIS'] },
        },
        include: { employee: { select: { fullName: true } } },
      })
      for (const c of contracts) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'KONTRAK_KARYAWAN',
              severity,
              title: `Kontrak Karyawan ${triggerDay === 0 ? 'Expired' : 'Akan Habis'}`,
              message: `Kontrak ${c.employee.fullName} (${c.contractNo}) berakhir ${daysText}`,
              sourceType: 'contract',
              sourceId: c.id,
              triggerDay,
              deeplink: triggerDay === 0 ? '/kontrak?status=EXPIRED' : '/kontrak?status=AKAN_HABIS',
              expiryDate: c.endDate,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }

      // 2. SERTIFIKASI_IJIN - employee_documents table
      const docs = await this.prisma.employeeDocument.findMany({
        where: {
          expiryDate: { gte: targetDate, lt: nextDay },
          status: { not: 'EXPIRED' },
        },
        include: {
          employee: { select: { fullName: true } },
          documentType: { select: { name: true } },
        },
      })
      for (const d of docs) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'SERTIFIKASI_IJIN',
              severity,
              title: `Sertifikasi/Ijin ${triggerDay === 0 ? 'Expired' : 'Akan Expired'}`,
              message: `${d.documentType?.name ?? 'Dokumen'} milik ${d.employee.fullName} berakhir ${daysText}`,
              sourceType: 'employee_document',
              sourceId: d.id,
              triggerDay,
              deeplink:
                triggerDay === 0
                  ? '/dokumen/sertifikasi-ijin?status=EXPIRED'
                  : '/dokumen/sertifikasi-ijin?status=AKAN_EXPIRED',
              expiryDate: d.expiryDate!,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }

      // 3. KONTRAK_VENDOR - vendor_contracts table
      const vendors = await this.prisma.vendorContract.findMany({
        where: {
          endDate: { gte: targetDate, lt: nextDay },
          status: { in: ['AKTIF', 'AKAN_BERAKHIR'] },
          renewedTo: null,
        },
        include: { company: { select: { name: true } } },
      })
      for (const v of vendors) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        const companyName = v.company?.name ?? 'Vendor'
        try {
          await this.prisma.notification.create({
            data: {
              category: 'KONTRAK_VENDOR',
              severity,
              title: `Kontrak Vendor ${triggerDay === 0 ? 'Expired' : 'Akan Berakhir'}`,
              message: `Kontrak ${companyName} (${v.documentNumber}) berakhir ${daysText}`,
              sourceType: 'vendor_contract',
              sourceId: v.id,
              triggerDay,
              deeplink:
                triggerDay === 0
                  ? '/dokumen-legal/kontrak-vendor?status=EXPIRED'
                  : '/dokumen-legal/kontrak-vendor?status=AKAN_BERAKHIR',
              expiryDate: v.endDate!,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }

      // 4. LEGAL_KOPERASI - legal_koperasi table
      const legals = await this.prisma.legalKoperasi.findMany({
        where: {
          endDate: { gte: targetDate, lt: nextDay },
          needsRenewal: true,
          status: { not: 'EXPIRED' },
          renewedTo: null,
        },
      })
      for (const lk of legals) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'LEGAL_KOPERASI',
              severity,
              title: `Legal Koperasi ${triggerDay === 0 ? 'Expired' : 'Akan Berakhir'}`,
              message: `${lk.documentName} berakhir ${daysText}`,
              sourceType: 'legal_koperasi',
              sourceId: lk.id,
              triggerDay,
              deeplink:
                triggerDay === 0
                  ? '/dokumen-legal/legal-koperasi?status=EXPIRED'
                  : '/dokumen-legal/legal-koperasi?status=AKAN_BERAKHIR',
              expiryDate: lk.endDate!,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }
    }

    // Auto-resolve: contracts that have child contracts or status = SELESAI
    const renewedContracts = await this.prisma.contract.findMany({
      where: { OR: [{ childContracts: { some: {} } }, { status: 'SELESAI' }] },
      select: { id: true },
    })
    if (renewedContracts.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: 'contract',
          sourceId: { in: renewedContracts.map(c => c.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Auto-resolve: legal koperasi that have been renewed (renewedTo is not null)
    const renewedLegals = await this.prisma.legalKoperasi.findMany({
      where: { renewedTo: { isNot: null } },
      select: { id: true },
    })
    if (renewedLegals.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: 'legal_koperasi',
          sourceId: { in: renewedLegals.map(l => l.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Auto-resolve: vendor contracts that have been renewed (renewedTo is not null)
    const renewedVendors = await this.prisma.vendorContract.findMany({
      where: { renewedTo: { isNot: null } },
      select: { id: true },
    })
    if (renewedVendors.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: 'vendor_contract',
          sourceId: { in: renewedVendors.map(v => v.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    return { created, resolved }
  }
}
