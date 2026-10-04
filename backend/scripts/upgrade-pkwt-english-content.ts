/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Perbaiki kolom KANAN (English) template PKWT yang masih berbahasa Indonesia.
 *
 * Masalah: versi template yang sudah PUBLISHED menyimpan `contentDefinition`
 * LAMA, yang kolom `.languages.en`-nya berisi teks Indonesia — judul pasal
 * (`Pasal 1\nMaksud Kesepakatan` alih-alih `Article 1\nAgreement Purpose`),
 * pembuka, para pihak, dan penutup. Versi bersifat immutable, jadi memperbaiki
 * definisi di kode TIDAK mengubah versi yang sudah terbit; pratinjau dan kontrak
 * baru tetap memakai konten lama.
 *
 * Solusi: untuk setiap template PKWT aktif, buat versi BARU
 * (versionNumber = max+1) berisi contentDefinition dari definisi kode terkini,
 * lalu publish. Versi lama di-ARCHIVE (tidak dihapus) agar tetap dapat diaudit.
 *
 * Idempoten & aman:
 *   - Template tanpa definisi kode dilewati.
 *   - Template yang kolom EN-nya SUDAH Inggris dilewati (tidak menambah versi).
 *   - Dijalankan default sebagai DRY-RUN.
 *
 * Pemakaian:
 *   npx ts-node scripts/upgrade-pkwt-english-content.ts            (dry-run)
 *   npx ts-node scripts/upgrade-pkwt-english-content.ts --confirm  (publish)
 *   npx ts-node scripts/upgrade-pkwt-english-content.ts --confirm --include-inactive
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../src/contracts/contract-document-definitions'
import {
  definitionToContentDefinition,
  definitionToFieldDefinitions,
} from '../src/contract-templates/default-template-definition'
import { applyTemplateBindings } from '../src/contract-templates/template-field-bindings.helpers'
import {
  collectAllPlaceholders,
  validateContentDefinition,
} from '../src/contract-templates/template-schema.validator'

/** Prisma dibuat malas agar modul dapat di-import unit test tanpa koneksi. */
let _prisma: PrismaClient | null = null
function getPrisma(): PrismaClient {
  if (_prisma) return _prisma
  config({ path: resolve(__dirname, '../.env') })
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')
  _prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
  return _prisma
}

/**
 * Frasa yang HANYA ada di redaksi Indonesia. Dipakai untuk mengukur apakah
 * kolom kanan sudah bersih — sengaja menghindari kata umum yang juga muncul
 * dalam naskah Inggris (mis. `Karyawan` di `Koperasi Karyawan`).
 */
const INDONESIAN_MARKERS = [
  'Pada hari ini',
  'Demikian Kesepakatan',
  'Para Pihak',
  'Ruang Lingkup',
  'Jangka Waktu',
  'Upah Karyawan',
  'PIHAK PERTAMA adalah',
  'PIHAK KEDUA adalah',
  'Maksud Kesepakatan',
  'Masa Berlakunya',
  'Pengupahan',
  'Waktu Kerja',
  'Tata Tertib',
  'Disiplin Kerja',
]

/** Penanda Indonesia yang masih tersisa di kolom kanan. */
export function indonesianMarkersIn(contentDefinition: any): string[] {
  const en = contentDefinition?.languages?.en
  if (!Array.isArray(en)) return []
  const txt = JSON.stringify(en)
  return INDONESIAN_MARKERS.filter((m) => txt.includes(m))
}

/**
 * Versi dianggap SUDAH benar bila kolom kanannya tidak lagi memuat penanda
 * Indonesia.
 *
 * Sengaja TIDAK ikut memeriksa kesejajaran bentuk badan ID/EN: template bisa
 * punya `contentOverrides` lama yang mengubah jumlah paragraf salah satu sisi
 * (mis. `recitals` dipendekkan). Bila bentuk dipakai sebagai syarat, skrip tidak
 * akan pernah idempoten — versi baru terus dibuat tanpa henti. Ketidaksejajaran
 * tetap DILAPORKAN lewat `bodyAligned` agar terlihat, tanpa memblokir.
 */
export function isEnglishColumnFixed(contentDefinition: any): boolean {
  const en = contentDefinition?.languages?.en
  if (!Array.isArray(en) || en.length === 0) return false
  return indonesianMarkersIn(contentDefinition).length === 0
}

/**
 * Bentuk badan (paragraph/article + jumlah paragraf) kolom ID dan EN.
 *
 * Engine mengunci baris ID/EN per INDEX, jadi bila bentuknya berbeda kolom
 * kanan akan bergeser. Dipakai sebagai LAPORAN, bukan syarat.
 */
