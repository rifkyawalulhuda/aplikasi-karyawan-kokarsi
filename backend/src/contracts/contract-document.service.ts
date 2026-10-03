import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { promises as fs, existsSync } from 'fs'
import { join, resolve } from 'path'
import * as path from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { getContractDocumentDefinition, mergeDefinition } from './contract-document-definitions'
import { definitionToContentDefinition } from '../contract-templates/default-template-definition'
import { SettingsService } from '../settings/settings.service'
import { buildValueMap, renderBlocks, interpolate } from './contract-block-renderer'
import { MITRA_HEADER_CHROME } from './mitra-layout.engine'
import { renderMitraDocumentInto } from './mitra-document.renderer'

type RenderEngine = 'PDF_NATIVE'
type LayoutMode = 'LEGAL_PDF_TEMPLATE'
type HeaderVariant = 'PKWT' | 'MITRA'

type TextAlign = 'left' | 'center' | 'justify'

interface SignaturePillar {
  header: string
  org?: string
  name: string
  role: string
}

interface TextBlock {
  text: string
  font: string
  fontSize: number
  align?: TextAlign
  gapBefore?: number
  gapAfter?: number
  sigPillar?: SignaturePillar
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
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  private readonly renderEngine: RenderEngine = 'PDF_NATIVE'
  private readonly layoutMode: LayoutMode = 'LEGAL_PDF_TEMPLATE'
  private readonly assetRoot = resolve(process.cwd(), 'assets')
  private readonly pkwtLogoPath = join(this.assetRoot, 'contract-logo-pkwt.jpg')
  private readonly mitraLogoPath = join(this.assetRoot, 'contract-logo-mitra.jpg')
  private readonly fontDir = process.env.FONT_DIR
    ?? (process.platform === 'win32'
      ? 'C:/Windows/Fonts'
      : '/usr/share/fonts/truetype/msttcorefonts')

  private include = {
    employee: {
      include: {
        jobRole: true,
        workLocation: true,
        department: true,
      },
    },
    contractType: true,
    templateVersion: true,
    template: {
      select: {
        id: true,
        name: true,
        code: true,
        family: true,
        templateKey: true,
      },
    },
  }

