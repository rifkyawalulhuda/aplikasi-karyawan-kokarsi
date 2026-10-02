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

const replaceLegacyTokens = (text: string): string => text
  .replace(/__ROLE_LABEL__/g, '{{employee.jobRole}}')
  .replace(/__TERM_DATE__/g, '1. Jangka waktu kesepakatan mengikuti {{contract.termRange}}.')
  .replace(/__WAGE_AMOUNT__/g, '1. Upah/imbalan yang disepakati adalah {{contract.baseCompensation}}.')

function article(id: string, heading: string, paragraphs: string[]) {
  return {
    id,
    type: 'article',
    heading,
    paragraphs: paragraphs.map(replaceLegacyTokens),
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
    blocks.push({
      id: 'signature',
      type: 'signature',
      leftRole: definition.firstPartyLabel,
      rightRole: definition.secondPartyLabel,
    })
    return blocks
  }
  blocks.push({ id: 'opening', type: 'paragraph', text: replaceLegacyTokens(definition.openingLine) })
  blocks.push(article('recitals', 'Para Pihak', definition.recitals))
  blocks.push(article('role', 'Ruang Lingkup dan Posisi', [definition.roleLabel, definition.locationLine]))
  blocks.push(article('term', 'Jangka Waktu', [definition.termLine]))
  blocks.push(article('compensation', definition.compensationLabel, [`{{contract.baseCompensation}}`]))
  definition.sections.forEach((section, index) => blocks.push(article(`section-${index + 1}`, section.heading, section.paragraphs)))
  blocks.push(article('closing', 'Penutup', definition.closingParagraphs))
  blocks.push({
    id: 'signature',
    type: 'signature',
    leftRole: definition.firstPartyLabel,
    rightRole: definition.secondPartyLabel,
  })
  return blocks
}

export function definitionToContentDefinition(definition: ContractDocumentDefinition): SeedContentDefinition {
  const id = toLanguageBlocks(definition)
  const en = definition.family === 'PKWT' && definition.englishSections
    ? toLanguageBlocks({
      ...definition,
      title: definition.subtitle ?? definition.title,
      subtitle: undefined,
      sections: Object.entries(definition.englishSections).map(([heading, paragraphs]) => ({ heading, paragraphs })),
      openingLine: definition.openingLine,
      recitals: definition.recitals,
      closingParagraphs: definition.closingParagraphs,
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