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

// Daftar tugas (Pasal 1 ayat 2) spesifik per jenis mitra, mengikuti sample PDF asli
const MITRA_SCOPE_WORK: Record<string, string> = {
  MITRA_DRIVER: 'Driver antar jemput karyawan, pengantaran/pengiriman barang, dan antar dokumen',
  MITRA_KOMART: 'Cashier Kopmart Koperasi PT. Sankyu Indonesia International',
  MITRA_STAFF: 'Staff Administrasi Koperasi PT. Sankyu Indonesia International',
  MITRA_WAREHOUSE: 'Handling Warehouse Koperasi PT. Sankyu Indonesia International',
}

const MITRA_DUTIES: Record<string, string[]> = {
  MITRA_DRIVER: [
    'a. Memiliki SIM kendaraan yang aktif.',
    'b. Melakukan pengisian absent harian dan mengisi absent bulanan.',
    'c. Memastikan kendaraan dalam kondisi baik dan terawat dan mengisi ceklist harian kendaraan.',
    'd. Melakukan pemeriksaan rutin terhadap kondisi kendaraan seperti cek oli, bensin, dan ban. Supaya dapat terkontrol kondisi kendaraan dan melakukan service rutin kendaraan.',
    'e. Mengemudikan kendaraan dengan aman dan bertanggung jawab.',
    'f. Mengantarkan penumpang atau barang, dokumen sesuai dengan rute yang ditentukan.',
    'g. Menjaga keselamatan penumpang atau barang yang diangkut.',
    'h. Melaporkan kejadian atau masalah yang terjadi selama perjalanan.',
    'i. Mengetahui dan mematuhi peraturan lalu lintas.',
  ],
  MITRA_KOMART: [
    'a. Pelayanan dan Pemrosesan Transaksi: melayani transaksi pembayaran pelanggan atau anggota koperasi baik secara tunai (cash) maupun non-tunai (kartu debit/kredit, QRIS, dll) menggunakan mesin kasir atau sistem Point of Sale (POS).',
    'b. Layanan Pelanggan: menyapa konsumen dengan ramah, memberikan informasi produk atau ketersediaan stok, dan membantu membungkus barang belanjaan.',
    'c. Promosi (Upselling): menawarkan produk tambahan atau promo/diskon yang sedang berlangsung di Kopmart kepada pelanggan.',
    'd. Administrasi dan Keuangan: rekonsiliasi kas untuk memastikan tidak ada selisih uang tunai dan transaksi non-tunai di mesin kasir pada setiap akhir giliran kerja (shift).',
    'e. Keamanan Finansial: memeriksa keaslian uang tunai yang diterima untuk mencegah peredaran uang palsu dan mengamankan dana Cashier.',
    'f. Pelaporan: membuat laporan penerimaan dan pengeluaran harian serta melakukan rekapitulasi data penjualan.',
    'g. Pemeliharaan Toko dan Operasional: membantu melakukan opname (penghitungan stok) barang di toko, khususnya di area kasir dan display.',
    'h. Kebersihan Area Toko: menjaga kebersihan dan kerapian area kerja agar pelanggan tetap merasa nyaman.',
    'i. Penanganan Masalah: menyelesaikan keluhan pelanggan dengan cepat, sopan, dan profesional.',
  ],
  MITRA_STAFF: [
    'a. Pengelolaan dan Pengarsipan Dokumen: menyimpan, menyortir, dan merapikan dokumen fisik maupun digital (e-filing) agar mudah diakses kembali saat dibutuhkan serta memastikan keamanan dan kerahasiaan data penting perusahaan.',
    'b. Pengolahan Data (Data Entry): memasukkan data baru ke dalam sistem, database, atau spreadsheet dengan tingkat akurasi tinggi serta membuat rekapitulasi data (seperti data penjualan, inventaris, atau absensi) secara berkala.',
    'c. Surat-Menyurat dan Pembuatan Laporan: menyiapkan dokumen korespondensi seperti surat resmi/legalitas, proposal, atau invoice serta menyusun laporan harian, mingguan, atau bulanan sesuai instruksi atasan.',
    'd. Komunikasi dan Penerimaan Tamu: menerima panggilan telepon masuk, membalas email, menyampaikan pesan kepada pihak yang dituju, serta menyambut tamu yang datang ke kantor dan memberikan informasi dasar yang dibutuhkan.',
    'e. Penjadwalan dan Logistik: mengatur jadwal pertemuan, rapat internal, atau janji temu dengan klien serta mengelola inventaris dan pengadaan alat tulis kantor (ATK) serta fasilitas operasional lainnya.',
  ],
  MITRA_WAREHOUSE: [
    'a. Operator forklift: mengoperasikan forklift untuk loading dan unloading serta menyimpan barang di area gudang penyimpanan berupa barang umum maupun Bahan Berbahaya dan Beracun (B3) sesuai instruksi dan SOP serta mematuhi ketentuan keselamatan kerja.',
    'b. Tally: melakukan penghitungan, pengecekan, dan memberikan label pada barang yang akan dimuat sebelum dilakukan pengiriman, serta memastikan proses pemuatan, penataan, pengamanan, dan pembongkaran muatan dilakukan sesuai standar operasional (SOP), termasuk memastikan barang B3 dikemas, diberi label, dan ditangani sesuai ketentuan keselamatan dan peraturan perundang-undangan yang berlaku.',
    'c. Melakukan pemeriksaan kelayakan forklift sebelum, selama, dan setelah pengoperasian, termasuk pengecekan kondisi forklift, ban, lampu, sistem kelistrikan, dan lainnya.',
    'd. Menjaga keamanan, keutuhan, dan keakuratan secara aktual barang yang akan dimuat atau dibongkar selama proses loading maupun unloading, serta mengoperasikan forklift dengan cara yang aman.',
    'e. Mengisi dan melaporkan dokumen serta menyerahkan dokumen setelah selesai loading maupun unloading.',
    'f. Customer Service: memberikan bantuan, solusi, informasi, dan pelayanan terhadap klien serta memastikan kepuasan klien sebelum, selama, dan setelah menjadi klien.',
    'g. Segera melaporkan kepada leader atau foreman dari klien PIHAK PERTAMA setiap kejadian darurat, kecelakaan, tumpahan (spill), kebocoran muatan B3, kerusakan barang, atau kondisi lain yang dapat mengancam keselamatan di area kerja.',
    'h. Menggunakan perlengkapan keselamatan diri (APD) yang diwajibkan di area kerja, serta melaksanakan instruksi tambahan yang relevan sepanjang tidak bertentangan dengan ketentuan perjanjian ini.',
  ],
}