  private readonly pkwtEnglishSectionMap: Record<string, string[]> = {
    'Pasal 1\nMaksud Kesepakatan': [
      '1. Company employ the Employee for stated periods according to company need.',
      '2. With work in Koperasi PT Sankyu Indonesia Internasional for work as __ROLE_LABEL__.',
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

    const snapshot = contract.templateSnapshot as any
    const rawDefinition = getContractDocumentDefinition(contract.template.templateKey)
    // Kontrak ber-snapshot dirender EKSKLUSIF dari snapshot imutabel-nya; definisi
    // hard-code + `contentOverrides` lama tidak lagi dibaca (DoD #10).
    // Jalur `contentOverrides` hanya tersisa untuk kontrak legacy tanpa snapshot.
    if (!snapshot?.contentDefinition && !rawDefinition) {
      throw new BadRequestException(`Template key ${contract.template.templateKey} belum terdaftar di generator dokumen`)
    }
    const definition: any = rawDefinition
      ? mergeDefinition(rawDefinition, null)
      : {
          title: '', subtitle: '', openingLine: '', recitals: [], locationLine: '', termLine: '',
          compensationLabel: '', closingParagraphs: [], firstPartyLabel: '', secondPartyLabel: '',
          sections: [], roleLabel: '',
        }

    const employee = contract.employee
    // Kontrak ber-snapshot menyimpan nilai yang sudah di-resolve saat kontrak
    // dibuat, jadi regenerasi PDF tidak boleh bergantung pada data karyawan yang
    // bisa berubah (/ kosong) belakangan. Validasi kelengkapan karena itu HANYA
    // berlaku untuk kontrak legacy tanpa snapshot — lihat gate di bawah.
    const missingFields: string[] = []

    if (!snapshot?.contentDefinition) {
      if (!employee.nik) missingFields.push('NIK karyawan')
      if (!employee.birthPlace) missingFields.push('Tempat lahir karyawan')
      if (!employee.address) missingFields.push('Alamat karyawan')
      if (!contract.baseCompensation) missingFields.push('Nominal kompensasi/upah kontrak')
    }

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
      locationLabel: employee.workLocation?.name ?? '-',
      positionLabel: employee.jobRole?.name ?? definition.roleLabel,
      cooperativeChairmanName: '',
    }

    const generalSettings = await this.settingsService.getGeneralSettings()
    meta.cooperativeChairmanName = generalSettings.cooperativeChairmanName

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
      MITRA_DRIVER_TRUCK_B3: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA DRIVER TRUCK B3.pdf',
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
        if (p.includes('__ROLE_LABEL__')) {
          return p.replace('__ROLE_LABEL__', payload.definition.roleLabel)
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

    // Closing paragraph (Indonesia) — dirender di dalam kolom, setelah pasal terakhir
    blocks.push({
      text: payload.definition.closingParagraphs.join('\n'),
      font: 'Times-Roman',
      fontSize: 10,
      align: 'justify',
      gapBefore: 12,
      gapAfter: 8,
    })

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

      const translatedParagraphs = (payload.definition.englishSections?.[section.heading])
        ?? this.pkwtEnglishSectionMap[section.heading]
        ?? section.paragraphs
      // Replace placeholders with actual data (English)
      const resolvedTranslated = translatedParagraphs.map(p => {
        if (p === '__TERM_DATE__') {
          return `1. This agreement is effective since ${payload.meta.startDateEn} up to ${payload.meta.endDateEn}.`
        }
        if (p === '__WAGE_AMOUNT__') {
          return `1. The employee shall accept wage amount : ${payload.meta.compensation}.`
        }
        if (p.includes('__ROLE_LABEL__')) {
          return p.replace('__ROLE_LABEL__', payload.definition.roleLabel)
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

    // Closing paragraph (English) — dirender di dalam kolom, setelah article terakhir
    blocks.push({
      text: 'Thus the Agreement of Certain Time made without any pressure from both parties, made by double duplicate and enough stamp.',
      font: 'Times-Roman',
      fontSize: 10,
      align: 'justify',
      gapBefore: 12,
      gapAfter: 8,
    })

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
      doc.registerFont('Times-Roman', path.join(this.fontDir, 'times.ttf'))
      doc.registerFont('Times-Bold', path.join(this.fontDir, 'timesbd.ttf'))
      doc.registerFont('Times-Italic', path.join(this.fontDir, 'timesi.ttf'))
      doc.registerFont('Times-BoldItalic', path.join(this.fontDir, 'timesbi.ttf'))

      // Jalur baru: kontrak yang dibuat dengan versi template publish →
      // render dari snapshot (immutable), bukan definisi hard-code.
      const snapshot = (payload.contract as any).templateSnapshot
      const resolved = (payload.contract as any).resolvedTemplateData
      if (snapshot?.contentDefinition && resolved) {
        this.renderSnapshotPdf(doc, payload)
      } else if (payload.contract.template?.family === 'PKWT') {
        this.renderPkwtPdf(doc, payload)
      } else {
        this.renderMitraPdf(doc, payload)
      }

      doc.end()
    })
  }

  /**
   * Render kontrak dari templateSnapshot (versi template yang dipakai saat
   * kontrak dibuat). Bahasa: PKWT → id + en (dua kolom); MITRA → id saja.
   * Signature memakai layout renderer (dua pilar) dengan role dari blok signature.
   */
  private renderSnapshotPdf(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    const snapshot = (payload.contract as any).templateSnapshot
    const content = snapshot.contentDefinition ?? {}
    const values = buildValueMap((payload.contract as any).resolvedTemplateData)

    const family = snapshot.family === 'PKWT' || payload.contract.template?.family === 'PKWT' ? 'PKWT' : 'MITRA'

    if (family === 'MITRA') {
      // Perjanjian Kemitraan memakai mesin layout master (dua kolom ber-border,
      // 12pt TNR, header+judul hanya halaman 1). Lihat mitra-layout.engine.ts.
      this.renderMitraLayoutFromBlocks(doc, payload, content?.languages?.id ?? [])
      return
    }

    this.drawCorporateHeader(doc, 'PKWT')
    const headerBottomY = this.drawSnapshotTitleBlock(doc, payload, values)

    const opts = {
      leftX: 34,
      rightX: 310,
      columnWidth: 252,
      topY: headerBottomY + 108,
      bottomY: doc.page.height - 50,
      fontRegular: 'Times-Roman',
      fontBold: 'Times-Bold',
      fontItalic: 'Times-Italic',
    }

    const blocksId: any[] = content?.languages?.id ?? []
    const blocksEn: any[] = content?.languages?.en ?? []

    if (blocksEn.length > 0) {
      // Dua kolom: kiri ID, kanan EN — dirender paralel dari atas
      const leftY = headerBottomY + 108
      renderBlocks(doc, blocksId, { values }, { ...opts, topY: leftY })
      this.renderBlocksInSingleColumn(doc, blocksEn, values, opts.rightX, leftY, opts.columnWidth)
    } else {
      renderBlocks(doc, blocksId, { values }, opts)
    }

    this.renderSnapshotSignature(doc, payload, blocksId)
  }

  /**
   * Render "Perjanjian Kemitraan" memakai mesin layout master.
   *
   * Delegasi ke `renderMitraDocumentInto` (pintu tunggal yang juga dipakai
   * pratinjau editor), supaya hasil generate dan pratinjau tidak mungkin
   * menyimpang. Jalur ini hanya menyiapkan nilai dari snapshot kontrak.
   */
  private renderMitraLayoutFromBlocks(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>, blocks: any[]) {
    const values = buildValueMap((payload.contract as any).resolvedTemplateData)
    const meta = payload.meta

    // Nomor & Tanggal mengikuti master (baris terpisah di bawah judul).
    const numberLabel = meta?.contractNo ? `${MITRA_HEADER_CHROME.numberPrefix} ${meta.contractNo}` : undefined
    const dateLabel = meta?.signedDate ? `${MITRA_HEADER_CHROME.datePrefix} ${meta.signedDate}` : undefined

    renderMitraDocumentInto(doc, {
      blocks,
      values,
      fallbackTitle: payload.contract.template?.name,
      numberLabel,
      dateLabel,
      logoPath: existsSync(this.mitraLogoPath) ? this.mitraLogoPath : undefined,
      fonts: {
        regular: path.join(this.fontDir, 'times.ttf'),
        bold: path.join(this.fontDir, 'timesbd.ttf'),
        italic: path.join(this.fontDir, 'timesi.ttf'),
      },
      // Nama karyawan/jabatan diambil dari record karyawan bila placeholder
      // resolved-nya kosong (kontrak lama dengan snapshot parsial).
      signature: {
        employeeName: values['employee.fullName'] || payload.employee?.fullName || '',
        jobRole: values['employee.jobRole'] || payload.employee?.jobRole?.name || '',
      },
    })
  }

  /** Render blok hanya pada satu kolom mulai dari Y tertentu (untuk kolom EN). */
  private renderBlocksInSingleColumn(doc: any, blocks: any[], values: Record<string, string>, x: number, startY: number, width: number) {
    renderBlocks(doc, blocks, { values }, {
      leftX: x,
      rightX: x,
      columnWidth: width,
      topY: startY,
      bottomY: doc.page.height - 50,
      fontRegular: 'Times-Roman',
      fontBold: 'Times-Bold',
      fontItalic: 'Times-Italic',
      pageBottomPadding: 50,
    })
  }

  /** Judul dari blok title pada snapshot; fallback ke nama template. */
  private drawSnapshotTitleBlock(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>, values: Record<string, string>): number {
    // Cari blok title pertama dari snapshot
    const snapshot = (payload.contract as any).templateSnapshot
    const blocks: any[] = snapshot?.contentDefinition?.languages?.id ?? []
    const title = blocks.find(b => b?.type === 'title')?.text
    const subtitle = blocks.find(b => b?.type === 'subtitle')?.text
    const headerBottomY = this.drawSnapshotHeader(
      doc,
      title ? interpolate(title, values) : (payload.contract.template?.name ?? ''),
      subtitle ? interpolate(subtitle, values) : undefined,
    )
    return headerBottomY
  }

  private drawSnapshotHeader(doc: any, title: string, subtitle?: string): number {
    const pageWidth = doc.page.width
    doc.font('Times-Bold').fontSize(14).text(title, 0, 60, { width: pageWidth, align: 'center' })
    if (subtitle) {
      doc.font('Times-Roman').fontSize(10).text(subtitle, 0, doc.y + 4, { width: pageWidth, align: 'center' })
    }
    return doc.y
  }

  /** Tanda tangan dari blok signature snapshot (dua pilar). */
  private renderSnapshotSignature(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>, blocks: any[]) {
    const sig = blocks.find(b => b?.type === 'signature')
    if (!sig) return
    const values = buildValueMap((payload.contract as any).resolvedTemplateData)
    // Teks statis dapat dikonfigurasi per-template (sama seperti MITRA):
    // label pilar (`leftRole`/`rightRole`), nama pihak (`leftHeader`/`rightHeader`),
    // jabatan (`leftParty`/`rightParty`). Kosong → fallback bawaan.
    const text = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined
    const leftLabel = text(sig.leftRole) ?? 'PIHAK PERTAMA'
    const rightLabel = text(sig.rightRole) ?? 'PIHAK KEDUA'
    const leftHeader = text(sig.leftHeader) ?? "KOPERASI PT. SANKYU INT'L"
    const rightHeader = text(sig.rightHeader) ?? 'MITRA'
    const leftRole = text(sig.leftParty) ?? '(Ketua Koperasi)'
    const rightRole = text(sig.rightParty) ?? '(Mitra)'
    const chairman = values['settings.cooperativeChairmanName'] ?? ''
    const employeeName = values['employee.fullName'] ?? payload.employee.fullName

    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    const y = pageHeight - 150

    doc.font('Times-Roman').fontSize(10)
    // Label pilar
    doc.text(leftLabel, 34, y - 14, { width: 240, align: 'center' })
    doc.text(rightLabel, pageWidth - 274, y - 14, { width: 240, align: 'center' })
    // Nama perusahaan/pihak
    doc.text(leftHeader, 34, y, { width: 240, align: 'center' })
    doc.text(rightHeader, pageWidth - 274, y, { width: 240, align: 'center' })
    doc.text('', 34, y + 40)
    // Nama orang (dari data kontrak)
    doc.font('Times-Bold').text(chairman || '(...........................)', 34, y + 48, { width: 240, align: 'center' })
    doc.font('Times-Roman').text(leftRole, 34, y + 62, { width: 240, align: 'center' })
    doc.font('Times-Bold').text(employeeName || '(...........................)', pageWidth - 274, y + 48, { width: 240, align: 'center' })
    doc.font('Times-Roman').text(rightRole, pageWidth - 274, y + 62, { width: 240, align: 'center' })
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
      doc.text(`Tanggal: ${payload.meta.signedDate}`, 0, headerBottomY + 76, { width: doc.page.width, align: 'center' })
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
      const valueWidth = width - (valueX - x)
      const lineHeight = 14
      const suffixX = x + 18
      const suffixWidth = width - 18

      let currentY = effectiveY

      // "II." prefix
      doc.text('II.', x, currentY)

      // Determine labels (Indonesian or English)
      const labels = data.labels ?? ['Nama', 'Tgl. Lahir', 'Jenis Kelamin', 'Alamat']
      const values = [data.name, data.birthInfo, data.gender, data.address]
      const suffix = data.suffix ?? 'Selanjutnya disebut KARYAWAN'

      // Render each row; advance by the actual wrapped height so long values
      // (e.g. a long address) never overlap the following content.
      for (let i = 0; i < labels.length; i++) {
        doc.text(labels[i], labelX, currentY)
        doc.text(':', colonX, currentY)
        doc.text(values[i], valueX, currentY, { width: valueWidth })
        const rowHeight = Math.max(lineHeight, doc.heightOfString(values[i], { width: valueWidth }))
        currentY += rowHeight
      }

      // Empty line + suffix
      currentY += 6
      doc.text(suffix, suffixX, currentY, { width: suffixWidth })
      currentY += Math.max(lineHeight, doc.heightOfString(suffix, { width: suffixWidth }))

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

  private computeBlockHeight(doc: any, block: TextBlock, columnWidth: number): number {
    const gapBefore = block.gapBefore ?? 0
    const gapAfter = block.gapAfter ?? 0
    const anyBlock = block as any
    if (anyBlock.partyII) {
      const data = anyBlock.partyII
      doc.font(block.font).fontSize(block.fontSize)
      const valueWidth = columnWidth - 108
      const lineHeight = 14
      const labels = data.labels ?? ['Nama', 'Tgl. Lahir', 'Jenis Kelamin', 'Alamat']
      const values = [data.name, data.birthInfo, data.gender, data.address]
      const suffix = data.suffix ?? 'Selanjutnya disebut KARYAWAN'

      const rowsHeight = labels.reduce((sum, _, i) => {
        const rowH = doc.heightOfString(values[i], { width: valueWidth })
        return sum + Math.max(lineHeight, rowH)
      }, 0)
      const suffixH = Math.max(lineHeight, doc.heightOfString(suffix, { width: columnWidth - 18 }))
      return gapBefore + rowsHeight + 6 + suffixH + gapAfter
    }
    doc.font(block.font).fontSize(block.fontSize)
    return gapBefore + doc.heightOfString(block.text, { width: columnWidth, align: block.align ?? 'left', lineGap: 2 }) + gapAfter
  }

  private renderParallelColumns(
    doc: any,
    payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>
  ) {
    const leftBlocks = this.buildPkwtIndonesianBlocks(payload)
    const rightBlocks = this.buildPkwtEnglishBlocks(payload)
    // Pasangkan blok Indonesia (kiri) dengan blok Inggris (kanan) secara berurutan
    const pairs = leftBlocks.map((left, i) => ({ left, right: rightBlocks[i] ?? left }))
    let pairIndex = 0
    let firstPage = true

    while (pairIndex < pairs.length) {
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
      let rightY = layout.topY

      // Render tiap pasangan (ID | EN) pada posisi Y yang SAMA agar sejajar
      while (pairIndex < pairs.length) {
        const { left, right } = pairs[pairIndex]
        const leftH = this.computeBlockHeight(doc, left, layout.columnWidth)
        const rightH = this.computeBlockHeight(doc, right, layout.columnWidth)
        const maxH = Math.max(leftH, rightH)

        if (Math.max(leftY, rightY) + maxH > layout.bottomY) break

        leftY = this.renderBlockInColumn(doc, left, layout.leftX, leftY, layout.columnWidth)
        rightY = this.renderBlockInColumn(doc, right, layout.rightX, rightY, layout.columnWidth)

        // Sinkronkan posisi kedua kolom agar pasal berikutnya sejajar
        const syncedY = Math.max(leftY, rightY)
        leftY = syncedY
        rightY = syncedY
        pairIndex += 1
      }

      // Draw borders ONLY to where content actually ends (not full page height)
      const maxContentY = Math.max(leftY, rightY) + 5
      doc.rect(layout.leftX - 10, layout.topY - 10, layout.columnWidth + 20, maxContentY - layout.topY + 15).lineWidth(1).stroke()
      doc.rect(layout.rightX - 10, layout.topY - 10, layout.columnWidth + 20, maxContentY - layout.topY + 15).lineWidth(1).stroke()

      // Set doc.y to just below the borders so signature renders outside
      doc.y = maxContentY + 10

      // On the LAST page (all blocks rendered), render closing + signature below the borders
      if (pairIndex >= pairs.length) {
        this.renderClosingAndSignature(doc, payload, maxContentY + 15)
      }

      firstPage = false
    }
  }

  private renderClosingAndSignature(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>, startY: number) {
    const pageBottom = doc.page.height - 50
    let y = startY + 20
    
    // Check if there's enough space for signature, if not add new page
    if (y + 150 > pageBottom) {
      doc.addPage()
      y = 40
    }
    
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
    const mgrName = (payload.meta.cooperativeChairmanName || '(...........................)').toUpperCase()
    
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

  private renderPkwtPdf(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    this.renderParallelColumns(doc, payload)
  }
  /**
   * Render "Perjanjian Kemitraan".
   *
   * Kontrak ber-snapshot → dirender dari `templateSnapshot.contentDefinition`.
   * Kontrak legacy tanpa snapshot → contentDefinition dibangun dari definisi
   * TEMPLATE (bukan teks hard-code), memakai jalur produksi yang sama.
   *
   * Seluruh teks kontrak berasal dari Template Kontrak; layanan ini tidak
   * menambahkan/mengubah redaksi apa pun. Hanya header/footer (chrome) yang
   * statis, dikelola di `mitra-layout.engine.ts`.
   */
  private renderMitraPdf(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    // Kontrak legacy tanpa snapshot: bangun contentDefinition dari TEMPLATE
    // (bukan dari teks hard-code) memakai jalur produksi yang sama dengan
    // snapshot, sehingga tidak ada duplikasi teks kontrak di layanan ini.
    const definition = payload.definition
    if (!definition) {
      throw new BadRequestException('Definisi template Perjanjian Kemitraan tidak ditemukan')
    }
    const content = definitionToContentDefinition(definition)
    const blocks = content.languages.id
    const values = buildValueMap((payload.contract as any).resolvedTemplateData)

    // overlay nilai yang belum ada di resolvedTemplateData (kontrak legacy)
    const meta = payload.meta
    const emp = payload.employee
    const fallback: Record<string, string> = {
      'contract.contractNo': meta?.contractNo ?? '',
      'contract.startDate': meta?.startDate ?? '',
      'contract.endDate': meta?.endDate ?? '',
      'contract.signedDate': meta?.signedDate ?? '',
      'contract.baseCompensation': meta?.compensation ?? '',
      'settings.cooperativeChairmanName': meta?.cooperativeChairmanName ?? '',
      'employee.fullName': emp?.fullName ?? '',
      'employee.nik': emp?.nik ?? '',
      'employee.birthPlace': emp?.birthPlace ?? '',
      'employee.address': emp?.address ?? '',
      'employee.phoneNumber': emp?.phoneNumber ?? '',
      'employee.email': emp?.email ?? '',
      'employee.jobRole': emp?.jobRole?.name ?? '',
    }
    for (const [k, v] of Object.entries(fallback)) {
      if (!values[k] && v) values[k] = v
    }

    const titleBlock = blocks.find((b: any) => b?.type === 'title')
    const title = (titleBlock?.text
      ? interpolate(String(titleBlock.text), values)
      : definition.title ?? 'PERJANJIAN KEMITRAAN').toUpperCase()

    renderMitraDocumentInto(doc, {
      blocks,
      values,
      title,
      numberLabel: meta?.contractNo ? `${MITRA_HEADER_CHROME.numberPrefix} ${meta.contractNo}` : undefined,
      dateLabel: meta?.signedDate ? `${MITRA_HEADER_CHROME.datePrefix} ${meta.signedDate}` : undefined,
      logoPath: existsSync(this.mitraLogoPath) ? this.mitraLogoPath : undefined,
      fonts: {
        regular: path.join(this.fontDir, 'times.ttf'),
        bold: path.join(this.fontDir, 'timesbd.ttf'),
        italic: path.join(this.fontDir, 'timesi.ttf'),
      },
    })
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
