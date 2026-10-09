import { ContractDocumentDefinition } from '../contracts/contract-document-definitions'
import { collectAllPlaceholders } from './template-schema.validator'

export interface SeedFieldDefinition {
  key: string
  label: string
  dataType: 'TEXT' | 'NUMBER' | 'DATE'
  sourceType: 'SYSTEM' | 'CONTRACT_INPUT'
  required: boolean
}

export interface SeedContentDefinition {
  languages: {
    id: any[]
    en: any[]
  }
}

/**
 * Token legacy → placeholder final.
 *
 * Token `__EN_*` dipakai oleh data pasal Inggris (`PKWT_EN_ARTICLE_BODIES`).
 * Token itu WAJIB punya redaksi Inggris sendiri: `__TERM_DATE__` dan
 * `__WAGE_AMOUNT__` berisi KALIMAT, bukan sekadar placeholder. Tanpa cabang
 * ini, Pasal 2 ayat 1 dan Pasal 3 ayat 1 kolom kanan akan tetap berbahasa
 * Indonesia di tengah naskah Inggris.
 */
const replaceLegacyTokens = (text: string): string => text
  .replace(/__ROLE_LABEL__/g, '{{employee.jobRole}}')
  .replace(/__TERM_DATE__/g, '1. Jangka waktu kesepakatan mengikuti {{contract.termRange}}.')
  .replace(/__WAGE_AMOUNT__/g, '1. Upah/imbalan yang disepakati adalah {{contract.baseCompensation}}.')
  .replace(/__EN_TERM_DATE__/g, '1. This agreement is effective since {{contract.termRange}}.')
  .replace(/__EN_WAGE_AMOUNT__/g, '1. The employee shall accept wage amount : {{contract.baseCompensation}}.')

function article(id: string, heading: string, paragraphs: string[]) {
  return {
    id,
    type: 'article',
    heading,
    paragraphs: paragraphs.map(replaceLegacyTokens),
  }
}

/**
 * Blok tanda tangan default.
 *
 * Semua teks STATIS eksplisit di sini (Opsi D) supaya tampil di editor dan
 * dapat diedit per-template. Nilai-nilai ini juga menjadi fallback bila admin
 * mengosongkannya. Nama ORANG tidak di sini — diambil dari data kontrak.
 */
function signatureBlock(definition: ContractDocumentDefinition) {
  const isPkwt = definition.family === 'PKWT'
  return {
    id: 'signature',
    type: 'signature',
    // Label pilar (baris atas tabel tanda tangan) — `Pihak Pertama`/`Pihak Kedua`.
    leftRole: definition.firstPartyLabel,
    rightRole: definition.secondPartyLabel,
    // Nama perusahaan/pihak. Default mengikuti renderer sebelumnya
    // (MITRA & PKWT snapshot sama-sama memakai kop koperasi di kiri).
    leftHeader: "KOPERASI PT. SANKYU INT'L",
    rightHeader: isPkwt ? 'KARYAWAN' : 'MITRA',
    // Jabatan (baris bawah).
    leftParty: '(Ketua Koperasi)',
    rightParty: isPkwt ? '(Karyawan)' : '(Mitra)',
  }
}

/**
 * Blok identitas PIHAK KEDUA (Karyawan) — tempat baris `Jenis Kelamin` berada.
 *
 * Kenapa ada di definisi kode: tanpa blok ini, `{{employee.gender}}` hanya hidup
 * di draft yang diketik manual lewat editor. Versi baru yang dibuat dari definisi
 * kode (`createDraft`) tidak akan punya baris itu sama sekali, sehingga field
 * gender yang sudah didaftarkan di katalog praktis tidak terpakai.
 *
 * Master memang punya blok ini di KEDUA kolom (`PKWT DRIVER 2026.pdf` halaman 1,
 * y=311.9 `II. N a m a : IBAD UBAIDILLAH` di kiri dan kolom kanan sejajar).
 *
 * Baris `Gender`/`Jenis Kelamin` memakai placeholder yang SAMA di kedua kolom;
 * yang berbeda adalah nilainya — resolver menerjemahkan enum `MALE`/`FEMALE`
 * menjadi "Laki-laki" (ID) dan "Male" (EN). Lihat `genderLabel` di
 * `template-value-resolver.helpers.ts`.
 *
 * Redaksi EN mengikuti master kolom kanan, dengan dua koreksi yang disengaja
 * supaya kolom Inggris bersih dari redaksi Indonesia:
 *   1. master masih menulis label `N a m a`; di sini `Name`.
 *   2. master masih menulis bulan Indonesia (`20 Mei 1980`); di sini tanggalnya
 *      memakai format Inggris lewat `displayValueEn` resolver (`2 July 1996`).
 *
 * CATATAN BENTUK (jangan diubah tanpa mengukur ulang halaman): blok ini menambah
 * satu blok di SETIAP kolom, sehingga `blockGap` harus diturunkan bersamaan
 * supaya dokumen tetap 4 halaman seperti master. Lihat `PKWT_GEOMETRY.blockGap`.
 *
 * Catatan: master juga memuat blok identitas PIHAK PERTAMA (perusahaan) sebelum
 * blok ini. Blok itu SENGAJA belum dikodekan di sini, dan bukan karena lupa —
 * sudah diukur: menambahkannya menuntut `lineGap` turun 1.6 → 1.2 **dan**
 * `blockGap` 8 → 6 agar tetap 4 halaman, yaitu mengubah kerapatan SELURUH badan
 * kontrak, bukan hanya jarak antar-blok. Perubahan sebesar itu perlu
 * perbandingan visual lebih dulu. Bila nanti ditambahkan, tambahkan untuk KEDUA
 * bahasa sekaligus supaya bentuk ID/EN tetap sejajar.
 */