export function bodyShapes(contentDefinition: any): { id: string; en: string; aligned: boolean } {
  const shape = (blocks: any) =>
    (Array.isArray(blocks) ? blocks : [])
      .filter((b: any) => b?.type === 'paragraph' || b?.type === 'article')
      .map((b: any) => (b.type === 'article' ? `a:${(b.paragraphs ?? []).length}` : 'p'))
      .join(',')
  const id = shape(contentDefinition?.languages?.id)
  const en = shape(contentDefinition?.languages?.en)
  return { id, en, aligned: id === en }
}


async function upgradeTemplates(confirmed: boolean, includeInactive = false) {
  const templates = await getPrisma().contractTemplate.findMany({
    where: includeInactive ? { family: 'PKWT' } : { family: 'PKWT', isActive: true },
    orderBy: { id: 'asc' },
  })

  const report: any[] = []

  for (const template of templates) {
    const definition = CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey]
    if (!definition) {
      report.push({ template: template.code, action: 'skip', reason: 'definisi kode tidak ada' })
      continue
    }

    const published = await getPrisma().contractTemplateVersion.findFirst({
      where: { templateId: template.id, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })

    if (published && isEnglishColumnFixed(published.contentDefinition)) {
      report.push({ template: template.code, action: 'skip', reason: 'kolom EN sudah Inggris' })
      continue
    }

    const merged = mergeDefinition(definition, (template.contentOverrides as any) ?? null)
    const contentDefinition = definitionToContentDefinition(merged)
    const baseFields = definitionToFieldDefinitions(merged)

    const bindings = await getPrisma().contractTemplateField.findMany({
      where: { templateId: template.id, field: { is: { isActive: true } } },
      include: { field: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const fieldDefinitions = applyTemplateBindings(baseFields, bindings)

    // Jembatan prefix `custom.` — samakan dengan publish()/preview().
    const validKeys = new Set(fieldDefinitions.map((f: any) => String(f.key)))
    for (const placeholder of collectAllPlaceholders(contentDefinition)) {
      const referenced = fieldDefinitions.some(
        (f: any) => placeholder === f.key || placeholder === `custom.${f.key}`,
      )
      if (referenced) validKeys.add(placeholder)
    }

    validateContentDefinition(contentDefinition, [...validKeys], template.family as any)

    const before = published ? indonesianMarkersIn(published.contentDefinition) : []
    const shapes = bodyShapes(contentDefinition)
    const latest = await getPrisma().contractTemplateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { versionNumber: 'desc' },
    })
    const nextVersion = (latest?.versionNumber ?? 0) + 1

    report.push({
      template: template.code,
      active: template.isActive,
      action: confirmed ? 'publish' : 'will-publish',
      from: published ? `v${published.versionNumber}` : '(belum ada versi terbit)',
      to: `v${nextVersion}`,
      idBlocks: (contentDefinition.languages.id ?? []).length,
      enBlocks: (contentDefinition.languages.en ?? []).length,
      markersBefore: before,
      bodyAligned: shapes.aligned,
      ...(shapes.aligned ? {} : { bodyId: shapes.id, bodyEn: shapes.en }),
    })

    if (!confirmed) continue

    await getPrisma().$transaction(async tx => {
      await tx.contractTemplateVersion.updateMany({
        where: { templateId: template.id, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      })
      await tx.contractTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: nextVersion,
          status: 'PUBLISHED',
          contentDefinition: contentDefinition as any,
          fieldDefinitions: fieldDefinitions as any,
          changeSummary: 'Perbaikan kolom kanan (English): judul pasal "Article N" + pembuka/para pihak/penutup berbahasa Inggris sesuai master',
          createdByName: 'Perbaikan kolom EN PKWT',
          publishedByName: 'Perbaikan kolom EN PKWT',
          publishedAt: new Date(),
        },
      })
    })
  }

  return report
}

async function main() {
  const confirmed = process.argv.includes('--confirm')
  const includeInactive = process.argv.includes('--include-inactive')

  const report = await upgradeTemplates(confirmed, includeInactive)
  console.log(JSON.stringify(report, null, 2))

  console.log(confirmed
    ? '\nSELESAI. Versi lama di-ARCHIVE, versi baru PUBLISHED.'
    : '\nDRY-RUN. Jalankan ulang dengan --confirm untuk menerbitkan versi baru.')
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
    .finally(() => getPrisma().$disconnect())
}
