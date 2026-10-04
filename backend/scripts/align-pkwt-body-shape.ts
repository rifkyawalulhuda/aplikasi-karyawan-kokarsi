/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Selaraskan bentuk badan (ID vs EN) template PKWT yang sudah terbit.
 *
 * MASALAH
 * Template yang sudah PUBLISHED menyimpan `contentOverrides` LEGACY. Untuk
 * beberapa template, override itu memuat `recitals` dengan jumlah entri berbeda
 * dari definisi kode — mis. `recitals` kolom ID hanya memuat PIHAK KEDUA
 * (PIHAK PERTAMA hilang), sementara kolom EN tetap 2 paragraf.
 *
 * Versi bersifat immutable, jadi memperbaiki definisi di kode TIDAK mengubah
 * versi terbit. Selisih jumlah paragraf itu dulu menggeser seluruh dokumen saat
 * dirender, sehingga bold jatuh di baris yang salah.
 *
 * CATATAN: sejak engine PKWT memasangkan paragraf PER BLOK (bukan per index
 * rata), geseran itu sudah tidak menular lagi, dan fallback teks ID ke kolom
 * Inggris sudah dihapus. Skrip ini tetap berguna untuk membereskan DATA-nya,
 * supaya konten ID dan EN benar-benar sepadan dan perbedaan bentuk tidak
 * tersembunyi di balik kompensasi engine.
 *
 * AKSI
 * Untuk tiap template PKWT, bangun `contentDefinition` dari definisi kode
 * terkini + override (memakai `mergeDefinition`). Bila bentuk badan ID/EN BELUM
 * sejajar, buat versi BARU (versionNumber = max+1) lalu publish. Versi lama
 * di-ARCHIVE (tidak dihapus) agar tetap dapat diaudit.
 *
 * Idempoten: template yang bentuknya sudah sejajar dilewati. Aman dijalankan
 * berulang kali. Default DRY-RUN.
 *
 * Pemakaian:
 *   npx ts-node scripts/align-pkwt-body-shape.ts            (dry-run)
 *   npx ts-node scripts/align-pkwt-body-shape.ts --confirm  (publish)
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../src/contracts/contract-document-definitions'
import {
  definitionToContentDefinition,
  definitionToFieldDefinitions
} from '../src/contract-templates/default-template-definition'
import { applyTemplateBindings } from '../src/contract-templates/template-field-bindings.helpers'
import {
  collectAllPlaceholders,
  validateContentDefinition
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
 * Bentuk badan kolom ID dan EN: urutan blok + jumlah paragraf efektifnya.
 * Dua kolom dianggap sejajar bila bentuknya IDENTIK.
 */
export function bodyShape(blocks: any): string {
  return (Array.isArray(blocks) ? blocks : [])
    .filter((b: any) => b?.type === 'paragraph' || b?.type === 'article' || b?.type === 'list')
    .map((b: any) => {
      const id = String(b?.id ?? '?')
      if (b.type === 'paragraph') return `${id}:p`
      if (b.type === 'list') return `${id}:l${(b.items ?? []).length}`
      return `${id}:a${(b.heading ? 1 : 0) + (b.paragraphs ?? []).length}`
    })
    .join(' | ')
}

/** Apakah bentuk badan kolom ID dan EN sudah sejajar? */

async function alignTemplates(confirmed: boolean, includeInactive = false) {
  const templates = await getPrisma().contractTemplate.findMany({
    where: includeInactive ? { family: 'PKWT' } : { family: 'PKWT', isActive: true },
    orderBy: { id: 'asc' }
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
      orderBy: { versionNumber: 'desc' }
    }) as any

    if (published && isBodyShapeAligned(published.contentDefinition)) {
      report.push({ template: template.code, action: 'skip', reason: 'bentuk badan ID/EN sudah sejajar' })
      continue
    }

    const merged = mergeDefinition(definition, (template.contentOverrides as any) ?? null)
    const contentDefinition = definitionToContentDefinition(merged)
    const baseFields = definitionToFieldDefinitions(merged)

    const bindings = await getPrisma().contractTemplateField.findMany({
      where: { templateId: template.id, field: { is: { isActive: true } } },
      include: { field: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    })
    const fieldDefinitions = applyTemplateBindings(baseFields, bindings as any)

    // Jembatan prefix `custom.` — samakan dengan publish()/preview().
    const validKeys = new Set(fieldDefinitions.map((f: any) => String(f.key)))
    for (const placeholder of collectAllPlaceholders(contentDefinition)) {
      const referenced = fieldDefinitions.some(
        (f: any) => placeholder === f.key || placeholder === `custom.${f.key}`
      )
      if (referenced) validKeys.add(placeholder)
    }

    validateContentDefinition(contentDefinition, [...validKeys], template.family as any)

    const latest = await getPrisma().contractTemplateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { versionNumber: 'desc' }
    })
    const nextVersion = ((latest?.versionNumber ?? 0) as number) + 1

    const aligned = isBodyShapeAligned(contentDefinition)
    report.push({
      template: template.code,
      action: confirmed ? 'publish' : 'will-publish',
      from: published ? `v${published.versionNumber}` : '(belum ada versi terbit)',
      to: `v${nextVersion}`,
      reasons: published && !isBodyShapeAligned(published.contentDefinition)
        ? ['bentuk badan ID/EN pada versi terbit belum sejajar']
        : [],
      alignedNow: aligned
    })

    if (!confirmed) continue
    if (!aligned) {
      // Jangan terbitkan versi baru yang masih tidak sejajar: itu hanya akan
      // menambah versi tanpa memperbaiki apa pun.
      report[report.length - 1].action = 'skip'
      report[report.length - 1].reason = 'definisi kode + override tetap tidak sejajar'
      continue
    }

    await getPrisma().$transaction(async (tx) => {
      await tx.contractTemplateVersion.updateMany({
        where: { templateId: template.id, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' }
      })
      await tx.contractTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: nextVersion,
          status: 'PUBLISHED',
          contentDefinition: contentDefinition as any,
          fieldDefinitions: fieldDefinitions as any,
          changeSummary: 'Selaraskan bentuk badan ID/EN: kolom ID dan EN dibuat sepadan per blok',
          createdByName: 'Perbaikan keselarasan badan PKWT',
          publishedByName: 'Perbaikan keselarasan badan PKWT',
          publishedAt: new Date()
        }
      })
    })
  }

  return report
}

async function main() {
  const confirmed = process.argv.includes('--confirm')
  const includeInactive = process.argv.includes('--include-inactive')

  const report = await alignTemplates(confirmed, includeInactive)
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

export function isBodyShapeAligned(contentDefinition: any): boolean {
  const id = bodyShape(contentDefinition?.languages?.id)
  const en = bodyShape(contentDefinition?.languages?.en)
  return id.length > 0 && id === en
}
