/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Perbaikan kontaminasi konten uji pada template legacy dan snapshot kontrak.
 *
 * Latar: template id=17142 (PKWT_DRIVER) dan id=18600 (MITRA_STAFF) menyimpan
 * `contentOverrides` berisi residu uji ("HAHAHA", "Pengusaha11", dst). Karena
 * kontrak ber-versi dirender eksklusif dari snapshot, residu ini sudah terbekukan
 * ke snapshot imutabel kontrak 60/61/119 dan akan terus muncul di PDF.
 *
 * Skrip ini membuang HANYA string yang teridentifikasi sebagai residu. Override
 * asli yang disengaja (mis. `roleLabel: 'Driver ajaa'`) tetap dipertahankan,
 * beserta perbaikan ejaan yang diminta. Versi template yang sudah ter-publish
 * tidak pernah diubah kontennya; sebagai gantinya dibuat versi baru agar
 * perubahan tetap dapat diaudit.
 *
 * Idempoten. Tanpa `--confirm` hanya menampilkan rencana (dry-run).
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../src/contracts/contract-document-definitions'
import { definitionToContentDefinition, definitionToFieldDefinitions } from '../src/contract-templates/default-template-definition'
import { resolvePlaceholders } from '../src/contract-templates/template-value-resolver.helpers'

config({ path: resolve(__dirname, '../.env') })

function definitionsOf(value: any): any[] {
  return Array.isArray(value) ? value : (value?.fields ?? [])
}

function fieldKeys(value: any): string[] {
  return definitionsOf(value).filter(field => field?.key).map(field =>
    field.sourceType === 'CONTRACT_INPUT'
      ? `custom.${String(field.key).replace(/^custom\./, '')}`
      : String(field.key)
  )
}

/** Pasangan [teks tercemar, pengganti] yang diterapkan berurutan. */
const REPLACEMENTS: Array<[string, string]> = [
  ['1. Perusahaan mempekerjakan Karyawan untuk waktu tertentu sesuai dengan kebutuhan perusahaan. yang sangat setabilll',
    '1. Perusahaan mempekerjakan Karyawan untuk waktu tertentu sesuai dengan kebutuhan perusahaan.'],
  ['1. Company employ the Employee for stated periods according to company need. very stabilll',
    '1. Company employ the Employee for stated periods according to company need.'],
  ['KESEPAKATAN KERJA WAKTU TERTENTU HAHAHA', 'KESEPAKATAN KERJA WAKTU TERTENTU'],
  ['STATED PERIODS LABOUR AGREEMENT HAHAHA', 'STATED PERIODS LABOUR AGREEMENT'],
  ['Pengusaha11', 'Pengusaha'],
  ['dukungan kemitraan operasional sesuai unit layanan yang berjalan. HAHAHA',
    'dukungan kemitraan operasional sesuai unit layanan yang berjalan.']
]

/** Residual uji yang dibuang, dicocokkan pada nilai trim (hindari false positive substring). */
const DROP_VALUES = new Set(['HAHAHA', 'Karyawan2'])

function sanitizeString(value: string): string | null {
  let next = value
  for (const [from, to] of REPLACEMENTS) next = next.split(from).join(to)
  if (DROP_VALUES.has(next.trim())) return null
  return next
}

function sanitize(node: any): any {
  if (typeof node === 'string') return sanitizeString(node)
  if (Array.isArray(node)) return node.map(sanitize).filter(v => v !== null)
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(node)) {
      const sv = sanitize(v)
      if (sv !== null) out[k] = sv
    }
    return out
  }
  return node
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
const confirmed = process.argv.includes('--confirm')