// Struktur lengkap 15 Pasal Perjanjian Kemitraan (mengikuti sample PDF 1:1)
const mitraFullSections = (templateKey: string): ContractDocumentDefinition['sections'] => {
  const scopeWork = MITRA_SCOPE_WORK[templateKey] ?? 'penyediaan jasa sesuai kebutuhan PIHAK PERTAMA'
  const duties = MITRA_DUTIES[templateKey] ?? []
  return [
    {
      heading: 'PASAL 1\nRUANG LINGKUP',
      paragraphs: [
        `1. PIHAK PERTAMA dengan ini menunjuk PIHAK KEDUA dan PIHAK KEDUA dengan ini menyatakan kesediaannya menerima penunjukan PIHAK PERTAMA untuk bekerja sama sebagai Mitra guna melakukan pekerjaan ${scopeWork} untuk klien PIHAK PERTAMA yang telah menyetujui penunjukkan PIHAK KEDUA untuk pelaksanaan Jasa bagi kepentingannya ("Klien") dengan rincian sebagaimana ditentukan dalam Lampiran Perjanjian serta syarat dan ketentuan yang diatur dalam Perjanjian ini.`,
        '2. Pekerjaan atau jasa yang diberikan dan dikerjakan oleh PIHAK KEDUA untuk kepentingan PIHAK PERTAMA meliputi antara lain sebagai berikut:',
        ...duties,
        '3. Atas Pekerjaan yang dilakukan PIHAK KEDUA di atas, maka PIHAK KEDUA akan mendapatkan imbalan berupa Imbalan Jasa dari PIHAK PERTAMA, sebagaimana tersebut pada Pasal 4 Perjanjian ini.',
        '4. Penunjukan untuk hal sebagaimana dimaksud dalam ketentuan ayat (1) di atas bersifat eksklusif terhadap PIHAK PERTAMA, dengan pengertian bahwa PIHAK KEDUA tidak dapat mengadakan kerja sama atau menyediakan jasa yang sejenis sebagaimana diatur dalam Perjanjian ini dengan pihak selain PIHAK PERTAMA.',
        '5. Perjanjian ini tidak bersifat eksklusif terhadap PIHAK KEDUA, dengan pengertian bahwa PIHAK PERTAMA berhak mengadakan kerja sama yang sejenis atau menunjuk pihak lain untuk menyediakan jasa yang sejenis, selama tidak melanggar hak-hak PIHAK KEDUA sebagaimana diatur dalam Perjanjian ini.',
        '6. Selain memperhatikan ketentuan dalam Perjanjian ini, PIHAK KEDUA berkomitmen untuk mematuhi seluruh ketentuan yang ditetapkan oleh Klien selama pelaksanaan Pekerjaan, tanpa mengurangi hak-hak PIHAK KEDUA sebagaimana diatur dalam Perjanjian ini. PIHAK KEDUA memahami bahwa pelanggaran terhadap kebijakan yang ditetapkan oleh PIHAK PERTAMA dapat mengakibatkan pemutusan Perjanjian ini.',
      ],
    },
    {
      heading: 'PASAL 2\nJANGKA WAKTU PERJANJIAN',
      paragraphs: [
        '__MITRA_TERM__',
        '2. Jangka Waktu Perjanjian ini dapat diperpanjang berdasarkan persetujuan tertulis Para Pihak, kecuali salah satu Pihak bermaksud untuk mengakhiri Perjanjian ini dengan memberikan surat pemberitahuan kepada Pihak lainnya dalam waktu paling lambat 30 (tiga puluh) hari kerja sebelum berakhirnya Jangka Waktu Perjanjian.',
      ],
    },
    {
      heading: 'PASAL 3\nHAK DAN KEWAJIBAN PARA PIHAK',
      paragraphs: [
        '1. PIHAK PERTAMA memiliki hak dan kewajiban sebagai berikut:',
        'a. PIHAK PERTAMA berhak menunjuk PIHAK KEDUA untuk melaksanakan Pekerjaan, dengan tata cara lebih lanjut sebagaimana diinformasikan oleh PIHAK PERTAMA kepada PIHAK KEDUA secara langsung.',
        'b. PIHAK PERTAMA berhak melakukan evaluasi terhadap kinerja PIHAK KEDUA selambat-lambatnya 1 minggu sebelum perjanjian mitra ini berakhir.',
        'c. PIHAK PERTAMA berhak melakukan peneguran kepada PIHAK KEDUA dan memindahkannya jika pekerjaan di bagian pekerjaan tersebut tidak dapat atau belum bisa dilakukan dengan baik, dengan melakukan penyesuaian atas ketentuan-ketentuan dalam Perjanjian ini. Namun, apabila penempatan PIHAK KEDUA pada yang baru tersebut mengakibatkan pengurangan hak-hak PIHAK KEDUA sebagaimana diatur dalam Perjanjian ini,',
        'd. PIHAK PERTAMA berhak mengakhiri Perjanjian ini secara keseluruhan dan secara sepihak berdasarkan hasil evaluasi sesuai dengan ketentuan pada Pasal 5 dalam Perjanjian ini; dan',
        'e. PIHAK PERTAMA berkewajiban melakukan pembayaran kepada PIHAK KEDUA atas Pekerjaan yang telah dilakukan oleh PIHAK KEDUA sesuai dengan jumlah dan tata cara pembayaran yang diatur dalam Perjanjian ini.',
        'f. PIHAK PERTAMA berkewajiban membayarkan imbalan kepada PIHAK KEDUA, serta menambahkan sejumlah dana sebagai Simpanan Mitra selama jangka waktu kemitraan, sesuai dengan ketentuan yang diatur dalam perjanjian ini.',
        '2. PIHAK KEDUA memiliki hak dan kewajiban sebagai berikut:',
        'a. PIHAK KEDUA berhak menerima pembayaran dari PIHAK PERTAMA atas Pekerjaan yang telah dilakukan oleh PIHAK KEDUA sesuai dengan jumlah dan tata cara pembayaran yang diatur dalam Perjanjian ini;',
        'b. PIHAK KEDUA berkewajiban melaksanakan Pekerjaan sesuai dengan kebutuhan PIHAK PERTAMA dan ruang lingkup yang diatur dalam Perjanjian ini;',
        'c. PIHAK KEDUA berkewajiban memenuhi dan melaksanakan seluruh tugas dan ketentuan yang telah diuraikan dalam Pasal ini dan keseluruhan Perjanjian ini, Pedoman Peraturan dan Tata Tertib yang diberlakukan oleh PIHAK PERTAMA maupun ketentuan lain yang menjadi keputusan dan/atau kebijakan dari PIHAK PERTAMA.',
        'd. PIHAK KEDUA berkewajiban merahasiakan semua informasi mengenai PIHAK PERTAMA dan Pekerjaan yang diterima atau diketahui PIHAK KEDUA dan tidak memberikan dokumen atau informasi yang diketahui baik secara lisan maupun tertulis, gambaran, rekaman, laporan, video, dan segala macam bentuk yang mengandung informasi tentang PIHAK PERTAMA dan Pekerjaan ke pihak lainnya ataupun yang bukan haknya.',
        'e. Dalam hal PIHAK KEDUA tidak lagi bekerja di PIHAK PERTAMA maka PIHAK KEDUA wajib menyerahkan dan mengembalikan semua informasi mengenai Klien dan Pekerjaan yang diterima atau diketahui olehnya, baik karena jabatannya, atau karena sebab lain termasuk semua informasi maupun data dalam bentuk hard copy, email, disket, CD, USB, maupun dalam bentuk media lainnya kepada PIHAK PERTAMA;',
        'f. PIHAK KEDUA berkewajiban memenuhi dan menjalankan kode etik, aturan yang diberlakukan di PIHAK PERTAMA;',
        'g. PIHAK KEDUA berkewajiban untuk melakukan Pekerjaan dengan jujur, cermat, tertib dan bersemangat untuk kepentingan PIHAK PERTAMA sesuai Pekerjaannya;',
        'h. PIHAK KEDUA berkewajiban memakai seragam yang diberikan PIHAK PERTAMA, serta bertingkah laku sopan dan menghormati seluruh pekerja dan pihak-pihak lainnya di PIHAK PERTAMA (anggota koperasi);',
        'i. PIHAK KEDUA berkewajiban memahami, mengikuti dan menerapkan prosedur dalam melakukan Pekerjaan di PIHAK PERTAMA.',
        'j. PIHAK KEDUA berkewajiban memberikan laporan atas Pekerjaan yang dilaksanakan, baik secara lisan maupun tertulis dan bentuk laporan lainnya kepada PIHAK PERTAMA.',
      ],
    },
    {
      heading: 'PASAL 4\nIMBALAN JASA',
      paragraphs: [
        '1. Para Pihak sepakat bahwa imbalan jasa atas Pekerjaan yang dilaksanakan oleh PIHAK KEDUA berdasarkan Perjanjian ini adalah sebesar:',
        '__MITRA_IMBALAN__',
        'b. Uang Ketupat sebesar satu kali Upah Minimum Kota/Kabupaten (UMK) yang berlaku pada area administratif terkait, dibayarkan satu kali dalam satu tahun pada periode Hari Raya Idul Fitri.',
        'c. Imbalan Tahunan sebesar 0,5 (nol koma lima) kali UMK yang berlaku pada area administratif terkait, yang dibayarkan satu kali dalam satu tahun.',
        'd. Simpanan Mitra sebesar satu kali UMK yang berlaku pada area administratif terkait, yang akan ditambahkan dan disimpan selama masa kemitraan dan akan didistribusikan pada saat adanya pemutusan hubungan kemitraan.',
        'e. BPJS Kesehatan (segmen Pekerja Bukan Penerima Upah/Kelas 3) untuk mitra beserta anggota keluarga dalam 1 kartu keluarga maksimal 5 (lima) orang yang ditanggung oleh PIHAK PERTAMA selama masa kemitraan.',
        'f. BPJS Ketenagakerjaan (BPU) Program Jaminan Kecelakaan Kerja (JKK) dan Jaminan Kematian (JKM) dengan dasar tarif penghasilan sebesar Rp 5.000.000,- (lima juta rupiah).',
        'g. BPJS Jaminan Hari Tua (JHT) BPU dengan dasar tarif penghasilan sebesar Rp 5.000.000,- (lima juta rupiah) yang dibayarkan sesuai ketentuan yang berlaku.',
        '2. PIHAK PERTAMA wajib melakukan pembayaran imbalan yang telah terakumulasi sebagaimana dimaksud pada ayat (1) di atas kepada PIHAK KEDUA pada tanggal 7 (tujuh) setiap bulannya, kecuali untuk imbalan-imbalan tertentu yang dibayarkan hanya pada saat-saat tertentu sesuai dengan ketentuan pada ayat (1) di atas.',
        '3. Pembayaran akan dilakukan oleh PIHAK PERTAMA kepada PIHAK KEDUA melalui transfer elektronik ke rekening Bank milik PIHAK KEDUA.',
        '4. Para Pihak sepakat untuk mematuhi seluruh ketentuan perpajakan yang berlaku dan terkait dengan pembayaran Imbalan Jasa. Semua pajak yang berhubungan dengan Perjanjian ini akan ditanggung dan/atau dibayar oleh Para Pihak sesuai dengan ketentuan Perundang-undangan Perpajakan yang berlaku di Negara Republik Indonesia.',
      ],
    },
    {
      heading: 'PASAL 5\nEVALUASI',
      paragraphs: [
        '1. Para Pihak sepakat untuk melakukan evaluasi bersama terhadap ketentuan-ketentuan yang telah ditetapkan dalam Perjanjian ini maupun pelaksanaan Perjanjian ini dalam suatu proses evaluasi kerjasama.',
        '2. Proses evaluasi kerjasama sebagaimana dimaksud ayat (1) Pasal ini dilakukan selambat-lambatnya 1 (satu) tahun sekali.',
        '3. Hal-hal yang akan dibahas dalam proses evaluasi kerja sama sebagaimana dimaksud ayat (1) Pasal ini antara lain meliputi:',
        'a. pembahasan perkembangan dan kendala pelaksanaan Pekerjaan atau Perjanjian;',
        'b. hal-hal lain di luar butir (a) ayat ini, yang dipandang perlu untuk dievaluasi oleh Para Pihak.',
        '4. Apabila berdasarkan hasil evaluasi terhadap pelaksanaan Perjanjian ini kinerja PIHAK KEDUA dianggap tidak memuaskan atau tidak mencapai standar yang ditetapkan oleh PIHAK PERTAMA, maka PIHAK PERTAMA dapat mengakhiri Perjanjian ini secara sepihak dengan memberikan pemberitahuan tertulis kepada PIHAK KEDUA selambat-lambatnya 30 (tiga puluh) hari sebelum tanggal pengakhiran Perjanjian.',
        '5. PIHAK KEDUA dilarang memutuskan Perjanjian ini secara sepihak di tengah pelaksanaan Pekerjaan dari PIHAK PERTAMA. Pemutusan sepihak oleh PIHAK KEDUA tersebut dapat menimbulkan kewajiban pembayaran denda oleh PIHAK KEDUA sebesar denda yang dikenakan oleh PIHAK PERTAMA akibat pemutusan sepihak tersebut.',
      ],
    },
    {
      heading: 'PASAL 6\nKERAHASIAAN',
      paragraphs: [
        '1. PIHAK KEDUA setuju bahwa PIHAK KEDUA wajib untuk menjaga kerahasiaan semua data tetapi tidak terbatas pada informasi, keterangan, dokumen-dokumen, baik secara langsung maupun tidak langsung, yang berkaitan dengan pelaksanaan Pekerjaan dan pelaksanaan Perjanjian ini.',
        '2. PIHAK KEDUA tidak akan menggandakan atau menyebarluaskan informasi rahasia kepada pihak manapun juga, melakukan wawancara publik atau membuat pengumuman publik atau pernyataan terkait syarat-syarat dan ketentuan-ketentuan dari Perjanjian ini atau fakta-fakta, situasi, peristiwa atau kejadian sekitar yang terkait dengan cara apapun juga kecuali:',
        'a. dengan persetujuan tertulis terlebih dahulu;',
        'b. informasi telah secara umum tersedia bagi publik; dan',
        'c. perintah instansi atau pihak yang berwenang berdasarkan hukum, peraturan perundang-undangan atau putusan pengadilan yang berlaku.',
        '3. Selain ketentuan kewajiban menjaga kerahasiaan sebagaimana ditetapkan dalam Perjanjian ini, PIHAK KEDUA juga wajib mematuhi ketentuan kerahasiaan sebagaimana ditetapkan oleh PIHAK PERTAMA sehubungan dengan informasi yang diperoleh PIHAK KEDUA selama pelaksanaan Pekerjaan di PIHAK PERTAMA.',
        '4. Kelalaian dalam menjaga kerahasiaan sebagaimana diatur dalam Perjanjian ini yang menyebabkan kerugian kepada PIHAK PERTAMA dalam Perjanjian ini, maka PIHAK PERTAMA berhak menuntut ganti rugi kepada PIHAK KEDUA.',
        '5. Ketentuan Pasal ini tidak akan berakhir dan akan tetap mengikat Para Pihak setelah Perjanjian ini diputuskan atau berakhir.',
      ],
    },
    {
      heading: 'PASAL 7\nKEADAAN MEMAKSA',
      paragraphs: [
        '1. Tidak ada Pihak yang bertanggung jawab kepada pihak lainnya atas segala keterlambatan atau kegagalan dalam melaksanakan baik sebagian maupun keseluruhan Perjanjian ini, yang diakibatkan oleh sebab-sebab di luar kuasa mereka, yang tidak dapat dihindari meskipun dengan perencanaan yang baik dan tidak dapat diatasi dengan upaya yang wajar, yaitu termasuk namun tidak terbatas pada bencana alam, gempa bumi, kondisi cuaca yang luar biasa buruk, kecelakaan, unjuk rasa, huru-hara, wabah penyakit, perang (yang dideklarasikan maupun yang tidak), gangguan sipil, pemogokan, pemberontakan, kebakaran, banjir, badai, kekeringan, tindakan pemerintah atau otoritas militer, sabotase, dan lain-lain yang sejenis yang secara langsung mengganggu terlaksananya kewajiban menurut Perjanjian ini dan dibuktikan tidak ada unsur kesengajaan dan/atau kelalaian yang dilakukan Pihak ("Keadaan Memaksa").',
        '2. Sebab-sebab Keadaan Memaksa tersebut tidak akan dianggap sebagai wanprestasi terhadap Perjanjian ini, namun pemberitahuan secara tertulis oleh Pihak yang terkena Keadaan Memaksa kepada Pihak lainnya harus dilakukan dengan segera selambat-lambatnya dalam waktu 3 (tiga) hari kerja terjadinya Keadaan Memaksa, berisi antara lain alasan dan perkiraan lamanya penangguhan Pekerjaan dan/atau kewajiban lainnya berdasarkan Perjanjian ini.',
        '3. Setelah Para Pihak menerima pemberitahuan tertulis sebagaimana diatur dalam ayat (2) Pasal ini di atas, Para Pihak akan segera merundingkan perubahan-perubahan yang diperlukan agar Perjanjian dapat tetap dilaksanakan dan kepentingan Para Pihak dapat sebesar-besarnya terlindungi. Perjanjian Para Pihak terhadap perubahan akan dituangkan secara tertulis.',
        '4. Semua kerugian dan biaya yang diderita oleh salah satu Pihak sebagai akibat terjadinya Keadaan Memaksa bukan merupakan beban atau tanggung jawab Pihak lainnya.',
      ],
    },
    {
      heading: 'PASAL 8\nWANPRESTASI',
      paragraphs: [
        '1. Peristiwa Wanprestasi. Para Pihak dapat mengakhiri Perjanjian ini jika salah satu dari peristiwa berikut terjadi:',
        'a. Salah satu pihak baik secara sengaja maupun tidak sengaja, tidak dapat memenuhi atau gagal untuk melakukan kewajiban yang merupakan hak bagi pihak lainnya sebagaimana diatur di dalam Perjanjian termasuk namun tidak terbatas pada tidak melaksanakan pekerjaan, tidak melaksanakan pembayaran, dan/atau melaksanakan pekerjaan atau pembayaran tetapi tidak tepat waktu, dan/atau melakukan pekerjaan atau pembayaran tetapi tidak sesuai dengan ketentuan yang telah disepakati.',
        'b. Salah satu pihak melakukan tindakan dan/atau memberikan informasi yang tidak benar atau melanggar Perjanjian ini.',
        '2. Pengecualian Wanprestasi. Hal-hal menyangkut kesalahan, kelalaian, dan kegagalan yang diakibatkan oleh salah satu pihak dianggap bukan merupakan Wanprestasi apabila hal tersebut timbul dari peristiwa Keadaan Memaksa (Force Majeure).',
      ],
    },
    {
      heading: 'PASAL 9\nGANTI RUGI',
      paragraphs: [
        '1. Salah satu Pihak wajib bertanggung jawab terhadap segala bentuk kerugian, ancaman, maupun tuntutan yang dialami oleh Pihak lainnya dalam hal salah satu Pihak telah lalai dan/atau wanprestasi dengan cara tidak melaksanakan hak dan kewajibannya termasuk namun tidak terbatas pada tidak melaksanakan Pekerjaan, kerusakan barang dikarenakan kelalaian, gagal mencapai target dalam pelaksanaan pekerjaan, tidak melaksanakan pembayaran, dan/atau melaksanakan Pekerjaan atau pembayaran tetapi tidak tepat waktu, dan/atau melakukan pekerjaan atau pembayaran tetapi tidak sesuai dengan ketentuan yang telah dimintakan oleh masing-masing Pihak sebagaimana tertulis di dalam Perjanjian ini.',
        '2. Dalam hal PIHAK KEDUA lalai dan/atau wanprestasi dalam melaksanakan kewajiban atau melakukan hal-hal yang disebutkan dalam ayat (1) di atas, maka PIHAK PERTAMA berhak untuk mengakhiri Perjanjian ini lebih awal sebagaimana diatur dalam Pasal 11 Perjanjian ini.',
      ],
    },
    {
      heading: 'PASAL 10\nPENGALIHAN DAN/ATAU SUB-KONTRAK',
      paragraphs: [
        '1. PIHAK KEDUA dilarang untuk mengalihkan sebagian atau seluruh ketentuan dalam Perjanjian ini.',
        '2. PIHAK PERTAMA dapat mengalihkan sebagian atau seluruh ketentuan dalam Perjanjian ini kepada pihak lain dengan persetujuan PIHAK KEDUA.',
        '3. PIHAK KEDUA dilarang untuk mensubkontrakkan sebagian/seluruh pekerjaan dan kewajibannya dalam Perjanjian ini kepada pihak ketiga manapun tanpa persetujuan tertulis dari PIHAK PERTAMA.',
      ],
    },
    {
      heading: 'PASAL 11\nPENGAKHIRAN PERJANJIAN',
      paragraphs: [
        '1. Bahwa Perjanjian ini akan berakhir apabila terjadi salah satu dari hal-hal sebagai berikut:',
        'a. Jangka waktu Perjanjian sebagaimana diatur dalam Pasal 2 tersebut di atas berakhir dan tidak diperjanjikan lain oleh Para Pihak.',
        'b. Para Pihak sepakat untuk mengakhiri Perjanjian ini dan dituangkan secara tertulis dalam sebuah kesepakatan pengakhiran yang ditandatangani oleh Para Pihak.',
        'c. Salah satu Pihak melanggar, baik sebagian maupun seluruh ketentuan dalam Perjanjian ini, dan tidak segera melakukan perbaikan dalam jangka waktu 7 (tujuh) hari kerja setelah disampaikannya pemberitahuan tertulis telah terjadinya pelanggaran oleh Pihak yang dirugikan.',
        'd. Diputuskan pengakhiran berdasarkan hasil dari evaluasi yang dimaksud dalam Pasal 5 Perjanjian ini.',
        'e. Tidak tercapai kesepakatan mengenai penempatan PIHAK KEDUA sebagaimana diatur pada Pasal 5 Perjanjian ini.',
        'f. Dalam hal terdapat ketentuan perundang-undangan dan/atau kebijakan Pemerintah yang tidak memungkinkan berlangsungnya Perjanjian ini.',
        '2. Dengan berakhirnya Perjanjian ini, baik dikarenakan Force Majeure ataupun karena hal-hal sebagaimana dimaksud dalam Pasal ini, maka masing-masing Pihak tetap harus memenuhi kewajibannya yang telah timbul sebelum tanggal pengakhiran Perjanjian hingga tanggal dimana Perjanjian ini berakhir.',
        '3. Para Pihak sepakat mengesampingkan ketentuan Pasal 1266 Kitab Undang-Undang Hukum Perdata khususnya ketentuan yang mengharuskan adanya putusan pengadilan untuk pengakhiran suatu perjanjian, sehingga untuk pengakhiran Perjanjian ini tidak diperlukan adanya putusan pengadilan.',
      ],
    },
    {
      heading: 'PASAL 12\nPEMBERITAHUAN',
      paragraphs: [
        '1. Setiap pemberitahuan, permintaan, dan lain-lain berkaitan dengan Perjanjian ini harus dibuat secara tertulis dan harus dikirim dengan surat tercatat, jasa kurir, dikirim secara langsung dengan mendapat tanda terima, atau melalui e-mail, yang ditujukan ke alamat:',
        'Jika dikirim kepada PIHAK PERTAMA dialamatkan kepada: Alamat: Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20 GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330; Telepon: 021 - 50555340; E-mail: Kokarsi_unitjkt@sankyu.co.id',
        'Jika dikirim kepada PIHAK KEDUA dialamatkan kepada: Alamat: __MITRA_ADDRESS__; Telepon: __MITRA_PHONE__; E-mail: __MITRA_EMAIL__',
        '2. Pemberitahuan dianggap telah diterima oleh Pihak yang dituju: pada saat ditandatanganinya tanda terima oleh Pihak yang dituju (dalam hal dikirim langsung atau menggunakan jasa kurir); dalam 3 (tiga) hari kerja setelah tanggal pengiriman jika pemberitahuan disampaikan melalui surat tercatat; dan pada saat konfirmasi laporan pengiriman telah diterima oleh pengirim, pada tanggal diterimanya e-mail, jika pemberitahuan disampaikan melalui e-mail.',
      ],
    },
    {
      heading: 'PASAL 13\nPENYELESAIAN PERSELISIHAN',
      paragraphs: [
        '1. Perjanjian ini diatur menurut hukum negara Republik Indonesia. Segala perselisihan yang timbul akan diselesaikan oleh Para Pihak dengan cara musyawarah untuk mufakat.',
        '2. Apabila penyelesaian perselisihan secara musyawarah sebagaimana dimaksud pada ayat (1) tidak tercapai dalam jangka waktu 30 (tiga puluh) hari sejak timbulnya perselisihan, yaitu sejak pertama kali perselisihan dinyatakan oleh salah satu Pihak kepada Pihak lainnya, maka Para Pihak sepakat untuk menyelesaikan perselisihan melalui Pengadilan Negeri yang berwenang.',
      ],
    },
    {
      heading: 'PASAL 14\nPERUBAHAN PERJANJIAN',
      paragraphs: [
        '1. Para Pihak sepakat bahwa setiap perubahan pasal atau ayat-ayat dalam Perjanjian ini hanya dapat dilakukan atas kesepakatan tertulis Para Pihak.',
        '2. Setiap perubahan pasal atau ayat-ayat sebagaimana dimaksud dalam ketentuan ayat (1) pasal ini, setelah disepakati dibuat dalam suatu amandemen yang merupakan satu kesatuan dan bagian yang tidak terpisahkan dari Perjanjian ini.',
        '3. Perjanjian ini berikut seluruh lampiran, amandemen, dan/atau addendum (yang ada atau akan ada di kemudian hari) merupakan satu kesatuan yang mewakili keseluruhan Perjanjian dan oleh karenanya setiap dan seluruh komunikasi, korespondensi, keterangan dan kesepakatan lain, baik lisan maupun tertulis yang telah ada atau dibuat sebelumnya dianggap tidak berlaku.',
        '4. Tidak ada amandemen, addendum atau variasi dari Perjanjian ini yang berlaku efektif kecuali dibuat secara tertulis dan ditandatangani oleh Para Pihak atau perwakilannya yang sah.',
      ],
    },
    {
      heading: 'PASAL 15\nLAIN-LAIN',
      paragraphs: [
        '1. Dalam hal salah satu atau lebih ketentuan-ketentuan dalam Perjanjian ini bertentangan dengan peraturan perundang-undangan yang berlaku atau tidak dapat dilaksanakan karena ketentuan hukum ("Undang-Undang"), maka ketentuan-ketentuan lain dalam Perjanjian yang tidak melanggar hukum akan tetap berlaku secara mengikat bagi Para Pihak.',
        '2. Perjanjian ini dapat ditandatangani secara bersamaan dalam dua atau lebih halaman terpisah oleh Para Pihak, dimana masing-masing bagian yang ditandatangani tersebut dianggap asli dan merupakan Perjanjian yang sama.',
        '3. Kegagalan, keterlambatan, atau penundaan salah satu Pihak untuk menjalankan haknya berdasarkan Perjanjian ini atau kegagalan, keterlambatan, atau penundaan untuk meminta Pihak lainnya agar memenuhi ketentuan-ketentuan dalam Perjanjian ini, tidak akan dianggap sebagai pengesampingan atau pelepasan hak, wewenang, atau tuntutan oleh Pihak lainnya untuk di kemudian hari menuntut dipenuhinya ketentuan-ketentuan dalam Perjanjian ini.',
      ],
    },
  ]
}

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
    sections: mitraFullSections('MITRA_DRIVER'),
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
    sections: mitraFullSections('MITRA_KOMART'),
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
    sections: mitraFullSections('MITRA_STAFF'),
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
    sections: mitraFullSections('MITRA_WAREHOUSE'),
    requiredFields: ['employee.nik', 'employee.birthPlace', 'employee.address', 'contract.baseCompensation'],
  },
}

export function getContractDocumentDefinition(templateKey: string) {
  return CONTRACT_DOCUMENT_DEFINITIONS[templateKey]
}

