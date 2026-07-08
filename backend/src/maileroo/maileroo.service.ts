import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const MAILEROO_API_URL = 'https://smtp.maileroo.com/api/v2/emails'

interface ContractStatusChange {
  contractNo: string
  employeeName: string
  endDate: Date
  newStatus: 'AKAN_HABIS' | 'EXPIRED'
}

interface DocumentStatusChange {
  documentName: string
  employeeName: string
  expiryDate: Date
  newStatus: 'AKAN_EXPIRED' | 'EXPIRED'
}

@Injectable()
export class MailerooService {
  private readonly logger = new Logger(MailerooService.name)

  constructor(private prisma: PrismaService) {}

  async sendEmail(payload: {
    to: { email: string; name?: string }[]
    subject: string
    html: string
  }): Promise<boolean> {
    const apiKey = process.env.MAILEROO_API_KEY
    const fromEmail = process.env.MAILEROO_FROM_EMAIL || 'noreply@localhost'
    const fromName = process.env.MAILEROO_FROM_NAME || 'System'

    if (!apiKey) {
      this.logger.warn('MAILEROO_API_KEY not set, skipping email')
      return false
    }

    try {
      const res = await fetch(MAILEROO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          from: { address: fromEmail, display_name: fromName },
          to: payload.to.map(r => ({ address: r.email, display_name: r.name })),
          subject: payload.subject,
          html: payload.html,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        this.logger.error(`Maileroo API error ${res.status}: ${errText}`)
        return false
      }

      const data = await res.json() as { success: boolean; message: string }
      this.logger.log(`Email sent: ${data.message}`)
      return true
    } catch (err: any) {
      this.logger.error(`Failed to send email: ${err?.message}`)
      return false
    }
  }

  async sendDocumentStatusNotification(changes: DocumentStatusChange[]): Promise<boolean> {
    if (!changes.length) return false

    const users = await this.prisma.userAccount.findMany({
      select: { email: true, name: true },
    })

    if (!users.length) {
      this.logger.warn('No UserAccount emails found, skipping notification')
      return false
    }

    const akanExpired = changes.filter(c => c.newStatus === 'AKAN_EXPIRED')
    const expired = changes.filter(c => c.newStatus === 'EXPIRED')

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

    const subject = `[Kokarsi] Notifikasi Perubahan Status Dokumen Karyawan - ${today}`

    const html = this.buildDocumentEmailHtml(akanExpired, expired, today)

    return this.sendEmail({
      to: users.map(u => ({ email: u.email, name: u.name })),
      subject,
      html,
    })
  }

