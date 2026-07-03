import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { promises as fs, existsSync } from 'fs'
import { join, resolve } from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { getContractDocumentDefinition } from './contract-document-definitions'

type RenderEngine = 'PDF_NATIVE'
type LayoutMode = 'LEGAL_PDF_TEMPLATE'
type HeaderVariant = 'PKWT' | 'MITRA'

type TextAlign = 'left' | 'center' | 'justify'

interface TextBlock {
  text: string
  font: string
  fontSize: number
  align?: TextAlign
  gapBefore?: number
  gapAfter?: number
}

interface LayoutContext {
  pageWidth: number
  pageHeight: number
  leftX: number
  rightX: number
  columnWidth: number
  topY: number
  bottomY: number
  headerBottomY: number
}

@Injectable()
export class ContractDocumentService {
  constructor(private prisma: PrismaService) {}

  private readonly renderEngine: RenderEngine = 'PDF_NATIVE'
  private readonly layoutMode: LayoutMode = 'LEGAL_PDF_TEMPLATE'
  private readonly assetRoot = resolve(process.cwd(), 'assets')
  private readonly pkwtLogoPath = join(this.assetRoot, 'contract-logo-pkwt.jpg')
  private readonly mitraLogoPath = join(this.assetRoot, 'contract-logo-mitra.jpg')

  private include = {
    employee: {
      include: {
        jobRole: true,
        workLocation: true,
        department: true,
      },
    },
    contractType: true,
    template: true,
  }

  private readonly pkwtEnglishSectionMap: Record<string, string[]> = {
    'Pasal 1\nMaksud Kesepakatan': [
      '1. Company employ the Employee for stated periods according to company need.',
      '2. Work Location in Koperation PT Sankyu Indonesia International for work section.',
      '3. The company has the right to move employee from one job to other or from one section to other with doesn\'t reduce the agreed wage in this agreement.',
    ],
    'Pasal 2\nMasa Berlakunya Kesepakatan Kerja': [
      '__TERM_DATE__',
      '2. In this Agreement for Certain Time doesn\'t required probation period.',
    ],
    'Pasal 3\nPengupahan': [
      '__WAGE_AMOUNT__',
      '2. Company shall deduct employee\'s wage for individual income tax.',
      '3. Employee\'s wage shall be paid on date of 7 every month.',
    ],
    'Pasal 4\nWaktu Kerja': [
      'In view of the provision of behave laws, company working hour is 40 (Forty) hours a week.',
    ],
    'Pasal 5\nPembebasan dari Kewajiban Bekerja': [
      '1. Employee could be given permit to leave his/her job because of sick or get accident if it completed by certificate of doctor.',
      '2. Employee could be given permit to leave his/her job in case of important matter after getting approval from company.',
    ],
    'Pasal 6\nTata Tertib Kerja': [
      '1. Employee is obliged to pay attention and follow work safety rules ordered by the company.',
      '2. Employee is forbidden bring working tools of company property to out of work place for private business without permit from company leader.',
      '3. Employee is obliged to use work equipment in doing the task and should be polite.',
      '4. Every lose or damage of work equipment should be reported by employee to company leader. Employee who deliberate or his negligence become suffer a financial lose for the company, he/she oblige to change the lose.',
      '5. Employee is obliged to maintain the equipment of company property.',
    ],
    'Pasal 7\nDisiplin Kerja': [
      '1. Employees will be given sanctions in the form of termination of employment without receiving any form of compensation, if employees commit serious violations as described below:',
      'a. Giving counterfeit or to be counterfeited information When the agreement made.',
      'b. Drunk, opium, using drugs medicine or narcotic in working place.',
      'c. Doing immoral action in working place.',
      'd. Doing the criminal action such as : steal, embezzle, cheat, trading forbid goods in or out of company environment.',
      'e. Oppressing, humiliate coarsely or threaten owner, owner family or colleague.',
      'f. Persuading owner or colleague to do something that opposite with law or moral.',
      'g. Expressly or careless damaging, losing out or let company\'s property in danger condition.',
      'h. Opening company secret or blackened the company leader and his family that should be closed by him, except for the state need.',
      'i. Smoking at the forbid place in the sensitive location toward fire.',
      'j. Undergoing legal proceedings resulting in an inability to work for more than six months, disrupting company productivity or the company\'s work results.',
      'k. Borrowing or using equipment or goods belonging to the company or vendors without the permission of the company\'s superior or management.',
    ],
    'Pasal 8\nMangkir': [
      '1. If employee doesn\'t go to the office without permit or he/she can\'t give the accepted reason, so the concerned employee is assumed absent.',
      '2. If employee absent for 5 (Five) working days continuously, and he/she has been called 2 times in writing, but he/she can\'t give valid prove, the employee is called as resign according to the Law No. 13/2003 about labour.',
    ],
    'Pasal 9\nBerakhirnya Kesepakatan': [
      '1. The agreement of Certain Time finish to law by the end of time as mentioned in article 2, paragraph 1 of this agreement, so the company hasn\'t obliged to pay anything of severance and long service to the employee.',
      '2. The Agreement of Certain is finish automatically because the concerned employee died.',
      '3. Company can terminate this Agreement of Certain Time employee do weight mistake or forced reason regarding to Article 7 and 8.',
      '4. The contract between the cooperative and PT Sankyu Indonesia International ended and the contract was not extended.',
    ],
    'Pasal 10\nTugas dan Tanggung Jawab': [
      '1. Employee should do work job well regarding to instruction of superior or company leader.',
      '2. The employee should keep secret all information get from the company during work and will not announce the information without permit from the company.',
    ],
    'Pasal 11\nPenyelesaian Keluh Kesah': [
      '1. When there is contradiction of this agreement and work requirements will complete by mutual discussion before completed though to valid provision.',
      '2. The valid Work requirements and not yet mention in this agreement will be valid according to the valid rule and law.',
      '3. Government in this case Labour Department can make modifications or review if work requirements in this agreement is not comfort by the valid labour rule.',
    ],
  }

