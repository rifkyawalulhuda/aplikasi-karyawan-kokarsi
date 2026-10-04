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

function toLanguageBlocks(definition: ContractDocumentDefinition, english = false): any[] {
  const blocks: any[] = [
    { id: 'title', type: 'title', text: replaceLegacyTokens(english ? (definition.subtitle ?? definition.title) : definition.title) },
  ]
  if (!english && definition.subtitle) {
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

const FIELD_LABELS: Record<string, string> = {
  // Employee
  'employee.fullName': 'Nama Lengkap Karyawan',
  'employee.employeeNo': 'Nomor Induk Karyawan',
  'employee.nik': 'NIK Karyawan',
  'employee.birthPlace': 'Tempat Lahir',
  'employee.birthDate': 'Tanggal Lahir',
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