function identityBlocks(english: boolean): any[] {
  const text = english
    ? [
      'II.\tName          :  {{employee.fullName}}',
      'Birth date          :  {{employee.birthPlace}},  {{employee.birthDate}}',
      'Gender : {{employee.gender}}',
    ]
    : [
      'II.\tN a m a          :  {{employee.fullName}}',
      'Tgl. Lahir          :  {{employee.birthPlace}},  {{employee.birthDate}}',
      'Jenis Kelamin : {{employee.gender}}',
    ]

  return [{ id: 'identity-employee', type: 'paragraph', text: replaceLegacyTokens(text.join('\n')) }]
}

function toLanguageBlocks(definition: ContractDocumentDefinition, english = false): any[] {
  const blocks: any[] = [
    { id: 'title', type: 'title', text: replaceLegacyTokens(english ? (definition.subtitle ?? definition.title) : definition.title) },
  ]
  // Blok `subtitle` HANYA untuk MITRA (satu bahasa). Pada PKWT, `definition.subtitle`
  // adalah JUDUL INGGRIS, bukan subjudul: kop dua baris = Judul ID (blok `title`
  // kolom ID) + Judul EN (blok `title` kolom EN). Menambahkan blok `subtitle` di
  // kolom ID membuat kolom kanan punya judul yang sama sekaligus menimpa Judul EN
  // saat render (lihat `resolvePkwtHeaderTitles` di `pkwt-document.renderer.ts`).
  if (!english && definition.family === 'MITRA' && definition.subtitle) {
    blocks.push({ id: 'subtitle', type: 'subtitle', text: definition.subtitle })
  }

  if (definition.family === 'MITRA') {
    // Konten Perjanjian Kemitraan 100% berasal dari `definition.sections`
    // (pembukaan + para pihak + PASAL 1..15 + penutup) sehingga seluruh teks
    // dapat diedit admin lewat Contract Template Editor. Kode TIDAK menambah
    // kalimat apa pun — hanya header/footer yang statis di renderer.
    definition.sections.forEach((section, index) => {
      if (section.heading) {
        blocks.push(article(`section-${index + 1}`, section.heading, section.paragraphs))
      } else {
        // Section tanpa heading (pembukaan/penutup) = paragraf biasa.
        for (const p of section.paragraphs) {
          blocks.push({ id: `para-${index + 1}-${blocks.length}`, type: 'paragraph', text: replaceLegacyTokens(p) })
        }
      }
    })
    blocks.push(signatureBlock(definition))
    return blocks
  }
  // PKWT — struktur mengikuti master: pembuka, para pihak, ruang lingkup,
  // jangka waktu, pengupahan, PASAL 1..N, penutup.
  //
  // Kolom KANAN memakai judul + redaksi dari `definition.englishBody`. Sebelum
  // ini judul blok non-Pasal selalu hardcode bahasa Indonesia ('Para Pihak',
  // 'Ruang Lingkup dan Posisi', 'Jangka Waktu', 'Penutup') dan teksnya diambil
  // dari field Indonesia — itulah sebabnya sisi kanan pratinjau PKWT berbahasa
  // Indonesia walau kolom itu dimaksudkan Inggris.
  //
  // CATATAN BUG (jangan dihapus): fallback `?? definition.*` HANYA benar untuk
  // kolom INDONESIA. Untuk kolom Inggris, jatuh ke teks Indonesia berarti kolom
  // kanan memakai redaksi ID. Itu juga membuat jumlah paragraf `recitals`/`role`/
  // `closing` kolom EN mengikuti definisi ID — padahal override legacy bisa
  // memendekkannya, sehingga timbul selisih paragraf ID vs EN yang menggeser
  // seluruh dokumen (lihat `buildPkwtRowsFromStructuredParagraphs`).
  // Karena itu: untuk bahasa Inggris TIDAK ADA fallback ke teks ID. Bila sebuah
  // bagian belum diterjemahkan, bagian itu dibiarkan kosong daripada mencetak
  // bahasa Indonesia di kolom Inggris.
  const en = english ? definition.englishBody : undefined
  blocks.push({
    id: 'opening',
    type: 'paragraph',
    text: replaceLegacyTokens(english ? (en?.openingLine ?? '') : definition.openingLine),
  })
  // Identitas PIHAK KEDUA harus ada di KEDUA kolom dengan bentuk yang sama,
  // supaya engine tetap memasangkan baris ID/EN per blok (lihat
  // `buildPkwtRowsFromStructuredParagraphs`). Di sinilah `{{employee.gender}}`
  // berada; menambahkannya hanya di satu kolom akan menggeser seluruh pasangan
  // baris setelahnya.
  blocks.push(...identityBlocks(english))
  blocks.push(article(
    'recitals',
    english ? (en?.recitalsHeading ?? '') : 'Para Pihak',
    english ? (en?.recitals ?? []) : definition.recitals,
  ))
  blocks.push(article(
    'role',
    english ? (en?.roleHeading ?? '') : 'Ruang Lingkup dan Posisi',
    english ? [en?.roleLabel ?? '', en?.locationLine ?? ''].filter(s => s.length > 0) : [definition.roleLabel, definition.locationLine],
  ))
  blocks.push(article('term', english ? (en?.termHeading ?? '') : 'Jangka Waktu', [english ? (en?.termLine ?? '') : definition.termLine]))
  blocks.push(article(
    'compensation',
    english ? (en?.compensationLabel ?? '') : definition.compensationLabel,
    [`{{contract.baseCompensation}}`],
  ))
  definition.sections.forEach((section, index) => blocks.push(article(`section-${index + 1}`, section.heading, section.paragraphs)))
  blocks.push(article('closing', english ? (en?.closingHeading ?? '') : 'Penutup', english ? (en?.closingParagraphs ?? []) : definition.closingParagraphs))
  blocks.push(signatureBlock(definition))
  return blocks
}