  private formatDate(date: Date | string | null | undefined) {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  private formatEnglishDate(date: Date | string | null | undefined) {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  private formatRupiah(value: number | null | undefined) {
    if (typeof value !== 'number') return '-'
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value)
  }

  private async ensureDir(path: string) {
    await fs.mkdir(path, { recursive: true })
  }

  private async loadContract(id: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: this.include,
    })

    if (!contract) throw new NotFoundException('Kontrak tidak ditemukan')
    if (!contract.template) throw new BadRequestException('Template dokumen kontrak belum dipilih')

    const definition = getContractDocumentDefinition(contract.template.templateKey)
    if (!definition) {
      throw new BadRequestException(`Template key ${contract.template.templateKey} belum terdaftar di generator dokumen`)
    }

    const employee = contract.employee
    const missingFields: string[] = []

    if (!employee.nik) missingFields.push('NIK karyawan')
    if (!employee.birthPlace) missingFields.push('Tempat lahir karyawan')
    if (!employee.address) missingFields.push('Alamat karyawan')
    if (!contract.baseCompensation) missingFields.push('Nominal kompensasi/upah kontrak')

    const meta = {
      contractNo: contract.contractNo,
      contractTypeName: contract.contractType?.name ?? '-',
      templateName: contract.template.name,
      signedDate: this.formatDate(contract.signedDate ?? contract.startDate),
      signedDateEn: this.formatEnglishDate(contract.signedDate ?? contract.startDate),
      startDate: this.formatDate(contract.startDate),
      startDateEn: this.formatEnglishDate(contract.startDate),
      endDate: this.formatDate(contract.endDate),
      endDateEn: this.formatEnglishDate(contract.endDate),
      compensation: this.formatRupiah(contract.baseCompensation),
      locationLabel: contract.workLocationLabel ?? employee.workLocation?.name ?? '-',
      positionLabel: contract.positionLabel ?? employee.jobRole?.name ?? definition.roleLabel,
      processedByName: (contract as any).processedByName ?? '',
    }

