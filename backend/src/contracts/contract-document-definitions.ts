import { ContractFamily } from '@prisma/client'

export interface ContractDocumentDefinition {
  key: string
  family: ContractFamily
  title: string
  subtitle?: string
  sourceTemplateRelativePath: string
  sourceTemplateFormat: 'PDF'
  fidelityNote: string
  openingLine: string
  recitals: string[]
  roleLabel: string
  locationLine: string
  termLine: string
  compensationLabel: string
  closingParagraphs: string[]
  firstPartyLabel: string
  secondPartyLabel: string
  sections: Array<{
    heading: string
    paragraphs: string[]
  }>
  requiredFields: string[]
}

const pkwtCommonSections = (roleLabel: string): ContractDocumentDefinition['sections'] => [
  {
    heading: 'Pasal 1\nMaksud Kesepakatan',
    paragraphs: [
      `1. Perusahaan mempekerjakan Karyawan untuk waktu tertentu sesuai dengan kebutuhan perusahaan.`,
      `2. Dengan pekerjaan di Koperasi PT Sankyu Indonesia Internasional untuk Pekerjaan Sebagai ${roleLabel}.`,
      '3. Perusahaan berhak memindahkan karyawan dari satu tugas ke tugas lain atau dari satu bagian ke bagian lain, dengan tidak mengurangi upah yang telah disepakati dalam kesepakatan kerja ini.',
    ],
  },
  {
    heading: 'Pasal 2\nMasa Berlakunya Kesepakatan Kerja',
    paragraphs: [
      '__TERM_DATE__',
      '2. Dalam Kesepakatan Kerja untuk Waktu Tertentu ini tidak disyaratkan adanya masa percobaan.',
    ],
  },
  {
    heading: 'Pasal 3\nPengupahan',
    paragraphs: [
      '__WAGE_AMOUNT__',
      '2. Perusahaan akan memotong upah karyawan untuk pajak penghasilan perorangan.',
      '3. Upah karyawan akan dibayarkan pada tanggal 7 setiap bulannya.',
    ],
  },
  {
    heading: 'Pasal 4\nWaktu Kerja',
    paragraphs: [
      'Dengan memperhatikan ketentuan perundangan yang berlaku, Waktu kerja di perusahaan adalah 40 (Empat Puluh) jam seminggu.',
    ],
  },
  {
    heading: 'Pasal 5\nPembebasan dari Kewajiban Bekerja',
    paragraphs: [
      '1. Karyawan dapat diberikan izin meninggalkan pekerjaan disebabkan sakit dan atau mendapat kecelakaan apabila ada keterangan syah dari dokter.',
      '2. Karyawan dapat diberikan izin meninggalkan pekerjaan di dalam keperluan-keperluan yang penting setelah mendapat persetujuan dari perusahaan.',
    ],
  },
  {
    heading: 'Pasal 6\nTata Tertib Kerja',
    paragraphs: [
      '1. Karyawan diwajibkan memperhatikan dan mengikuti peraturan-peraturan keselamatan kerja yang diperintahkan oleh perusahaan.',
      '2. Karyawan dilarang membawa peralatan kerja milik perusahaan keluar dari lingkungan tempat kerja tanpa izin dari pimpinan perusahaan untuk kepentingan pribadi.',
      '3. Karyawan diharuskan memakai perlengkapan kerja dalam menjalankan tugas dan harus berlaku sopan santun.',
      '4. Setiap kehilangan atau rusaknya perlengkapan kerja wajib dilaporkan karyawan kepada pimpinan perusahaan. Karyawan yang dengan sengaja atau kecerobohannya menimbulkan kerugian perusahaan wajib mengganti kerugian yang ditimbulkan.',
      '5. Karyawan diwajibkan merawat/memelihara peralatan milik perusahaan.',
    ],
  },
  {
    heading: 'Pasal 7\nDisiplin Kerja',
    paragraphs: [
      '1. Karyawan akan diberikan sanksi pemutusan hubungan kerja tanpa mendapat uang rugi dalam bentuk apapun, apabila karyawan melakukan pelanggaran-pelanggaran berat sebagaimana diuraikan di bawah ini :',
      'a. Pada saat kesepakatan kerja diadakan memberikan keterangan palsu atau dipalsukan.',
      'b. Mabuk, madat, memakai obat bius atau narkotik di tempat kerja.',
      'c. Melakukan asusila atau perjudian dalam bentuk apapun di tempat kerja.',
      'd. Melakukan perbuatan kejahatan misalnya : mencuri, menggelapkan, menipu, memperdagangkan barang-barang terlarang baik dalam lingkungan perusahaan maupun di luar lingkungan perusahaan.',
      'e. Penganiayaan, menghina secara kasar atau mengancam pengusaha, keluarga pengusaha atau teman sekerja.',
      'f. Membujuk pengusaha atau teman sekerja untuk melakukan sesuatu yang bertentangan dengan hukum atau kesusilaan.',
      'g. Dengan sengaja atau ceroboh merusak atau membiarkan diri atau teman sekerja dalam keadaan bahaya.',
      'h. Membongkar rahasia perusahaan atau mencemarkan nama baik pimpinan perusahaan dan keluarganya yang seharusnya dirahasiakan kecuali untuk kepentingan Negara.',
      'i. Merokok di tempat terlarang atau pada tempat yang peka terhadap bahaya kebakaran.',
      'j. Menjalani proses hukum yang mengakibatkan tidak bisa kerja lebih dari 6 bulan yang menggangu produktifitas perusahaan atau hasil kerja perusahaan.',
      'k. Meminjam atau menggunakan alat ataupun barang milik perusahaan atau vendor tanpa seizin atasan atau pimpinan perusahaan.',
    ],
  },
  {
    heading: 'Pasal 8\nMangkir',
    paragraphs: [
      '1. Apabila karyawan tidak masuk kerja tanpa izin atau surat keterangan/alasan yang dapat diterima oleh perusahaan, maka karyawan tersebut dianggap mangkir.',
      '2. Apabila karyawan mangkir dalam waktu 5 (Lima) hari kerja berturut-turut, dan telah dipanggil 2 kali secara tertulis, tetapi karyawan tidak dapat memberikan alasan atau bukti yang syah, maka karyawan tersebut dinyatakan mengundurkan diri sesuai dengan Undang-Undang No. 13 Tahun 2003 tentang Ketenagakerjaan.',
    ],
  },
  {
    heading: 'Pasal 9\nBerakhirnya Kesepakatan',
    paragraphs: [
      '1. Kesepakatan Kerja untuk Waktu Tertentu ini berakhir demi hukum dengan berakhirnya waktu kesepakatan sebagaimana tertuang dalam pasal 2 ayat 1 kesepakatan kerja ini, dengan demikian perusahaan tidak berkewajiban untuk memberikan uang pesangon dan jasa berupa apapun pada karyawan.',
      '2. Kesepakatan Kerja untuk Waktu Tertentu ini berakhir karena meninggalnya karyawan yang bersangkutan.',
      '3. Perusahaan dapat mengakhiri Kesepakatan Kerja Waktu Tertentu ini apabila karyawan melakukan kesalahan berat atau alasan memaksa sebagaimana dimaksud dalam pasal 7 dan 8.',
      '4. Kontrak antara koperasi dengan PT Sankyu Indonesia International berakhir dan kontrak tidak di perpanjang.',
    ],
  },
  {
    heading: 'Pasal 10\nTugas dan Tanggung Jawab',
    paragraphs: [
      '1. Karyawan harus melaksanakan tugas kerja dengan baik sebagaimana yang diperintahkan oleh atasan atau pimpinan perusahaan.',
      '2. Karyawan bersedia merahasiakan semua informasi yang diperoleh dari perusahaan selama bekerja dan tidak akan dipergunakan keluar atau menyebarluaskan informasi tersebut tanpa izin dari perusahaan.',
    ],
  },
  {
    heading: 'Pasal 11\nPenyelesaian Keluh Kesah',
    paragraphs: [
      '1. Apabila terjadi perselisihan mengenai masalah kesepakatan kerja ini dan syarat-syarat kerja akan diselesaikan secara musyawarah sebelum diselesaikan melalui ketentuan yang berlaku.',
      '2. Syarat-syarat kerja yang berlaku dan belum tercantum di dalam kesepakatan kerja ini akan diberlakukan sesuai dengan peraturan dan Undang-Undang yang berlaku.',
      '3. Pemerintah dalam hal ini, Departemen Tenaga Kerja dapat mengadakan perubahan-perubahan atau meninjau perusahaan jika syarat-syarat kerja dalam kesepakatan kerja ini tidak sesuai lagi dengan peraturan ketenagakerjaan yang berlaku.',
    ],
  },
]