  private buildDocumentEmailHtml(
    akanExpired: DocumentStatusChange[],
    expired: DocumentStatusChange[],
    today: string,
  ): string {
    const fmtDate = (d: Date) =>
      new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const tableRows = (items: DocumentStatusChange[]) =>
      items.map(d => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">${d.employeeName}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">${d.documentName}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">${fmtDate(d.expiryDate)}</td>
        </tr>
      `).join('')

    let sections = ''

    if (akanExpired.length) {
      sections += `
        <h3 style="color:#f59e0b;margin:0 0 8px;">&#9888;&#65039; Dokumen Akan Expired (≤ 30 hari) — ${akanExpired.length} dokumen</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
          <thead>
            <tr style="background:#fef3c7;">
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Karyawan</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Dokumen</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Berakhir</th>
            </tr>
          </thead>
          <tbody>${tableRows(akanExpired)}</tbody>
        </table>
      `
    }

    if (expired.length) {
      sections += `
        <h3 style="color:#ef4444;margin:0 0 8px;">&#128308; Dokumen Expired — ${expired.length} dokumen</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
          <thead>
            <tr style="background:#fee2e2;">
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Karyawan</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Dokumen</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Berakhir</th>
            </tr>
          </thead>
          <tbody>${tableRows(expired)}</tbody>
        </table>
      `
    }

    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0891b2;color:white;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Notifikasi Status Dokumen Karyawan</h2>
          <p style="margin:4px 0 0;opacity:0.9;">Kokarsi PT. Sankyu — ${today}</p>
        </div>
        <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <p>Berikut pembaruan status dokumen karyawan per hari ini:</p>
          ${sections}
          <p style="margin-top:20px;color:#64748b;font-size:13px;">
            Total: ${akanExpired.length} akan expired, ${expired.length} expired.<br>
            Silakan login ke sistem untuk tindak lanjut.
          </p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">
          Email ini dikirim otomatis oleh sistem. Jangan balas email ini.
        </p>
      </div>
    `
  }

  async sendVendorContractNotification(changes: {
    documentName: string
    documentNumber: string
    companyName: string
    endDate: Date
    newStatus: 'AKAN_BERAKHIR' | 'EXPIRED'
  }[]): Promise<boolean> {
    if (!changes.length) return false

    const users = await this.prisma.userAccount.findMany({
      select: { email: true, name: true },
    })

    if (!users.length) {
      this.logger.warn('No UserAccount emails found, skipping vendor contract notification')
      return false
    }

    const akanBerakhir = changes.filter(c => c.newStatus === 'AKAN_BERAKHIR')
    const expired = changes.filter(c => c.newStatus === 'EXPIRED')
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const subject = `[Kokarsi] Notifikasi Status Kontrak Customer/Vendor - ${today}`

    const fmtDate = (d: Date) =>
      new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const tableRows = (items: typeof changes) =>
      items.map(c => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;">${c.companyName}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;">${c.documentName}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;">${c.documentNumber}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;">${fmtDate(c.endDate)}</td>
      </tr>
    `).join('')

    let sections = ''
    if (akanBerakhir.length) {
      sections += `
      <h3 style="color:#f59e0b;margin:0 0 8px;">&#9888; Akan Berakhir (≤ 30 hari) — ${akanBerakhir.length} kontrak</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
        <thead><tr style="background:#fef3c7;">
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Perusahaan</th>
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Dokumen</th>
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">No. Dokumen</th>
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Berakhir</th>
        </tr></thead>
        <tbody>${tableRows(akanBerakhir)}</tbody>
      </table>`
    }
    if (expired.length) {
      sections += `
      <h3 style="color:#ef4444;margin:0 0 8px;">&#128308; Expired — ${expired.length} kontrak</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
        <thead><tr style="background:#fee2e2;">
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Perusahaan</th>
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Dokumen</th>
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">No. Dokumen</th>
          <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Berakhir</th>
        </tr></thead>
        <tbody>${tableRows(expired)}</tbody>
      </table>`
    }

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#7c3aed;color:white;padding:20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">Notifikasi Status Kontrak Customer/Vendor</h2>
        <p style="margin:4px 0 0;opacity:0.9;">Kokarsi PT. Sankyu — ${today}</p>
      </div>
      <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p>Berikut pembaruan status kontrak per hari ini:</p>
        ${sections}
        <p style="margin-top:20px;color:#64748b;font-size:13px;">Silakan login ke sistem untuk tindak lanjut.</p>
      </div>
    </div>`

    return this.sendEmail({
      to: users.map(u => ({ email: u.email, name: u.name })),
      subject,
      html,
    })
  }

  async sendContractStatusNotification(changes: ContractStatusChange[]): Promise<boolean> {
    if (!changes.length) return false

    const users = await this.prisma.userAccount.findMany({
      select: { email: true, name: true },
    })

    if (!users.length) {
      this.logger.warn('No UserAccount emails found, skipping notification')
      return false
    }

    const akanHabis = changes.filter(c => c.newStatus === 'AKAN_HABIS')
    const expired = changes.filter(c => c.newStatus === 'EXPIRED')

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

    const subject = `[Kokarsi] Notifikasi Perubahan Status Kontrak - ${today}`

    const html = this.buildEmailHtml(akanHabis, expired, today)

    return this.sendEmail({
      to: users.map(u => ({ email: u.email, name: u.name })),
      subject,
      html,
    })
  }

  private buildEmailHtml(
    akanHabis: ContractStatusChange[],
    expired: ContractStatusChange[],
    today: string,
  ): string {
    const fmtDate = (d: Date) =>
      new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const tableRows = (items: ContractStatusChange[]) =>
      items.map(c => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">${c.employeeName}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;">${c.contractNo}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">${fmtDate(c.endDate)}</td>
        </tr>
      `).join('')

    let sections = ''

    if (akanHabis.length) {
      sections += `
        <h3 style="color:#f59e0b;margin:0 0 8px;">⚠️ Kontrak Akan Habis (≤ 30 hari) — ${akanHabis.length} kontrak</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
          <thead>
            <tr style="background:#fef3c7;">
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Karyawan</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">No. Kontrak</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Berakhir</th>
            </tr>
          </thead>
          <tbody>${tableRows(akanHabis)}</tbody>
        </table>
      `
    }

    if (expired.length) {
      sections += `
        <h3 style="color:#ef4444;margin:0 0 8px;">🔴 Kontrak Expired — ${expired.length} kontrak</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
          <thead>
            <tr style="background:#fee2e2;">
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Nama Karyawan</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">No. Kontrak</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Berakhir</th>
            </tr>
          </thead>
          <tbody>${tableRows(expired)}</tbody>
        </table>
      `
    }

    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#2563eb;color:white;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Notifikasi Status Kontrak</h2>
          <p style="margin:4px 0 0;opacity:0.9;">Kokarsi PT. Sankyu — ${today}</p>
        </div>
        <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <p>Berikut pembaruan status kontrak karyawan per hari ini:</p>
          ${sections}
          <p style="margin-top:20px;color:#64748b;font-size:13px;">
            Total: ${akanHabis.length} akan habis, ${expired.length} expired.<br>
            Silakan login ke sistem untuk tindak lanjut.
          </p>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">
          Email ini dikirim otomatis oleh sistem. Jangan balas email ini.
        </p>
      </div>
    `
  }
}
