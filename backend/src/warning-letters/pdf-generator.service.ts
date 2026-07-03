import { Injectable } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import * as path from 'path'
import * as fs from 'fs'

@Injectable()
export class PdfGeneratorService {
  private readonly fontDir = 'C:/Windows/Fonts'
  private readonly logoPath = path.join(__dirname, '../../assets/logo-sp.png')

  private formatDate(date: Date | string): string {
    const d = new Date(date)
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  async generateWarningLetter(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: true,
      })

      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Register fonts
      doc.registerFont('TimesNewRoman', path.join(this.fontDir, 'times.ttf'))
      doc.registerFont('TimesNewRoman-Bold', path.join(this.fontDir, 'timesbd.ttf'))
      doc.registerFont('Calibri', path.join(this.fontDir, 'calibri.ttf'))
      doc.registerFont('Calibri-Bold', path.join(this.fontDir, 'calibrib.ttf'))

      const { employee, violationType, warningLevel, letterDate, validUntil, processedByName, letterNumber } = data

      // === LOGO ===
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 35, 24, { width: 88, height: 86 })
      }

      // === KOP SURAT (Times New Roman Bold, centered) ===
      doc.font('TimesNewRoman-Bold').fontSize(14.3)
      doc.text('KOPERASI KARYAWAN', 130, 22, { align: 'center', width: 340 })
      doc.text('PT. SANKYU INDONESIA INTERNASIONAL', 130, 40, { align: 'center', width: 340 })
      doc.text('UNIT KANTOR PUSAT', 130, 58, { align: 'center', width: 340 })

      // === ALAMAT (Times New Roman 11.2pt) ===
      doc.font('TimesNewRoman').fontSize(11.2)
      doc.text('Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20', 139, 77, { width: 340 })
      doc.text('GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330', 139, 91, { width: 340 })
      doc.text('TELP. 021 - 50555340, FAX. 021- 50555341', 139, 106, { width: 340 })

      // Garis pembatas
      doc.moveTo(35, 122).lineTo(560, 122).stroke()

      // === JUDUL (Calibri-Bold 14.3pt, centered) ===
      doc.font('Calibri-Bold').fontSize(14.3)
      doc.text('SURAT PERINGATAN KARYAWAN', 72, 139, { align: 'center', width: 451 })

      // === NOMOR SURAT (Calibri-Bold 12pt, centered) ===
      doc.font('Calibri-Bold').fontSize(12)
      doc.text(`No : ${letterNumber}`, 72, 157, { align: 'center', width: 451 })

      // === BODY (Calibri 12pt, x=72) ===
      let y = 203
      doc.font('Calibri').fontSize(12)
      const violationLineGap = 2

      doc.text('Surat peringatan ini di tujukan kepada  :', 72, y)

      y = 230
      doc.text('Nama', 72, y)
      doc.text(`:   ${employee.fullName}`, 180, y)

      y = 255
      doc.text('NIK', 72, y)
      doc.text(`:  ${employee.employeeNo}`, 180, y)

      y = 279
      doc.text('Jabatan', 72, y)
      doc.text(`:  ${employee.jobRole?.name || '-'}`, 180, y)

      y = 303
      doc.text('Jenis Pelanggaran', 72, y)
      doc.text(':', 180, y)

      // Violations (numbered list) - dynamic height per item
      y = 328
      const violationWidth = 328
      const violationList = Array.isArray(violationType) ? violationType.filter(Boolean) : []

      if (violationList.length === 0) {
        doc.text('-', 195, y, { width: violationWidth })
        y = doc.y + 8
      } else {
        for (let i = 0; i < violationList.length; i++) {
          const itemText = `${i + 1}.  ${violationList[i]}`
          const itemBounds = doc.boundsOfString(itemText, 195, y, {
            width: violationWidth,
            align: 'left',
            lineGap: violationLineGap,
          })

          doc.text(itemText, 195, y, {
            width: violationWidth,
            align: 'left',
            lineGap: violationLineGap,
          })

          y += itemBounds.height + 8
        }
      }

      // Paragraf alasan
      y += 10
      const paragraf1 = `Surat peringatan ini diterbitkan berdasarkan kesalahan yang telah saudara ${employee.fullName} lakukan. Oleh karena itu perusahaan memberikan Surat Peringatan Ke ${warningLevel}, hal ini bertujuan untuk dapat memberikan arahan serta peringatan terhadap saudara agar mematuhi tata tertib perusahaan dan tidak melakukan kesalahan lagi yang dapat merugikan perusahaan.`
      doc.text(paragraf1, 72, y, { width: 451, align: 'justify' })

      // Paragraf berlaku
      y = doc.y + 20
      const paragraf2 = `Surat peringatan ini berlaku semenjak di terbitkan sampai dengan ${this.formatDate(validUntil)}. Surat peringatan ini dibuat agar dapat diperhatikan dan ditaati oleh yang bersangkutan.`
      doc.text(paragraf2, 72, y, { width: 451, align: 'justify' })

      // === TANGGAL ===
      y = doc.y + 40
      doc.text(`Bekasi, ${this.formatDate(letterDate)}`, 72, y)

      // === TANDA TANGAN ===
      y += 53
      doc.text('Penerima SP', 108, y)
      doc.text('Pengurus Koprasi', 397, y)

      y += 67
      doc.text(`( ${employee.fullName} )`, 72, y)
      doc.text(`(${processedByName})`, 397, y)

      doc.end()
    })
  }
}