const mitraCommonSections = (roleLabel: string): ContractDocumentDefinition['sections'] => [
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
]

const DOCX_REMOVED_NOTE = 'Dokumen kontrak dirender langsung ke PDF native dari kode dengan layout legal internal yang mengacu ke sample PDF referensi.'

export const CONTRACT_DOCUMENT_DEFINITIONS: Record<string, ContractDocumentDefinition> = {
  PKWT_DRIVER: {
    key: 'PKWT_DRIVER',
    family: 'PKWT',
    title: 'KESEPAKATAN KERJA WAKTU TERTENTU',
    subtitle: 'STATED PERIODS LABOUR AGREEMENT',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/PKWT DRIVER 2026.pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini, Para Pihak sepakat untuk mengikatkan diri dalam Kesepakatan Kerja Waktu Tertentu dengan syarat dan ketentuan sebagaimana diatur dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    roleLabel: 'Driver',
    locationLine: 'Dengan lokasi kerja di Koperasi PT Sankyu Indonesia Internasional untuk pekerjaan sebagai Driver.',
    termLine: 'Kesepakatan kerja ini berlaku sesuai periode kontrak kerja yang disepakati.',
    compensationLabel: 'Upah Karyawan',
    closingParagraphs: [
      'Demikian Kesepakatan Kerja untuk Waktu Tertentu ini dibuat tanpa adanya desakan dari salah satu pihak, dibuat dalam rangkap dua dan bermeterai cukup.',
    ],
    firstPartyLabel: 'Pengusaha/Perusahaan',
    secondPartyLabel: 'Karyawan/employee',
    sections: pkwtCommonSections('Driver'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
  PKWT_KASIR: {
    key: 'PKWT_KASIR',
    family: 'PKWT',
    title: 'KESEPAKATAN KERJA WAKTU TERTENTU',
    subtitle: 'STATED PERIODS LABOUR AGREEMENT',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/PKWT KASIR 2026 -.pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini, Para Pihak sepakat untuk mengikatkan diri dalam Kesepakatan Kerja Waktu Tertentu dengan syarat dan ketentuan sebagaimana diatur dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    roleLabel: 'Kasir',
    locationLine: 'Dengan lokasi kerja di Koperasi PT Sankyu Indonesia Internasional untuk pekerjaan sebagai Kasir Kopmart.',
    termLine: 'Kesepakatan kerja ini berlaku sesuai periode kontrak kerja yang disepakati.',
    compensationLabel: 'Upah Karyawan',
    closingParagraphs: [
      'Demikian Kesepakatan Kerja untuk Waktu Tertentu ini dibuat tanpa adanya desakan dari salah satu pihak, dibuat dalam rangkap dua dan bermeterai cukup.',
    ],
    firstPartyLabel: 'Pengusaha/Perusahaan',
    secondPartyLabel: 'Karyawan/employee',
    sections: pkwtCommonSections('Kasir Kopmart'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
  PKWT_STAFF: {
    key: 'PKWT_STAFF',
    family: 'PKWT',
    title: 'KESEPAKATAN KERJA WAKTU TERTENTU',
    subtitle: 'STATED PERIODS LABOUR AGREEMENT',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/PKWT STAFF 2026 .pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini, Para Pihak sepakat untuk mengikatkan diri dalam Kesepakatan Kerja Waktu Tertentu dengan syarat dan ketentuan sebagaimana diatur dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    roleLabel: 'Staff Admin',
    locationLine: 'Dengan lokasi kerja di Koperasi PT Sankyu Indonesia Internasional untuk pekerjaan sebagai Staff Admin.',
    termLine: 'Kesepakatan kerja ini berlaku sesuai periode kontrak kerja yang disepakati.',
    compensationLabel: 'Upah Karyawan',
    closingParagraphs: [
      'Demikian Kesepakatan Kerja untuk Waktu Tertentu ini dibuat tanpa adanya desakan dari salah satu pihak, dibuat dalam rangkap dua dan bermeterai cukup.',
    ],
    firstPartyLabel: 'Pengusaha/Perusahaan',
    secondPartyLabel: 'Karyawan/employee',
    sections: pkwtCommonSections('Staff Admin'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
  PKWT_WAREHOUSE: {
    key: 'PKWT_WAREHOUSE',
    family: 'PKWT',
    title: 'KESEPAKATAN KERJA WAKTU TERTENTU',
    subtitle: 'STATED PERIODS LABOUR AGREEMENT',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/PKWT WAREHOUSE 2026.pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini, Para Pihak sepakat untuk mengikatkan diri dalam Kesepakatan Kerja Waktu Tertentu dengan syarat dan ketentuan sebagaimana diatur dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang menjalankan kegiatan usaha dan layanan operasional sesuai kebutuhan perusahaan dan unit kerja terkait.',
      'PIHAK KEDUA adalah tenaga kerja yang bersedia melaksanakan pekerjaan sesuai posisi yang ditetapkan dengan tunduk pada ketentuan kerja, tata tertib, dan kebijakan operasional yang berlaku.',
    ],
    roleLabel: 'Karyawan Gudang',
    locationLine: 'Dengan lokasi kerja di Koperasi PT Sankyu Indonesia Internasional untuk pekerjaan sebagai Karyawan Gudang.',
    termLine: 'Kesepakatan kerja ini berlaku sesuai periode kontrak kerja yang disepakati.',
    compensationLabel: 'Upah Karyawan',
    closingParagraphs: [
      'Demikian Kesepakatan Kerja untuk Waktu Tertentu ini dibuat tanpa adanya desakan dari salah satu pihak, dibuat dalam rangkap dua dan bermeterai cukup.',
    ],
    firstPartyLabel: 'Pengusaha/Perusahaan',
    secondPartyLabel: 'Karyawan/employee',
    sections: pkwtCommonSections('Karyawan Gudang'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
  MITRA_DRIVER: {
    key: 'MITRA_DRIVER',
    family: 'MITRA',
    title: 'PERJANJIAN KEMITRAAN',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA DRIVER OPS .pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    roleLabel: 'Driver antar jemput karyawan, pengiriman barang, dan antar dokumen',
    locationLine: 'Perjanjian kemitraan ini mengatur kerja sama mitra operasional driver untuk kebutuhan layanan koperasi dan klien.',
    termLine: 'Jangka waktu kemitraan mengikuti periode kontrak yang tercantum pada dokumen ini.',
    compensationLabel: 'Imbalan Jasa Bulanan',
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
    firstPartyLabel: 'PIHAK PERTAMA',
    secondPartyLabel: 'PIHAK KEDUA',
    sections: mitraCommonSections('Driver antar jemput karyawan, pengiriman barang, dan antar dokumen'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
  MITRA_KOMART: {
    key: 'MITRA_KOMART',
    family: 'MITRA',
    title: 'PERJANJIAN KEMITRAAN',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA KOMART.pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    roleLabel: 'Cashier Kopmart Koperasi',
    locationLine: 'Perjanjian kemitraan ini mengatur kerja sama mitra kasir untuk operasional Kopmart Koperasi.',
    termLine: 'Jangka waktu kemitraan mengikuti periode kontrak yang tercantum pada dokumen ini.',
    compensationLabel: 'Imbalan Jasa Bulanan',
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
    firstPartyLabel: 'PIHAK PERTAMA',
    secondPartyLabel: 'PIHAK KEDUA',
    sections: mitraCommonSections('Cashier Kopmart Koperasi'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
  MITRA_STAFF: {
    key: 'MITRA_STAFF',
    family: 'MITRA',
    title: 'PERJANJIAN KEMITRAAN',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA STAFF.pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    roleLabel: 'Staff Admin Koperasi',
    locationLine: 'Perjanjian kemitraan ini mengatur kerja sama mitra administrasi untuk kebutuhan operasional koperasi.',
    termLine: 'Jangka waktu kemitraan mengikuti periode kontrak yang tercantum pada dokumen ini.',
    compensationLabel: 'Imbalan Jasa Bulanan',
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
    firstPartyLabel: 'PIHAK PERTAMA',
    secondPartyLabel: 'PIHAK KEDUA',
    sections: mitraCommonSections('Staff Admin Koperasi'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
  MITRA_WAREHOUSE: {
    key: 'MITRA_WAREHOUSE',
    family: 'MITRA',
    title: 'PERJANJIAN KEMITRAAN',
    sourceTemplateRelativePath: 'docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA WAREHOUSE.pdf',
    sourceTemplateFormat: 'PDF',
    fidelityNote: DOCX_REMOVED_NOTE,
    openingLine: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri dalam Perjanjian Kemitraan yang memuat hak, kewajiban, dan ruang lingkup kerja sama sebagaimana dituangkan dalam dokumen ini.',
    recitals: [
      'PIHAK PERTAMA adalah Koperasi Karyawan PT. Sankyu Indonesia Internasional yang membutuhkan dukungan kemitraan operasional sesuai unit layanan yang berjalan.',
      'PIHAK KEDUA adalah mitra perorangan yang menyatakan bersedia menjalankan pekerjaan secara mandiri, tertib administrasi, dan sesuai ketentuan operasional yang berlaku.',
    ],
    roleLabel: 'Handling Warehouse',
    locationLine: 'Perjanjian kemitraan ini mengatur kerja sama mitra untuk pekerjaan handling warehouse dan dukungan logistik.',
    termLine: 'Jangka waktu kemitraan mengikuti periode kontrak yang tercantum pada dokumen ini.',
    compensationLabel: 'Imbalan Jasa Bulanan',
    closingParagraphs: [
      'Demikian perjanjian kemitraan ini dibuat dan disetujui oleh Para Pihak dalam keadaan sadar, tanpa tekanan dari pihak mana pun, untuk dilaksanakan dengan itikad baik.',
      'Apabila di kemudian hari terdapat hal-hal yang belum diatur dalam dokumen ini, maka Para Pihak sepakat untuk menyelesaikannya secara musyawarah dengan tetap memperhatikan kebijakan internal dan ketentuan hukum yang berlaku.',
    ],
    firstPartyLabel: 'PIHAK PERTAMA',
    secondPartyLabel: 'PIHAK KEDUA',
    sections: mitraCommonSections('Handling Warehouse'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
}

export function getContractDocumentDefinition(templateKey: string) {
  return CONTRACT_DOCUMENT_DEFINITIONS[templateKey]
}
