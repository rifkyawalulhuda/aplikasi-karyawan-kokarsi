const fs = require('node:fs/promises')
const path = require('node:path')
const {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} = require('docx')

const backendRoot = path.resolve(__dirname, '..')
const outputRoot = path.join(backendRoot, 'assets', 'contract-templates', 'docx-ready')

const commonPlaceholders = {
  employeeFullName: '{{employee.fullName}}',
  employeeNo: '{{employee.employeeNo}}',
  employeeNik: '{{employee.nik}}',
  employeeBirthPlace: '{{employee.birthPlace}}',
  employeeBirthDate: '{{employee.birthDate}}',
  employeeAddress: '{{employee.address}}',
  contractNo: '{{contract.contractNo}}',
  contractTypeName: '{{contract.contractTypeName}}',
  contractSignedDate: '{{contract.signedDate}}',
  contractStartDate: '{{contract.startDate}}',
  contractEndDate: '{{contract.endDate}}',
  contractPositionLabel: '{{contract.positionLabel}}',
  contractLocationLabel: '{{contract.locationLabel}}',
  contractCompensation: '{{contract.compensation}}',
  legalTitle: '{{legal.title}}',
  legalSubtitle: '{{legal.subtitle}}',
  legalOpeningLine: '{{legal.openingLine}}',
  legalLocationLine: '{{legal.locationLine}}',
  legalTermLine: '{{legal.termLine}}',
  legalCompensationLabel: '{{legal.compensationLabel}}',
  legalFirstPartyLabel: '{{legal.firstPartyLabel}}',
  legalSecondPartyLabel: '{{legal.secondPartyLabel}}',
  legalTodayCityDate: '{{legal.todayCityDate}}',
}

const pkwtSections = (roleLabel) => ([
  {
    heading: 'Pasal 1 - Penempatan dan Jenis Pekerjaan',
    paragraphs: [
      `Perusahaan mempekerjakan PIHAK KEDUA untuk melaksanakan pekerjaan sebagai ${roleLabel} sesuai kebutuhan operasional koperasi, unit usaha, maupun penugasan klien.`,
      'PIHAK KEDUA bersedia ditempatkan pada area kerja yang ditentukan PIHAK PERTAMA sepanjang masih berkaitan dengan ruang lingkup jabatan dan kebutuhan operasional.',
    ],
  },
  {
    heading: 'Pasal 2 - Jangka Waktu Perjanjian',
    paragraphs: [
      'Perjanjian kerja waktu tertentu ini berlaku sejak tanggal mulai kontrak sampai dengan tanggal berakhir kontrak sebagaimana tercantum pada dokumen ini.',
      'Sesuai ketentuan PKWT, terhadap perjanjian ini tidak diberlakukan masa percobaan kerja.',
    ],
  },
  {
    heading: 'Pasal 3 - Upah, Tunjangan, dan Fasilitas',
    paragraphs: [
      'PIHAK KEDUA menerima upah sesuai nilai kompensasi yang disepakati dalam kontrak ini, termasuk komponen yang ditetapkan berdasarkan kebijakan perusahaan dan ketentuan yang berlaku.',
      'Pembayaran upah dilakukan secara periodik melalui mekanisme pembayaran yang ditetapkan PIHAK PERTAMA serta tunduk pada ketentuan perpajakan, kehadiran, dan administrasi penggajian.',
    ],
  },
  {
    heading: 'Pasal 4 - Waktu Kerja, Kehadiran, dan Disiplin',
    paragraphs: [
      'PIHAK KEDUA wajib mematuhi jadwal kerja, sistem shift, ketentuan lembur, dan tata tertib yang berlaku di lingkungan PIHAK PERTAMA maupun tempat penugasan.',
      'Keterlambatan, ketidakhadiran tanpa keterangan, pelanggaran disiplin, atau pelanggaran SOP dapat dikenakan tindakan pembinaan dan sanksi sesuai peraturan yang berlaku.',
    ],
  },
  {
    heading: 'Pasal 5 - Hak, Kewajiban, dan Kerahasiaan',
    paragraphs: [
      'PIHAK KEDUA wajib menjaga nama baik perusahaan, menjaga kerahasiaan data dan informasi pekerjaan, serta memelihara aset, peralatan, dan dokumen kerja yang dipercayakan kepadanya.',
      'PIHAK PERTAMA berhak melakukan evaluasi kinerja, pembinaan, mutasi penugasan, dan tindakan administratif lain sepanjang sesuai ketentuan internal dan peraturan perundang-undangan.',
    ],
  },
  {
    heading: 'Pasal 6 - Keselamatan Kerja dan Kepatuhan',
    paragraphs: [
      'PIHAK KEDUA wajib mematuhi seluruh ketentuan keselamatan dan kesehatan kerja, penggunaan alat pelindung diri, serta instruksi kerja yang berlaku pada unit penempatan.',
      'Apabila PIHAK KEDUA melanggar ketentuan keselamatan kerja atau menolak instruksi kerja yang sah, maka hal tersebut dapat menjadi dasar evaluasi dan tindakan lebih lanjut.',
    ],
  },
  {
    heading: 'Pasal 7 - Berakhirnya Perjanjian',
    paragraphs: [
      'PKWT ini berakhir demi hukum pada tanggal berakhirnya kontrak atau lebih awal sesuai ketentuan perundang-undangan, pengakhiran penugasan, atau sebab lain yang sah.',
      'Apabila hubungan kerja sama dengan klien berakhir dan tidak diperpanjang, PIHAK PERTAMA dapat menyesuaikan keberlanjutan hubungan kerja PIHAK KEDUA sesuai kebutuhan operasional dan aturan yang berlaku.',
    ],
  },
])