export function definitionToContentDefinition(definition: ContractDocumentDefinition): SeedContentDefinition {
  const id = toLanguageBlocks(definition)
  // Kolom kanan PKWT: judul pasal diambil dari `englishSections[key].heading`,
  // BUKAN dari kunci `Record`-nya. Kunci itu heading Indonesia dan hanya
  // berfungsi sebagai pasangan — inilah bug yang membuat kolom kanan mencetak
  // `Pasal 1\nMaksud Kesepakatan` alih-alih `Article 1\nAgreement Purpose`.
  const en = definition.family === 'PKWT' && definition.englishSections
    ? toLanguageBlocks({
      ...definition,
      title: definition.subtitle ?? definition.title,
      subtitle: undefined,
      sections: Object.entries(definition.englishSections).map(([key, body]) => ({
        heading: body.heading,
        paragraphs: body.paragraphs,
      })),
    }, true)
    : []
  return { languages: { id, en } }
}

/**
 * Rapikan blok judul PKWT pada `contentDefinition` yang SUDAH tersimpan.
 *
 * Sebelum perbaikan, seed menaruh blok `subtitle` di kolom INDONESIA berisi JUDUL
 * INGGRIS (`definition.subtitle`). Renderer lama memakai subtitle itu sebagai
 * baris judul kedua, sehingga Judul EN yang diketik admin diabaikan. Bentuk baru:
 * kop dua baris = Judul ID (blok `title` kolom ID) + Judul EN (blok `title`
 * kolom EN); tidak ada blok `subtitle` di kolom ID.
 *
 * Fungsi ini mengembalikan salinan `content` yang sudah diselaraskan:
 *  - kolom EN wajib punya blok `title`; bila belum ada, teks subtitle ID
 *    dipindahkan ke sana agar judul tidak hilang;
 *  - blok `subtitle` kolom ID dibuang.
 *
 * Idempoten: `content` tanpa blok `subtitle` di kolom ID dikembalikan apa adanya
 * (referensi sama). HANYA berlaku untuk keluarga PKWT — MITRA memakai `subtitle`
 * secara sah sebagai subjudul dokumen.
 */
