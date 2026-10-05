import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { promises as fs, existsSync } from 'fs'
import { join, resolve } from 'path'
import * as path from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { getContractDocumentDefinition, mergeDefinition } from './contract-document-definitions'
import { definitionToContentDefinition } from '../contract-templates/default-template-definition'
import { SettingsService } from '../settings/settings.service'
import { buildValueMap, interpolate } from './contract-block-renderer'
import { MITRA_HEADER_CHROME } from './mitra-layout.engine'
import { renderMitraDocumentInto } from './mitra-document.renderer'
import { PKWT_HEADER_CHROME } from './pkwt-layout.engine'
import { resolvePkwtFonts, renderPkwtDocumentInto } from './pkwt-document.renderer'

type RenderEngine = 'PDF_NATIVE'
type LayoutMode = 'LEGAL_PDF_TEMPLATE'

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

    this.renderPkwtLayoutFromBlocks(doc, payload, content?.languages?.id ?? [])
  }

  /**
   * Render "Kesepakatan Kerja Waktu Tertentu" memakai mesin layout master.
   *
   * Delegasi ke `renderPkwtDocumentInto` (pintu tunggal yang juga dipakai
   * pratinjau editor), supaya hasil generate dan pratinjau tidak mungkin
   * menyimpang — persis pola `renderMitraLayoutFromBlocks`.
   *
   * Kenapa BUKAN `renderBlocks` inline seperti sebelumnya:
   *  1. **Font.** `renderBlocks` dipanggil dengan `'Times-Roman'`/`'Times-Bold'`
   *     (builtin PDFKit), padahal master memakai Lucida Sans Typewriter untuk
   *     badan, judul, dan tanda tangan. TTF Lucida memang sudah di-bundle
   *     (`PKWT_FONT_NAMES`), jadi ini murni salah wiring.
   *  2. **Row-locking.** Jalur lama merender kolom ID dan EN sebagai DUA aliran
   *     independen (masing-masing `renderBlocks`), sehingga baris ID/EN tidak
   *     pernah terkunci pada y yang sama — sifat paling menonjol dari master.
   *     `buildPkwtRows` mengunci per baris.
   *  3. **Justify.** `renderBlocks` membungkus paragraf sendiri lalu menggambar
   *     rata kiri; engine PKWT mengukur dan menggambar PER-BARIS, sehingga ia
   *     dapat menjustifikasi semua baris paragraf KECUALI baris terakhirnya —
   *     persis seperti master (69% baris master berakhir pada tepi kanan yang
   *     sama persis). (Catatan: klaim lama bahwa `align: 'justify'` pdfkit
   *     "menjatuhkan glyph spasi" sudah terbukti KELIRU — lihat
   *     `drawJustifiedLine` di `table-layout.helpers.ts`.)
   */
  private renderPkwtLayoutFromBlocks(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>, blocks: any[]) {
    const resolved = (payload.contract as any).resolvedTemplateData
    const values = buildValueMap(resolved, 'ID')
    // Kolom kanan memakai varian Inggris HANYA untuk field ber-label per-bahasa
    // (mis. `employee.gender` → "Male"). Dihitung dari snapshot yang sama, bukan
    // query ulang, supaya peta turunan ini ikut membeku bersama kontrak.
    const valuesEn = buildValueMap(resolved, 'EN')
    const snapshot = (payload.contract as any).templateSnapshot
    const content = snapshot?.contentDefinition ?? {}
    const definition = payload.definition
    const meta = payload.meta
    const employee = payload.employee

    const numberLabel = meta?.contractNo ? `${PKWT_HEADER_CHROME.numberPrefix} ${meta.contractNo}` : undefined

    renderPkwtDocumentInto(doc, {
      blocks,
      blocksEn: content?.languages?.en ?? [],
      values,
      valuesEn,
      // Kop dari CHROME, bukan dari redaksi template (aturan passthrough).
      orgLines: [...PKWT_HEADER_CHROME.org],
      addressLines: [...PKWT_HEADER_CHROME.address],
      contactLine: PKWT_HEADER_CHROME.contactLine,
      numberLabel,
      logoPath: existsSync(this.pkwtLogoPath) ? this.pkwtLogoPath : undefined,
      fallbackTitle: definition?.title || payload.contract.template?.name,
      fallbackTitleEn: definition?.subtitle,
      fonts: resolvePkwtFonts(),
      // Nama karyawan/ketua diambil dari record bila placeholder resolved
      // kosong (kontrak lama dengan snapshot parsial).
      signature: {
        leftTitle: PKWT_HEADER_CHROME.signature.leftTitle,
        rightTitle: PKWT_HEADER_CHROME.signature.rightTitle,
        leftName: values['employee.fullName'] || employee?.fullName || '',
        leftRole: meta?.positionLabel || employee?.jobRole?.name || '',
        rightName: values['settings.cooperativeChairmanName'] || meta?.cooperativeChairmanName || '',
        rightRole: PKWT_HEADER_CHROME.signature.rightRoleLabel,
      },
    })
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

  /**
   * Render "Kesepakatan Kerja Waktu Tertentu" untuk kontrak LEGACY tanpa snapshot.
   *
   * Sama seperti `renderMitraPdf`: konten dibangun dari DEFINISI template
   * (`definitionToContentDefinition`), bukan dari teks hard-code di layanan ini.
   * Sesudah itu jalurnya menyatu dengan kontrak ber-snapshot lewat
   * `renderPkwtLayoutFromBlocks` — satu mesin, satu pintu.
   *
   * Sebelumnya jalur ini memakai `renderParallelColumns` (renderer blok generik,
   * font Times builtin, tanpa penguncian baris) sehingga kontrak legacy dan
   * kontrak ber-snapshot menghasilkan PDF yang berbeda. Itu kini tidak mungkin.
   */
  private renderPkwtPdf(doc: any, payload: Awaited<ReturnType<ContractDocumentService['loadContract']>>) {
    const definition = payload.definition
    if (!definition) {
      throw new BadRequestException('Definisi template Kesepakatan Kerja Waktu Tertentu tidak ditemukan')
    }
    const content = definitionToContentDefinition(definition)
    this.renderPkwtLayoutFromBlocks(doc, payload, content.languages.id ?? [])
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