const mitraSections = (roleLabel) => ([
  {
    heading: 'Pasal 1 - Ruang Lingkup',
    paragraphs: [
      `PIHAK PERTAMA menunjuk PIHAK KEDUA untuk melaksanakan kerja sama kemitraan pada pekerjaan ${roleLabel} sesuai kebutuhan operasional koperasi dan unit layanan terkait.`,
      'PIHAK KEDUA wajib menjalankan pekerjaan secara profesional, menjaga etika kerja, dan mematuhi seluruh prosedur operasional yang diberlakukan selama masa kemitraan.',
    ],
  },
  {
    heading: 'Pasal 2 - Jangka Waktu',
    paragraphs: [
      'Perjanjian kemitraan berlaku untuk jangka waktu sesuai tanggal mulai dan tanggal berakhir yang tercantum dalam dokumen ini.',
      'Perpanjangan, perubahan, atau pembaruan kemitraan hanya sah apabila disetujui secara tertulis oleh Para Pihak.',
    ],
  },
  {
    heading: 'Pasal 3 - Hak dan Kewajiban PIHAK PERTAMA',
    paragraphs: [
      'PIHAK PERTAMA berkewajiban memberikan penugasan, arahan kerja, dan pembayaran imbalan jasa sesuai ketentuan perjanjian ini.',
      'PIHAK PERTAMA berhak melakukan evaluasi kinerja, pembinaan, penyesuaian penempatan, dan pengakhiran kerja sama apabila terdapat kondisi operasional atau pelanggaran kewajiban.',
    ],
  },
  {
    heading: 'Pasal 4 - Hak dan Kewajiban PIHAK KEDUA',
    paragraphs: [
      'PIHAK KEDUA berkewajiban melaksanakan pekerjaan dengan jujur, tertib, menjaga kerahasiaan, dan mematuhi kebijakan operasional koperasi maupun lokasi penugasan.',
      'PIHAK KEDUA bertanggung jawab atas perilaku kerja, hasil kerja, penggunaan fasilitas, serta kerugian yang timbul akibat kelalaian atau pelanggaran yang dilakukannya.',
    ],
  },
  {
    heading: 'Pasal 5 - Imbalan Jasa dan Administrasi Pembayaran',
    paragraphs: [
      'PIHAK KEDUA menerima imbalan jasa bulanan sesuai nilai kompensasi yang disepakati dalam perjanjian ini dan komponen administrasi lain yang berlaku.',
      'Pembayaran dilakukan melalui mekanisme administrasi yang ditetapkan PIHAK PERTAMA serta tunduk pada pemotongan, pajak, dan persyaratan administrasi yang berlaku.',
    ],
  },
  {
    heading: 'Pasal 6 - Evaluasi, Kepatuhan, dan Kerahasiaan',
    paragraphs: [
      'PIHAK PERTAMA dapat melakukan evaluasi berkala atas kinerja, kepatuhan, kehadiran, dan perilaku kerja PIHAK KEDUA selama masa kemitraan.',
      'PIHAK KEDUA wajib menjaga kerahasiaan seluruh data, informasi usaha, dokumen, dan prosedur kerja yang diperoleh selama pelaksanaan pekerjaan.',
    ],
  },
  {
    heading: 'Pasal 7 - Pengakhiran dan Wanprestasi',
    paragraphs: [
      'Apabila salah satu pihak tidak memenuhi kewajiban yang telah disepakati, maka pihak lainnya berhak melakukan peninjauan, pemberian peringatan, atau pengakhiran kerja sama sesuai kondisi yang terjadi.',
      'Perjanjian ini dapat berakhir karena jangka waktu selesai, evaluasi operasional, pengakhiran penugasan, atau sebab lain yang sah menurut kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
  },
])

const templates = [
  {
    outputName: 'pkwt-driver-2026.docx',
    title: commonPlaceholders.legalTitle,
    subtitle: commonPlaceholders.legalSubtitle,
    openingLine: commonPlaceholders.legalOpeningLine,
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    sections: pkwtSections('Driver'),
    closingParagraphs: [
      'Demikian kesepakatan kerja ini dibuat dalam keadaan sadar, tanpa adanya paksaan dari pihak mana pun, untuk dipatuhi dan dilaksanakan dengan penuh tanggung jawab oleh Para Pihak.',
      'Hal-hal yang belum diatur secara khusus dalam dokumen ini akan mengikuti ketentuan peraturan perusahaan, kebijakan operasional, dan peraturan perundang-undangan yang berlaku.',
    ],
  },
  {
    outputName: 'pkwt-kasir-2026.docx',
    title: commonPlaceholders.legalTitle,
    subtitle: commonPlaceholders.legalSubtitle,
    openingLine: commonPlaceholders.legalOpeningLine,
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    sections: pkwtSections('Kasir Kopmart'),
    closingParagraphs: [
      'Demikian kesepakatan kerja ini dibuat dalam keadaan sadar, tanpa adanya paksaan dari pihak mana pun, untuk dipatuhi dan dilaksanakan dengan penuh tanggung jawab oleh Para Pihak.',
      'Hal-hal yang belum diatur secara khusus dalam dokumen ini akan mengikuti ketentuan peraturan perusahaan, kebijakan operasional, dan peraturan perundang-undangan yang berlaku.',
    ],
  },
  {
    outputName: 'pkwt-staff-2026.docx',
    title: commonPlaceholders.legalTitle,
    subtitle: commonPlaceholders.legalSubtitle,
    openingLine: commonPlaceholders.legalOpeningLine,
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    sections: pkwtSections('Staff Admin'),
    closingParagraphs: [
      'Demikian kesepakatan kerja ini dibuat dalam keadaan sadar, tanpa adanya paksaan dari pihak mana pun, untuk dipatuhi dan dilaksanakan dengan penuh tanggung jawab oleh Para Pihak.',
      'Hal-hal yang belum diatur secara khusus dalam dokumen ini akan mengikuti ketentuan peraturan perusahaan, kebijakan operasional, dan peraturan perundang-undangan yang berlaku.',
    ],
  },
  {
    outputName: 'pkwt-warehouse-2026.docx',
    title: commonPlaceholders.legalTitle,
    subtitle: commonPlaceholders.legalSubtitle,
    openingLine: commonPlaceholders.legalOpeningLine,
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    sections: pkwtSections('Karyawan Gudang'),
    closingParagraphs: [
      'Demikian kesepakatan kerja ini dibuat dalam keadaan sadar, tanpa adanya paksaan dari pihak mana pun, untuk dipatuhi dan dilaksanakan dengan penuh tanggung jawab oleh Para Pihak.',
      'Hal-hal yang belum diatur secara khusus dalam dokumen ini akan mengikuti ketentuan peraturan perusahaan, kebijakan operasional, dan peraturan perundang-undangan yang berlaku.',
    ],
  },
  {
    outputName: 'mitra-driver-ops-2026.docx',
    title: 'PERJANJIAN KEMITRAAN',
    subtitle: '',
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    sections: mitraSections('Driver antar jemput karyawan, pengiriman barang, dan antar dokumen'),
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
  },
  {
    outputName: 'mitra-komart-2026.docx',
    title: 'PERJANJIAN KEMITRAAN',
    subtitle: '',
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    sections: mitraSections('Cashier Kopmart Koperasi'),
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
  },
  {
    outputName: 'mitra-staff-2026.docx',
    title: 'PERJANJIAN KEMITRAAN',
    subtitle: '',
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    sections: mitraSections('Staff Admin Koperasi'),
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
  },
  {
    outputName: 'mitra-warehouse-clc-2026.docx',
    title: 'PERJANJIAN KEMITRAAN',
    subtitle: '',
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    sections: mitraSections('Handling Warehouse'),
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
  },
]

function buildParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { after: options.spacingAfter ?? 180 },
    alignment: options.alignment ?? AlignmentType.JUSTIFIED,
    indent: options.indentFirstLine ? { firstLine: 420 } : undefined,
    children: [
      new TextRun({
        text,
        size: options.size ?? 22,
        bold: options.bold ?? false,
        italics: options.italics ?? false,
      }),
    ],
  })
}