    return {
      contract,
      employee,
      definition,
      missingFields,
      meta,
    }
  }

  private getPdfReferenceRelativePath(templateKey: string) {
    const map: Record<string, string> = {
      PKWT_DRIVER: 'docs/sample-legal-doc/pdf/PKWT DRIVER 2026.pdf',
      PKWT_KASIR: 'docs/sample-legal-doc/pdf/PKWT KASIR 2026 -.pdf',
      PKWT_STAFF: 'docs/sample-legal-doc/pdf/PKWT STAFF 2026 .pdf',
      PKWT_WAREHOUSE: 'docs/sample-legal-doc/pdf/PKWT WAREHOUSE 2026.pdf',
      MITRA_DRIVER: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA DRIVER OPS .pdf',
      MITRA_KOMART: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA KOMART.pdf',
      MITRA_STAFF: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA STAFF.pdf',
      MITRA_WAREHOUSE: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA WAREHOUSE.pdf',
    }

    return map[templateKey] ?? null
  }

  async preview(id: number) {
    const payload = await this.loadContract(id)
    return {
      id,
      title: payload.definition.title,
      subtitle: payload.definition.subtitle,
      openingLine: payload.definition.openingLine,
      recitals: payload.definition.recitals,
      locationLine: payload.definition.locationLine,
      termLine: payload.definition.termLine,
      compensationLabel: payload.definition.compensationLabel,
      closingParagraphs: payload.definition.closingParagraphs,
      firstPartyLabel: payload.definition.firstPartyLabel,
      secondPartyLabel: payload.definition.secondPartyLabel,
      sections: payload.definition.sections,
      missingFields: payload.missingFields,
      downloadable: payload.missingFields.length === 0,
      generatedPdfUrl: payload.contract.generatedPdfUrl,
      renderEngine: this.renderEngine,
      layoutMode: this.layoutMode,
      employee: {
        employeeNo: payload.employee.employeeNo,
        fullName: payload.employee.fullName,
        nik: payload.employee.nik,
        birthPlace: payload.employee.birthPlace,
        birthDate: this.formatDate(payload.employee.birthDate),
        address: payload.employee.address,
      },
      contract: {
        contractNo: payload.meta.contractNo,
        contractTypeName: payload.meta.contractTypeName,
        templateName: payload.meta.templateName,
        signedDate: payload.meta.signedDate,
        startDate: payload.meta.startDate,
        endDate: payload.meta.endDate,
        compensation: payload.meta.compensation,
        locationLabel: payload.meta.locationLabel,
        positionLabel: payload.meta.positionLabel,
      },
      template: {
        id: payload.contract.template?.id,
        name: payload.contract.template?.name,
        code: payload.contract.template?.code,
        templateKey: payload.contract.template?.templateKey,
        family: payload.contract.template?.family,
        sourceTemplateRelativePath: this.getPdfReferenceRelativePath(payload.contract.template?.templateKey ?? ''),
        sourceTemplateFormat: 'PDF',
        fidelityNote: 'Dokumen kontrak dirender langsung ke PDF native dari kode dengan layout legal internal yang mengacu ke sample PDF referensi.',
      },
    }
  }

  private buildPkwtIndonesianBlocks(payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>): TextBlock[] {
    const genderLabel = payload.employee.gender === 'MALE' ? 'Laki-Laki' : 'Perempuan'
    const blocks: TextBlock[] = [
      {
        text: `Pada hari ini, ${payload.meta.signedDate}, yang bertanda tangan di bawah ini :`,
        font: 'Times-Roman',
        fontSize: 10.5,
        align: 'justify',
        gapAfter: 10,
      },
      {
        text: `I. Koperasi Karyawan PT. Sankyu Indonesia International – Unit Kantor Pusat, berkedudukan di Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav. 20 Cikarang Pusat Bekasi, yang selanjutnya disebut PERUSAHAAN.`,
        font: 'Times-Roman',
        fontSize: 10.5,
        align: 'justify',
        gapAfter: 8,
      },
      {
        text: '__PARTY_II_BLOCK__',
        font: 'Times-Bold',
        fontSize: 10.2,
        gapAfter: 10,
        partyII: {
          name: payload.employee.fullName,
          birthInfo: `${payload.employee.birthPlace ?? '-'}, ${this.formatDate(payload.employee.birthDate)}`,
          gender: genderLabel,
          address: payload.employee.address ?? '-',
        },
      } as any,
      {
        text: 'Kedua belah pihak telah menyetujui untuk mengadakan Kesepakatan Kerja untuk Waktu Tertentu dengan syarat-syarat sebagai berikut:',
        font: 'Times-Roman',
        fontSize: 10.5,
        align: 'justify',
        gapAfter: 10,
      },
    ]

    for (const section of payload.definition.sections) {
      // Replace placeholders with actual data
      const resolvedParagraphs = section.paragraphs.map(p => {
        if (p === '__TERM_DATE__') {
          return `1. Kesepakatan Kerja ini berlaku sejak tanggal ${payload.meta.startDate} sampai dengan tanggal ${payload.meta.endDate}.`
        }
        if (p === '__WAGE_AMOUNT__') {
          return `1. Karyawan akan menerima upah sebesar : ${payload.meta.compensation}.`
        }
        return p
      })
      
      blocks.push({
        text: section.heading,
        font: 'Times-Bold',
        fontSize: 11,
        align: 'center',
        gapBefore: 8,
        gapAfter: 6,
      })
      blocks.push({
        text: resolvedParagraphs.join('\n'),
        font: 'Times-Roman',
        fontSize: 10.4,
        align: 'justify',
        gapAfter: 8,
      })
    }

    // Do NOT include closing paragraphs here - they will be rendered separately outside the bordered columns
    return blocks
  }

  private buildPkwtEnglishBlocks(payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>): TextBlock[] {
    const genderLabel = payload.employee.gender === 'MALE' ? 'Male' : 'Female'
    const blocks: TextBlock[] = [
      {
        text: `Today, ${payload.meta.signedDateEn}, who undersign below :`,
        font: 'Times-Roman',
        fontSize: 10.5,
        align: 'justify',
        gapAfter: 10,
      },
      {
        text: `I. Koperasi Karyawan PT. Sankyu Indonesia International - Unit Kantor Pusat, In Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav. 20 Cikarang Pusat Bekasi, hereinafter refer to Company`,
        font: 'Times-Roman',
        fontSize: 10.5,
        align: 'justify',
        gapAfter: 8,
      },
      {
        text: '__PARTY_II_BLOCK__',
        font: 'Times-Bold',
        fontSize: 10.2,
        gapAfter: 10,
        partyII: {
          name: payload.employee.fullName,
          birthInfo: `${payload.employee.birthPlace ?? '-'}, ${this.formatEnglishDate(payload.employee.birthDate)}`,
          gender: genderLabel,
          address: payload.employee.address ?? '-',
          labels: ['Name', 'Birth date', 'Gender', 'Address'],
          suffix: 'Hereinafter refer to EMPLOYEE',
        },
      } as any,
      {
        text: 'Both parties have been agreed to engage Stated Periods Labour Agreement by requirements as follows :',
        font: 'Times-Roman',
        fontSize: 10.5,
        align: 'justify',
        gapAfter: 10,
      },
    ]

    for (const section of payload.definition.sections) {
      const translationHeading = section.heading
        .replace('Pasal', 'Article')
        .replace('Maksud Kesepakatan', 'Agreement Purpose')
        .replace('Masa Berlakunya Kesepakatan Kerja', 'Period Time of Agreement')
        .replace('Pengupahan', 'Remuneration')
        .replace('Waktu Kerja', 'Working Time')
        .replace('Pembebasan dari Kewajiban Bekerja', 'Acquitted from Work Obligation')
        .replace('Tata Tertib Kerja', 'Working Rule')
        .replace('Disiplin Kerja', 'Work Discipline')
        .replace('Mangkir', 'Absent')
        .replace('Berakhirnya Kesepakatan', 'End of Agreement')
        .replace('Tugas dan Tanggung Jawab', 'Duty and Responsible')
        .replace('Penyelesaian Keluh Kesah', 'Completion of Complain')

      blocks.push({
        text: translationHeading,
        font: 'Times-Bold',
        fontSize: 11,
        align: 'center',
        gapBefore: 8,
        gapAfter: 6,
      })

      const translatedParagraphs = this.pkwtEnglishSectionMap[section.heading] ?? section.paragraphs
      // Replace placeholders with actual data (English)
      const resolvedTranslated = translatedParagraphs.map(p => {
        if (p === '__TERM_DATE__') {
          return `1. This agreement is effective since ${payload.meta.startDateEn} up to ${payload.meta.endDateEn}.`
        }
        if (p === '__WAGE_AMOUNT__') {
          return `1. The employee shall accept wage amount : ${payload.meta.compensation}.`
        }
        return p
      })
      blocks.push({
        text: resolvedTranslated.join('\n'),
        font: 'Times-Roman',
        fontSize: 10.3,
        align: 'justify',
        gapAfter: 8,
      })
    }

    // English closing paragraph - used in renderSignaturePage, NOT inside columns
    // (removed from here, now rendered in renderSignaturePage as bilingual two-column outside borders)
    return blocks
  }

  private buildMitraBlocks(payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>): TextBlock[] {
    const firstParty = [
      '1. Koperasi Karyawan PT. Sankyu Indonesia International – Unit Kantor Pusat, suatu badan hukum yang berbentuk Koperasi yang didirikan berdasarkan hukum Negara Indonesia, berdasarkan Akta Pendirian Nomor AHU-2123.AH.01.04/Koperasi/2015 tertanggal 16 Oktober 2015, dibuat dihadapan Notaris dan disahkan oleh Kementerian Hukum dan Hak Asasi Manusia Republik Indonesia, berkedudukan di Jalan Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav. 20, Kota Delta Mas, Kecamatan Cikarang Pusat, Kabupaten Bekasi, Provinsi Jawa Barat, dalam hal ini diwakili oleh Bpk. Hari Suhono dalam kapasitasnya sebagai Ketua Koperasi, dan oleh karenanya berhak serta berwenang untuk bertindak dan mewakili Koperasi PT. Sankyu Indonesia International Unit Kantor Pusat (untuk selanjutnya disebut sebagai "PIHAK PERTAMA"); dan',
      `2. ${payload.employee.fullName}, Warga Negara Indonesia, lahir di ${payload.employee.birthPlace ?? '-'} pada ${this.formatDate(payload.employee.birthDate)}, pemegang Kartu Tanda Penduduk (KTP) Nomor ${payload.employee.nik ?? '-'}, beralamat di ${payload.employee.address ?? '-'}, dalam hal ini bertindak untuk dan atas nama pribadi (untuk selanjutnya disebut sebagai "PIHAK KEDUA").`,
      'PIHAK PERTAMA dan PIHAK KEDUA untuk selanjutnya secara bersama-sama disebut sebagai ("Para Pihak") dan secara sendiri-sendiri disebut sebagai ("Pihak").',
      '',
      'Dengan ini masing-masing bertindak dalam kedudukannya tersebut di atas terlebih dahulu menerangkan hal-hal sebagai berikut:',
      '1. Bahwa PIHAK PERTAMA adalah suatu koperasi yang salah satu ruang lingkup kegiatannya bergerak di bidang Penyediaan Tenaga Kerja.',
      '2. Bahwa PIHAK KEDUA merupakan pihak yang bersedia untuk bermitra dengan PIHAK PERTAMA dalam penyediaan jasa kepada perusahaan-perusahaan yang membutuhkan jasa dari PIHAK PERTAMA.',
      '3. Bahwa Para Pihak sepakat untuk mengikatkan diri dalam suatu Perjanjian dan dalam rangka melaksanakan maksud dan tujuan tersebut, Para Pihak sepakat untuk melakukan kerjasama kemitraan sebagaimana diatur menurut Perjanjian ini.',
      '',
      'Sehubungan dengan hal-hal tersebut diatas, Para Pihak sepakat untuk membuat dan menandatangani Perjanjian ini dengan syarat-syarat dan ketentuan sebagai berikut:',
      '',
      payload.definition.openingLine,
      ...payload.definition.recitals,
      `Mitra ditempatkan sebagai ${payload.meta.positionLabel} pada lokasi kerja ${payload.meta.locationLabel}.`,
      `Jangka waktu perjanjian dimulai sejak ${payload.meta.startDate} sampai dengan ${payload.meta.endDate}.`,
      `Imbalan jasa yang disepakati adalah sebesar ${payload.meta.compensation}.`,
    ]

    const blocks: TextBlock[] = firstParty.map(text => ({
      text,
      font: 'Times-Roman',
      fontSize: 11,
      align: 'justify' as TextAlign,
      gapAfter: 8,
    }))

    for (const section of payload.definition.sections) {
      blocks.push({
        text: section.heading.toUpperCase(),
        font: 'Times-Bold',
        fontSize: 12,
        align: 'center',
        gapBefore: 10,
        gapAfter: 8,
      })

      for (const paragraph of section.paragraphs) {
        blocks.push({
          text: paragraph,
          font: 'Times-Roman',
          fontSize: 11,
          align: 'justify',
          gapAfter: 8,
        })
      }
    }

    for (const paragraph of payload.definition.closingParagraphs) {
      blocks.push({
        text: paragraph,
        font: 'Times-Roman',
        fontSize: 11,
        align: 'justify',
        gapAfter: 8,
      })
    }

    return blocks
  }

  private createPdfBuffer(payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: true,
      })

      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Register Times New Roman fonts
      doc.registerFont('Times-Roman', 'C:/Windows/Fonts/times.ttf')
      doc.registerFont('Times-Bold', 'C:/Windows/Fonts/timesbd.ttf')
      doc.registerFont('Times-Italic', 'C:/Windows/Fonts/timesi.ttf')
      doc.registerFont('Times-BoldItalic', 'C:/Windows/Fonts/timesbi.ttf')

      if (payload.contract.template?.family === 'PKWT') {
        this.renderPkwtPdf(doc, payload)
      } else {
        this.renderMitraPdf(doc, payload)
      }

      doc.end()
    })
  }

  private buildLayoutContext(doc: any, headerBottomY: number, hasTitleBlock: boolean = false, hasHeader: boolean = true): LayoutContext {
    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    const leftX = 34
    const rightX = 310
    const columnWidth = 252
    // On first page (with title block), content starts lower.
    // On subsequent pages without header, start from a small top margin.
    let topY: number
    if (hasTitleBlock) {
      topY = headerBottomY + 108
    } else if (hasHeader) {
      topY = headerBottomY + 20
    } else {
      topY = 40
    }
    const bottomY = pageHeight - 72

    return {
      pageWidth,
      pageHeight,
      leftX,
      rightX,
      columnWidth,
      topY,
      bottomY,
      headerBottomY,
    }
  }

  private drawCorporateHeader(doc: any, variant: HeaderVariant) {
    const logoPath = variant === 'PKWT' ? this.pkwtLogoPath : this.mitraLogoPath
    if (existsSync(logoPath)) {
      doc.image(logoPath, 34, 22, { width: 84, height: 84 })
    }

    doc.font('Times-Bold').fontSize(16)
    doc.text('KOPERASI KARYAWAN', 0, 24, { width: doc.page.width, align: 'center' })
    doc.text('PT. SANKYU INDONESIA INTERNASIONAL', 0, 44, { width: doc.page.width, align: 'center' })
    doc.text('UNIT KANTOR PUSAT', 0, 64, { width: doc.page.width, align: 'center' })

    doc.font('Times-Roman').fontSize(10.8)
    doc.text('Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20', 134, 85, { width: 335, align: 'center' })
    doc.text('GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330', 134, 99, { width: 335, align: 'center' })
    doc.text('TELP. 021 - 50555340, FAX. 021- 50555341', 134, 113, { width: 335, align: 'center' })

    doc.lineWidth(2).moveTo(34, 132).lineTo(561, 132).stroke()
    doc.lineWidth(1).moveTo(34, 137).lineTo(561, 137).stroke()

    return 137
  }

  private drawTitleBlock(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>, headerBottomY: number) {
    const family = payload.contract.template?.family
    if (family === 'PKWT') {
      doc.font('Times-Bold').fontSize(14)
      doc.text(payload.definition.title.toUpperCase(), 0, headerBottomY + 34, { width: doc.page.width, align: 'center' })
      if (payload.definition.subtitle) {
        doc.text(payload.definition.subtitle.toUpperCase(), 0, headerBottomY + 52, { width: doc.page.width, align: 'center' })
      }
      doc.font('Times-Bold').fontSize(12)
      doc.text(`No. : ${payload.meta.contractNo}`, 0, headerBottomY + 76, { width: doc.page.width, align: 'center' })
    } else {
      doc.font('Times-Bold').fontSize(16)
      doc.text(payload.definition.title.toUpperCase(), 0, headerBottomY + 36, { width: doc.page.width, align: 'center' })
      doc.font('Times-Roman').fontSize(12)
      doc.text(`Nomor: ${payload.meta.contractNo}`, 0, headerBottomY + 58, { width: doc.page.width, align: 'center' })
      doc.text(`Tanggal ${payload.meta.signedDate}`, 0, headerBottomY + 76, { width: doc.page.width, align: 'center' })
    }
  }

  private renderBlockInColumn(
    doc: any,
    block: TextBlock,
    x: number,
    y: number,
    width: number,
  ) {
    const effectiveY = y + (block.gapBefore ?? 0)
    doc.font(block.font).fontSize(block.fontSize)

    // Special handling for party II tabular block
    const anyBlock = block as any
    if (anyBlock.partyII) {
      const data = anyBlock.partyII
      const labelX = x + 18 // indent after "II."
      const colonX = x + 100 // fixed colon position
      const valueX = x + 108 // value starts after ": "
      const lineHeight = 14

      let currentY = effectiveY

      // "II." prefix
      doc.text('II.', x, currentY)

      // Determine labels (Indonesian or English)
      const labels = data.labels ?? ['Nama', 'Tgl. Lahir', 'Jenis Kelamin', 'Alamat']
      const values = [data.name, data.birthInfo, data.gender, data.address]
      const suffix = data.suffix ?? 'Selanjutnya disebut KARYAWAN'

      // Render each row
      for (let i = 0; i < labels.length; i++) {
        doc.text(labels[i], labelX, currentY)
        doc.text(':', colonX, currentY)
        doc.text(values[i], valueX, currentY, { width: width - (valueX - x) })
        currentY += lineHeight
      }

      // Empty line + suffix
      currentY += 6
      doc.text(suffix, x + 18, currentY, { width })
      currentY += lineHeight

      return currentY + (block.gapAfter ?? 0)
    }

    const height = doc.heightOfString(block.text, {
      width,
      align: block.align ?? 'left',
      lineGap: 2,
    })

    doc.text(block.text, x, effectiveY, {
      width,
      align: block.align ?? 'left',
      lineGap: 2,
    })

    return effectiveY + height + (block.gapAfter ?? 0)
  }

  private renderParallelColumns(
    doc: any,
    payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>
  ) {
    const leftBlocks = this.buildPkwtIndonesianBlocks(payload)
    const rightBlocks = this.buildPkwtEnglishBlocks(payload)
    let leftIndex = 0
    let rightIndex = 0
    let firstPage = true

    while (leftIndex < leftBlocks.length || rightIndex < rightBlocks.length) {
      if (!firstPage) {
        doc.addPage()
      }
      
      let headerBottomY = 0
      // Corporate header only on first page
      if (firstPage) {
        headerBottomY = this.drawCorporateHeader(doc, 'PKWT')
        this.drawTitleBlock(doc, payload, headerBottomY)
      }
      
      const layout = this.buildLayoutContext(doc, headerBottomY, firstPage, firstPage)

      let leftY = layout.topY
      while (leftIndex < leftBlocks.length) {
        const block = leftBlocks[leftIndex]
        const testY = leftY + (block.gapBefore ?? 0)
        doc.font(block.font).fontSize(block.fontSize)
        // Special height estimation for partyII tabular block
        const anyBlock = block as any
        let height: number
        if (anyBlock.partyII) {
          height = 14 * 4 + 6 + 14 // 4 rows + gap + "Selanjutnya" line
        } else {
          height = doc.heightOfString(block.text, {
            width: layout.columnWidth,
            align: block.align ?? 'left',
            lineGap: 2,
          })
        }
        if (testY + height > layout.bottomY) break
        leftY = this.renderBlockInColumn(doc, block, layout.leftX, leftY, layout.columnWidth)
        leftIndex += 1
      }

      let rightY = layout.topY
      while (rightIndex < rightBlocks.length) {
        const block = rightBlocks[rightIndex]
        const testY = rightY + (block.gapBefore ?? 0)
        doc.font(block.font).fontSize(block.fontSize)
        const anyRBlock = block as any
        let height: number
        if (anyRBlock.partyII) {
          height = 14 * 4 + 6 + 14
        } else {
          height = doc.heightOfString(block.text, {
            width: layout.columnWidth,
            align: block.align ?? 'left',
            lineGap: 2,
          })
        }
        if (testY + height > layout.bottomY) break
        rightY = this.renderBlockInColumn(doc, block, layout.rightX, rightY, layout.columnWidth)
        rightIndex += 1
      }
      
      // Draw borders ONLY to where content actually ends (not full page height)
      const maxContentY = Math.max(leftY, rightY) + 5
      doc.rect(layout.leftX - 10, layout.topY - 10, layout.columnWidth + 20, maxContentY - layout.topY + 15).lineWidth(1).stroke()
      doc.rect(layout.rightX - 10, layout.topY - 10, layout.columnWidth + 20, maxContentY - layout.topY + 15).lineWidth(1).stroke()
      
      // Set doc.y to just below the borders so signature renders outside
      doc.y = maxContentY + 10
      
      // On the LAST page (all blocks rendered), render closing + signature below the borders
      if (leftIndex >= leftBlocks.length && rightIndex >= rightBlocks.length) {
        this.renderClosingAndSignature(doc, payload, maxContentY + 15)
      }
      
      firstPage = false
    }
  }

  private renderSequentialColumns(
    doc: any,
    payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>,
    blocks: TextBlock[],
  ) {
    let blockIndex = 0
    let firstPage = true

    while (blockIndex < blocks.length) {
      if (!firstPage) {
        doc.addPage()
      }
      firstPage = false

      const headerBottomY = this.drawCorporateHeader(doc, 'MITRA')
      this.drawTitleBlock(doc, payload, headerBottomY)

      // Single column full width (no border boxes)
      const topY = headerBottomY + 108
      const bottomY = doc.page.height - 72
      const contentX = 68
      const contentWidth = 459

      let y = topY

      while (blockIndex < blocks.length) {
        const block = blocks[blockIndex]
        const testY = y + (block.gapBefore ?? 0)
        doc.font(block.font).fontSize(block.fontSize)
        const height = doc.heightOfString(block.text, {
          width: contentWidth,
          align: block.align ?? 'left',
          lineGap: 2,
        })

        if (testY + height > bottomY) break

        y = this.renderBlockInColumn(doc, block, contentX, y, contentWidth)
        blockIndex += 1
      }
    }
  }

  private renderClosingAndSignature(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>, startY: number) {
    const pageBottom = doc.page.height - 50
    let y = startY + 20
    
    // Check if there's enough space for closing + signature, if not add new page
    if (y + 250 > pageBottom) {
      doc.addPage()
      this.drawCorporateHeader(doc, 'PKWT')
      y = 180
    }
    
    // === BILINGUAL CLOSING PARAGRAPHS (two columns, no borders) ===
    const closingTextId = payload.definition.closingParagraphs.join('\n')
    const closingTextEn = 'Thus the Agreement of Certain Time made without any pressure from both parties, made by double duplicate and enough stamp.'
    const columnWidth = 252
    const leftX = 34
    const rightX = 310
    
    doc.font('Times-Roman').fontSize(10)
    doc.text(closingTextId, leftX, y, { width: columnWidth, align: 'justify', lineGap: 2 })
    doc.text(closingTextEn, rightX, y, { width: columnWidth, align: 'justify', lineGap: 2 })
    
    const closingHeight = Math.max(
      doc.heightOfString(closingTextId, { width: columnWidth, lineGap: 2 }),
      doc.heightOfString(closingTextEn, { width: columnWidth, lineGap: 2 })
    )
    y += closingHeight + 25
    
    // === STANDALONE FULL-WIDTH SIGNATURE BLOCK ===
    
    // Line 1: Date
    doc.font('Times-Roman').fontSize(10)
    doc.text(`Bekasi, ${payload.meta.signedDate}`, 68, y)
    y += 20
    
    // Line 2: Company main header (centered, full width)
    doc.font('Times-Bold').fontSize(10)
    doc.text('KOPERASI KARYAWAN PT SANKYU INDONESIA INTERNATIONAL', 68, y, { width: 459, align: 'center' })
    y += 14
    
    // Line 3: Company sub-header (centered, full width)
    doc.text('UNIT KANTOR PUSAT', 68, y, { width: 459, align: 'center' })
    y += 25
    
    // === Signature Table Box (2-column with border) ===
    const tableX = 68
    const tableWidth = 459
    const colWidth = tableWidth / 2
    const cellPadding = 10
    const labelHeight = 20
    const signatureSpace = 60  // blank space for physical signature
    const nameHeight = 20
    const tableHeight = labelHeight + signatureSpace + nameHeight + (cellPadding * 2)
    
    // Draw outer border
    doc.lineWidth(1)
    doc.rect(tableX, y, tableWidth, tableHeight).stroke()
    
    // Draw vertical divider line
    const dividerX = tableX + colWidth
    doc.moveTo(dividerX, y).lineTo(dividerX, y + tableHeight).stroke()
    
    // Top row cells - labels
    doc.font('Times-Bold').fontSize(10.5)
    doc.text('Karyawan/employee', tableX, y + cellPadding, { width: colWidth, align: 'center' })
    doc.text('Pengusaha/Perusahaan', dividerX, y + cellPadding, { width: colWidth, align: 'center' })
    
    // Bottom row cells - names (Uppercase, Bold, Underlined)
    const nameY = y + cellPadding + labelHeight + signatureSpace
    const empName = (payload.employee.fullName || '').toUpperCase()
    const mgrName = (payload.meta.processedByName || '(...........................)').toUpperCase()
    
    doc.font('Times-Bold').fontSize(11)
    
    // Underline + name for left cell (Karyawan)
    const empNameWidth = doc.widthOfString(empName)
    const empNameX = tableX + (colWidth - empNameWidth) / 2
    doc.text(empName, tableX, nameY, { width: colWidth, align: 'center' })
    doc.moveTo(empNameX, nameY + 14).lineTo(empNameX + empNameWidth, nameY + 14).lineWidth(1).stroke()
    doc.font('Times-Roman').fontSize(9)
    doc.text('KARYAWAN', tableX, nameY + 16, { width: colWidth, align: 'center' })
    
    // Underline + name for right cell (Ketua Koperasi)
    doc.font('Times-Bold').fontSize(11)
    const mgrNameWidth = doc.widthOfString(mgrName)
    const mgrNameX = dividerX + (colWidth - mgrNameWidth) / 2
    doc.text(mgrName, dividerX, nameY, { width: colWidth, align: 'center' })
    doc.moveTo(mgrNameX, nameY + 14).lineTo(mgrNameX + mgrNameWidth, nameY + 14).lineWidth(1).stroke()
    doc.font('Times-Roman').fontSize(9)
    doc.text('KETUA KOPERASI', dividerX, nameY + 16, { width: colWidth, align: 'center' })
  }

  private renderSignaturePage(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    const isPkwt = payload.contract.template?.family === 'PKWT'
    
    if (!isPkwt) {
      // MITRA: always new page
      doc.addPage()
      this.drawCorporateHeader(doc, 'MITRA')
      this.drawTitleBlock(doc, payload, 137)
      
      let y = 260
      
      // Closing paragraphs
      doc.font('Times-Roman').fontSize(10.5)
      for (const paragraph of payload.definition.closingParagraphs) {
        doc.text(paragraph, 68, y, { width: 459, align: 'justify', lineGap: 3 })
        y = doc.y + 14
      }
      
      // Date
      y += 16
      doc.font('Times-Roman').fontSize(10.5)
      doc.text(`Bekasi, ${payload.meta.signedDate}`, 68, y)
      y += 40
      
      // Signature labels
      doc.font('Times-Bold').fontSize(11)
      doc.text('PIHAK KEDUA', 68, y, { width: 200, align: 'center' })
      doc.text('PIHAK PERTAMA', 330, y, { width: 200, align: 'center' })
      
      // Names
      y += 55
      doc.font('Times-Bold').fontSize(11)
      doc.text(payload.employee.fullName, 68, y, { width: 200, align: 'center' })
      doc.text(payload.meta.processedByName || '(...........................)', 330, y, { width: 200, align: 'center' })
      
      // Company info
      y += 16
      doc.font('Times-Bold').fontSize(10)
      doc.text('KOPERASI PT. SANKYU INT\'L', 330, y, { width: 200, align: 'center' })
      doc.text('(Ketua Koperasi)', 330, y + 14, { width: 200, align: 'center' })
    }
    // PKWT signature is now handled inside renderParallelColumns via renderClosingAndSignature
  }

  private renderPkwtPdf(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    this.renderParallelColumns(doc, payload)
  }

  private renderMitraPdf(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    const blocks = this.buildMitraBlocks(payload)
    this.renderSequentialColumns(doc, payload, blocks)
    this.renderSignaturePage(doc, payload)
  }

  async generate(id: number) {
    const payload = await this.loadContract(id)

    if (payload.missingFields.length) {
      throw new BadRequestException({
        message: 'Data legal kontrak belum lengkap',
        missingFields: payload.missingFields,
      })
    }

    const uploadDir = join(process.cwd(), 'uploads', 'contracts', String(id))
    await this.ensureDir(uploadDir)

    const safeNo = payload.contract.contractNo.replace(/[^\w.-]+/g, '-')
    const pdfFileName = `${safeNo}.pdf`
    const pdfPath = join(uploadDir, pdfFileName)
    const pdfBuffer = await this.createPdfBuffer(payload)
    await fs.writeFile(pdfPath, pdfBuffer)

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        generatedPdfUrl: `/uploads/contracts/${id}/${pdfFileName}`,
        generatedAt: new Date(),
      },
      include: this.include,
    })

    return {
      message: 'Dokumen kontrak berhasil digenerate langsung ke PDF',
      generatedPdfUrl: updated.generatedPdfUrl,
      generatedAt: updated.generatedAt,
      pdfReady: true,
      renderEngine: this.renderEngine,
      layoutMode: this.layoutMode,
    }
  }
}