async function main() {
  const templates = await prisma.contractTemplate.findMany()

  // 1. Bersihkan contentOverrides tiap template.
  let templateFixes = 0
  for (const template of templates) {
    const before = template.contentOverrides
    if (!before || Object.keys(before as object).length === 0) continue
    const after = sanitize(before)
    if (JSON.stringify(after) === JSON.stringify(before)) continue

    console.log(`\n[template ${template.id}] ${template.name} (${template.templateKey})`)
    console.log('  SEBELUM:', JSON.stringify(before))
    console.log('  SESUDAH:', JSON.stringify(after))
    templateFixes++
    if (confirmed) {
      await prisma.contractTemplate.update({ where: { id: template.id }, data: { contentOverrides: after } })
    }
  }

  // 2. Untuk tiap template: pastikan versi PUBLISHED bersih, lalu snapshot kontrak.
  const after = confirmed ? await prisma.contractTemplate.findMany() : templates
  let republished = 0
  let snapshotsFixed = 0

  for (const template of after) {
    const base = CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey]
    if (!base) continue
    const cleanMerged = sanitize(mergeDefinition(base, template.contentOverrides as Record<string, any> | null))

    let published = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: template.id, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' }
    })

    const publishedIsClean = !!published && !JSON.stringify(published.contentDefinition).includes('HAHAHA')
    if (!publishedIsClean) {
      const latest = await prisma.contractTemplateVersion.findFirst({
        where: { templateId: template.id }, orderBy: { versionNumber: 'desc' }
      })
      republished++
      console.log(`\n[template ${template.id}] terbitkan versi bersih baru (v${(latest?.versionNumber ?? 0) + 1})`)
      if (confirmed) {
        await prisma.contractTemplateVersion.updateMany({
          where: { templateId: template.id, status: 'PUBLISHED' },
          data: { status: 'ARCHIVED' }
        })
        published = await prisma.contractTemplateVersion.create({
          data: {
            templateId: template.id,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            status: 'PUBLISHED',
            contentDefinition: definitionToContentDefinition(cleanMerged) as any,
            fieldDefinitions: definitionToFieldDefinitions(cleanMerged) as any,
            changeSummary: 'Perbaikan kontaminasi konten uji pada template legacy',
            createdByName: 'repair-contamination',
            publishedByName: 'repair-contamination',
            publishedAt: new Date()
          }
        })
      }
    }

    const contracts = await prisma.contract.findMany({
      where: { templateId: template.id },
      include: { employee: true }
    })
    for (const contract of contracts) {
      const snapshot = contract.templateSnapshot as any
      if (!snapshot || !JSON.stringify(snapshot).includes('HAHAHA')) continue

      // Snapshot kini dibangun ulang dari versi PUBLISHED yang sudah bersih.
      const cleanVersion = published ?? await prisma.contractTemplateVersion.findFirst({
        where: { templateId: template.id, status: 'PUBLISHED' },
        orderBy: { versionNumber: 'desc' }
      })
      if (!cleanVersion) continue

      const { resolved } = resolvePlaceholders(fieldKeys(cleanVersion.fieldDefinitions), {
        contract: {
          contractNo: contract.contractNo,
          startDate: new Date(contract.startDate),
          endDate: new Date(contract.endDate),
          signedDate: contract.signedDate ? new Date(contract.signedDate) : null,
          baseCompensation: contract.baseCompensation
        },
        employee: (contract.employee ?? undefined) as any,
        templateData: (contract.templateData as Record<string, any> | null) ?? undefined,
        settings: {}
      })

      const cleanSnapshot = {
        ...snapshot,
        templateVersionNumber: cleanVersion.versionNumber,
        contentDefinition: cleanVersion.contentDefinition,
        fieldDefinitions: cleanVersion.fieldDefinitions,
        sanitizedAt: new Date().toISOString(),
        sanitizedReason: 'Perbaikan kontaminasi konten uji pada template legacy'
      }
      snapshotsFixed++
      console.log(`  kontrak ${contract.id} (${contract.status}) → snapshot dibersihkan`)
      if (confirmed) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            templateSnapshot: cleanSnapshot as any,
            resolvedTemplateData: resolved as any,
            templateVersionId: cleanVersion.id
          }
        })
      }
    }
  }

  console.log(`\nRingkasan: overrides diperbaiki=${templateFixes} versi diterbitkan ulang=${republished} snapshot dibersihkan=${snapshotsFixed}`)
  if (!confirmed) console.log('MODE DRY-RUN: tidak ada perubahan ditulis. Tambahkan --confirm untuk eksekusi.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