function buildDetailRow(label, value) {
  return new Paragraph({
    spacing: { after: 120 },
    tabStops: [
      { type: TabStopType.LEFT, position: 3400 },
      { type: TabStopType.LEFT, position: 3850 },
    ],
    children: [
      new TextRun({ text: label, size: 22 }),
      new TextRun({ text: '\t:\t', size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
  })
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true })
}

async function renderTemplate(entry) {
  const children = []

  children.push(buildParagraph(entry.title, { alignment: AlignmentType.CENTER, bold: true, size: 28, spacingAfter: 60 }))
  if (entry.subtitle) {
    children.push(buildParagraph(entry.subtitle, { alignment: AlignmentType.CENTER, italics: true, size: 22, spacingAfter: 240 }))
  }
  children.push(buildParagraph(`No. ${commonPlaceholders.contractNo}`, { alignment: AlignmentType.CENTER, bold: true, size: 24, spacingAfter: 280 }))

  children.push(buildParagraph(entry.openingLine, { indentFirstLine: true, spacingAfter: 180 }))
  for (const recital of entry.recitals) {
    children.push(buildParagraph(recital, { indentFirstLine: true, spacingAfter: 160 }))
  }

  children.push(buildParagraph('Identitas PIHAK KEDUA adalah sebagai berikut:', { spacingAfter: 200, alignment: AlignmentType.LEFT }))
  children.push(buildDetailRow('Nama', commonPlaceholders.employeeFullName))
  children.push(buildDetailRow('No. Induk Karyawan', commonPlaceholders.employeeNo))
  children.push(buildDetailRow('NIK', commonPlaceholders.employeeNik))
  children.push(buildDetailRow('Tempat / Tanggal Lahir', `${commonPlaceholders.employeeBirthPlace}, ${commonPlaceholders.employeeBirthDate}`))
  children.push(buildDetailRow('Alamat', commonPlaceholders.employeeAddress))
  children.push(buildDetailRow('Jabatan / Posisi', commonPlaceholders.contractPositionLabel))
  children.push(buildDetailRow('Lokasi Kerja', commonPlaceholders.contractLocationLabel))
  children.push(buildDetailRow('Jenis Kontrak', commonPlaceholders.contractTypeName))
  children.push(buildDetailRow('Tanggal Penandatanganan', commonPlaceholders.contractSignedDate))
  children.push(buildDetailRow('Masa Kontrak', `${commonPlaceholders.contractStartDate} s.d. ${commonPlaceholders.contractEndDate}`))
  children.push(buildDetailRow(commonPlaceholders.legalCompensationLabel, commonPlaceholders.contractCompensation))

  children.push(new Paragraph({ spacing: { after: 220 } }))
  children.push(buildParagraph(commonPlaceholders.legalLocationLine, { indentFirstLine: true, spacingAfter: 180 }))
  children.push(buildParagraph(commonPlaceholders.legalTermLine, { indentFirstLine: true, spacingAfter: 260 }))

  for (const section of entry.sections) {
    children.push(buildParagraph(section.heading, { bold: true, alignment: AlignmentType.LEFT, spacingAfter: 160 }))
    for (const paragraph of section.paragraphs) {
      children.push(buildParagraph(paragraph, { indentFirstLine: true, spacingAfter: 160 }))
    }
  }

  children.push(new Paragraph({ spacing: { after: 220 } }))
  for (const paragraph of entry.closingParagraphs) {
    children.push(buildParagraph(paragraph, { indentFirstLine: true, spacingAfter: 180 }))
  }

  children.push(new Paragraph({ spacing: { after: 420 } }))
  children.push(buildParagraph(commonPlaceholders.legalTodayCityDate, { alignment: AlignmentType.LEFT, spacingAfter: 280 }))
  children.push(new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: 7000 }],
    spacing: { after: 900 },
    children: [
      new TextRun({ text: commonPlaceholders.legalFirstPartyLabel, bold: true, size: 22 }),
      new TextRun({ text: '\t' }),
      new TextRun({ text: commonPlaceholders.legalSecondPartyLabel, bold: true, size: 22 }),
    ],
  }))
  children.push(new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: 7000 }],
    children: [
      new TextRun({ text: 'Koperasi Karyawan PT. Sankyu', size: 22 }),
      new TextRun({ text: '\t' }),
      new TextRun({ text: commonPlaceholders.employeeFullName, size: 22 }),
    ],
  }))

  const document = new Document({
    sections: [{ properties: {}, children }],
  })

  const buffer = await Packer.toBuffer(document)
  await fs.writeFile(path.join(outputRoot, entry.outputName), buffer)
}

async function main() {
  await ensureDir(outputRoot)
  for (const entry of templates) {
    await renderTemplate(entry)
  }
  console.log(`Starter template .docx berhasil dibuat di: ${outputRoot}`)
}

main().catch((error) => {
  console.error('Gagal membuat starter template .docx')
  console.error(error)
  process.exit(1)
})