export function normalizePkwtTitleBlocks<T>(content: T, family?: string): T {
  if (family !== 'PKWT') return content
  const c = content as any
  const idBlocks: any[] = Array.isArray(c?.languages?.id) ? c.languages.id : []
  if (!idBlocks.some(b => b?.type === 'subtitle')) return content

  const clone = JSON.parse(JSON.stringify(content)) as any
  const cloneId: any[] = clone.languages.id
  const subtitleText = String(cloneId.find((b: any) => b?.type === 'subtitle')?.text ?? '').trim()
  const enBlocks: any[] = Array.isArray(clone.languages.en) ? clone.languages.en : []

  const enHasTitle = enBlocks.some((b: any) => b?.type === 'title' && String(b?.text ?? '').trim().length > 0)
  if (subtitleText && !enHasTitle) {
    const titleIndex = enBlocks.findIndex((b: any) => b?.type === 'title')
    if (titleIndex >= 0) enBlocks[titleIndex] = { ...enBlocks[titleIndex], id: 'title', type: 'title', text: subtitleText }
    else enBlocks.unshift({ id: 'title', type: 'title', text: subtitleText })
  }

  clone.languages.en = enBlocks
  clone.languages.id = cloneId.filter((b: any) => b?.type !== 'subtitle')
  return clone
}

const FIELD_LABELS: Record<string, string> = {
  // Employee
  'employee.fullName': 'Nama Lengkap Karyawan',
  'employee.employeeNo': 'Nomor Induk Karyawan',
  'employee.nik': 'NIK Karyawan',
  'employee.birthPlace': 'Tempat Lahir',
  'employee.birthDate': 'Tanggal Lahir',
  'employee.gender': 'Jenis Kelamin',
  'employee.address': 'Alamat Karyawan',
  'employee.phoneNumber': 'Nomor Telepon Karyawan',
  'employee.email': 'E-mail Karyawan',
  'employee.jobRole': 'Jabatan',
  // Contract
  'contract.contractNo': 'Nomor Kontrak',
  'contract.startDate': 'Tanggal Mulai',
  'contract.endDate': 'Tanggal Selesai',
  'contract.signedDate': 'Tanggal Tanda Tangan',
  'contract.baseCompensation': 'Kompensasi Dasar',
  'contract.termRange': 'Rentang Periode',
  'contract.duration': 'Durasi Kontrak',
  // Doc & settings
  'doc.docDate': 'Tanggal Dokumen',
  'doc.hariTanggal': 'Hari & Tanggal Tanda Tangan',
  'settings.cooperativeChairmanName': 'Nama Ketua Koperasi',
}

/**
 * Tipe data eksplisit untuk key yang tidak bisa ditebak dari namanya.
 * `doc.hariTanggal` mis. berisi "Hari & Tanggal..." (TEXT), bukan DATE.
 */
const FIELD_DATA_TYPES: Record<string, SeedFieldDefinition['dataType']> = {
  'doc.hariTanggal': 'TEXT',
  'contract.duration': 'TEXT',
  'contract.termRange': 'TEXT',
  'contract.contractNo': 'TEXT',
  'settings.cooperativeChairmanName': 'TEXT',
  'employee.phoneNumber': 'TEXT',
  'employee.email': 'TEXT',
  'employee.address': 'TEXT',
  'employee.gender': 'TEXT',
  'employee.birthPlace': 'TEXT',
  'employee.nik': 'TEXT',
  'employee.fullName': 'TEXT',
  'employee.employeeNo': 'TEXT',
}

export function definitionToFieldDefinitions(definition: ContractDocumentDefinition): SeedFieldDefinition[] {
  const content = definitionToContentDefinition(definition)
  const keys = [...new Set([...definition.requiredFields, ...collectAllPlaceholders(content)])]
  return keys.map(key => ({
    key,
    label: FIELD_LABELS[key] ?? key,
    dataType: FIELD_DATA_TYPES[key]
      ?? (key.includes('Date') || key.endsWith('Date') ? 'DATE' : key.includes('Compensation') ? 'NUMBER' : 'TEXT'),
    sourceType: key.startsWith('custom.') ? 'CONTRACT_INPUT' : 'SYSTEM',
    // Field SYSTEM selalu tersedia dari data karyawan/kontrak, jadi wajib.
    // Field CONTRACT_INPUT diisi manual di form kontrak: flag wajibnya adalah
    // keputusan PER-TEMPLATE (checkbox `ContractTemplateField.required`) dan
    // diterapkan oleh `applyTemplateBindings()`. Memaksa `true` di sini membuat
    // semua field dinamis wajib tanpa bisa dimatikan dari editor template.
    required: !key.startsWith('custom.'),
  }))
}