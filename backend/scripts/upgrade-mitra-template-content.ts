/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Upgrade konten template MITRA (Perjanjian Kemitraan) ke struktur master.
 *
 * Masalah: versi PUBLISHED yang sudah ada di database menyimpan contentDefinition
 * LAMA — memuat section ringkasan ciptaan kode ("Para Pihak", "Ruang Lingkup dan
 * Posisi", "Jangka Waktu") dan tanpa pembukaan/para pihak sesuai master.
 * Karena versi bersifat immutable, memperbaiki definisi di kode TIDAK mengubah
 * versi yang sudah terbit. Akibatnya PDF kontrak lama tetap memakai konten lama.
 *
 * Solusi: untuk setiap template MITRA yang aktif, buat versi BARU
 * (versionNumber = max+1) berisi contentDefinition dari definisi kode terkini,
 * lalu publish. Versi lama di-ARCHIVE (tidak dihapus) agar tetap dapat diaudit.
 * Setelah itu, snapshot kontrak yang memakai template tsb dibangun ulang agar
 * memakai konten baru (opsional, lihat --resnapshot).
 *
 * Idempoten & aman:
 *   - Template tanpa definisi kode dilewati.
 *   - Template yang versi terbitnya SUDAH dalam struktur master dilewati.
 *   - Dijalankan default sebagai DRY-RUN.
 *
 * Pemakaian:
 *   npx ts-node scripts/upgrade-mitra-template-content.ts                      (dry-run)
 *   npx ts-node scripts/upgrade-mitra-template-content.ts --confirm            (publish versi baru)
 *   npx ts-node scripts/upgrade-mitra-template-content.ts --confirm --resnapshot
 *
 * Secara default hanya template AKTIF yang diproses. Template MITRA nonaktif
 * yang masih menyimpan struktur lama (mis. TEST001) dapat dibersihkan dengan
 * menambahkan --include-inactive — versi lama di-ARCHIVE, versi baru diterbitkan,
 * sehingga saat template diaktifkan kembali kontennya sudah benar.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../src/contracts/contract-document-definitions'
import {
  definitionToContentDefinition,
  definitionToFieldDefinitions,
} from '../src/contract-templates/default-template-definition'
import { applyTemplateBindings } from '../src/contract-templates/template-field-bindings.helpers'
import { resolvePlaceholders } from '../src/contract-templates/template-value-resolver.helpers'
import {
  collectAllPlaceholders,
  validateContentDefinition,
} from '../src/contract-templates/template-schema.validator'

/**
 * Prisma dibuat malas (lazy) agar modul ini dapat di-import unit test tanpa
 * membuka koneksi database.
 */
let _prisma: PrismaClient | null = null
function getPrisma(): PrismaClient {
  if (_prisma) return _prisma
  config({ path: resolve(__dirname, '../.env') })
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')
  _prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
  return _prisma
}

/** Section ringkasan ciptaan kode lama yang TIDAK boleh ada lagi. */
const LEGACY_SECTIONS = new Set(['Para Pihak', 'Ruang Lingkup dan Posisi', 'Jangka Waktu'])

/**
 * Token legacy gaya lama yang TIDAK boleh tersisa di contentDefinition.
 * Bila ada, artinya versi terbit masih memakai teks yang belum diganti
 * placeholder {{...}} — kontennya akan rusak saat dirender (menjadi titik-titik).
 */
const LEGACY_TOKENS = [
  '__MITRA_TERM__', '__MITRA_IMBALAN__', '__MITRA_ADDRESS__',
  '__MITRA_PHONE__', '__MITRA_EMAIL__', '__ROLE_LABEL__',
  '__TERM_DATE__', '__WAGE_AMOUNT__', '__PARTY_II_BLOCK__',
]

function headingsOf(contentDefinition: any): string[] {
  const blocks = contentDefinition?.languages?.id
  if (!Array.isArray(blocks)) return []
  return blocks
    .filter((b: any) => b?.type === 'article')
    .map((b: any) => String(b?.heading ?? '').replace(/\n/g, ' ').trim())
}

/** Token legacy yang masih tersisa di contentDefinition. */
export function legacyTokensOf(contentDefinition: any): string[] {
  const txt = JSON.stringify(contentDefinition ?? {})
  return LEGACY_TOKENS.filter(t => txt.includes(t))
}

/** Pola teks uji / placeholder yang tidak boleh ikut terbit. */
const TEST_RESIDUE = [
  /lorem ipsum/i,
  /dolor sit amet/i,
  /consectetur adipisc/i,
  /\bHAHAHA\b/i,
  /Pengusaha11/i,
  /\basdf\b/i,
]

/**
 * Deteksi `contentOverrides` (mekanisme legacy) yang terkontaminasi token
 * `__...__` atau teks uji. Override seperti ini harus DIABAIKAN agar tidak
 * menimpa konten template yang sudah bersih.
 */
export function isContaminatedOverrides(overrides: unknown): boolean {
  if (!overrides || typeof overrides !== 'object') return false
  const txt = JSON.stringify(overrides)
  if (LEGACY_TOKENS.some(t => txt.includes(t))) return true
  return TEST_RESIDUE.some(re => re.test(txt))
}

/**
 * Versi dianggap sudah mengikuti struktur master bila:
 *   1. tidak memuat section ringkasan ciptaan kode lama, DAN
 *   2. tidak memuat token legacy `__...__` yang akan rusak saat dirender.
 */
export function isMasterStructured(contentDefinition: any): boolean {
  const heads = headingsOf(contentDefinition)
  if (heads.length === 0) return false
  if (legacyTokensOf(contentDefinition).length > 0) return false
  return !heads.some(h => LEGACY_SECTIONS.has(h))
}

function fieldKeys(value: any): string[] {
  const defs = Array.isArray(value) ? value : (value?.fields ?? [])
  return defs
    .filter((f: any) => f?.key)
    .map((f: any) =>
      f.sourceType === 'CONTRACT_INPUT'
        ? `custom.${String(f.key).replace(/^custom\./, '')}`
        : String(f.key),
    )
}

async function upgradeTemplates(confirmed: boolean, includeInactive = false) {
  const templates = await getPrisma().contractTemplate.findMany({
    where: includeInactive
      ? { family: 'MITRA' }
      : { family: 'MITRA', isActive: true },
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

    if (published && isMasterStructured(published.contentDefinition)) {
      report.push({
        template: template.code,
        action: 'skip',
        reason: `v${published.versionNumber} sudah berstruktur master`,
      })
      continue
    }

    const legacyTokens = published ? legacyTokensOf(published.contentDefinition) : []
    const legacyHeads = published ? headingsOf(published.contentDefinition) : []
    const staleSections = legacyHeads.filter(h => LEGACY_SECTIONS.has(h))

    // `contentOverrides` adalah mekanisme LEGACY. Bila isinya terkontaminasi
    // (token __...__ atau teks uji Lorem ipsum), JANGAN di-merge — definisi
    // kode yang sudah bersih menjadi sumber kebenaran.
    const overridesContaminated = isContaminatedOverrides(template.contentOverrides)
    const merged = mergeDefinition(definition, overridesContaminated ? null : (template.contentOverrides as any))
    const contentDefinition = definitionToContentDefinition(merged)
    const baseFields = definitionToFieldDefinitions(merged)

    const bindings = await getPrisma().contractTemplateField.findMany({
      where: { templateId: template.id, field: { is: { isActive: true } } },
      include: { field: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const fieldDefinitions = applyTemplateBindings(baseFields, bindings)

    // Jembatan prefix `custom.`: applyTemplateBindings membuang prefix tersebut,
    // sedangkan blok konten menulis {{custom.xxx}}. Samakan dengan perilaku
    // publish()/preview() agar validasi tidak menolak placeholder yang valid.
    const validKeys = new Set(fieldDefinitions.map((f: any) => String(f.key)))
    for (const placeholder of collectAllPlaceholders(contentDefinition)) {
      const referenced = fieldDefinitions.some(
        (f: any) => placeholder === f.key || placeholder === `custom.${f.key}`,
      )
      if (referenced) validKeys.add(placeholder)
    }

    validateContentDefinition(contentDefinition, [...validKeys], template.family as any)

    const latest = await getPrisma().contractTemplateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { versionNumber: 'desc' },
    })
    const nextVersion = (latest?.versionNumber ?? 0) + 1

    report.push({
      template: template.code,
      active: template.isActive,
      action: confirmed ? 'publish' : 'will-publish',
      from: published
        ? `v${published.versionNumber} (${legacyHeads.length} artikel; ` +
          `${staleSections.length} section lama; ` +
          `${legacyTokens.length} token legacy)`
        : '(belum ada)',
      to: `v${nextVersion}`,
      articles: headingsOf(contentDefinition).length,
      paragraphs: (contentDefinition.languages.id ?? []).filter((b: any) => b.type === 'paragraph').length,
      staleTokens: legacyTokens,
      overridesIgnored: overridesContaminated,
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
          changeSummary: 'Perbaikan struktur Perjanjian Kemitraan sesuai master (pembukaan + para pihak + PASAL 1..15 + penutup)',
          createdByName: 'Migrasi konten MITRA',
          publishedByName: 'Migrasi konten MITRA',
          publishedAt: new Date(),
        },
      })
    })
  }

  return report
}

async function rebuildSnapshots(resnapshot: boolean) {
  if (!resnapshot) return { updated: 0, unresolved: [] as any[] }

  const contracts = await getPrisma().contract.findMany({
    where: { template: { family: 'MITRA' }, templateId: { not: null } },
    include: {
      template: true,
      employee: { include: { jobRole: true, workLocation: true, department: true, taxStatus: true, jobLevel: true } },
    },
  })
  const settingsRows = await getPrisma().appSetting.findMany()
  const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]))

  let updated = 0
  const unresolved: any[] = []

  for (const contract of contracts) {
    if (!contract.templateId || !contract.template) continue
    const version = await getPrisma().contractTemplateVersion.findFirst({
      where: { templateId: contract.templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    if (!version) continue

    const keys = fieldKeys(version.fieldDefinitions)
    const resolved = resolvePlaceholders(keys, {
      contract: {
        contractNo: contract.contractNo,
        startDate: new Date(contract.startDate),
        endDate: new Date(contract.endDate),
        signedDate: contract.signedDate ? new Date(contract.signedDate) : null,
        baseCompensation: contract.baseCompensation,
      },
      employee: contract.employee,
      templateData: (contract.templateData as Record<string, any> | null) ?? undefined,
      settings,
    })
    if (resolved.unknown.length) unresolved.push({ contractId: contract.id, keys: resolved.unknown })

    const snapshot = {
      templateId: contract.templateId,
      templateVersionNumber: version.versionNumber,
      family: contract.template.family,
      contentDefinition: version.contentDefinition,
      fieldDefinitions: version.fieldDefinitions,
      snapshottedAt: new Date().toISOString(),
      migration: 'mitra-content-upgrade',
    }
    await getPrisma().contract.update({
      where: { id: contract.id },
      data: {
        templateVersionId: version.id,
        templateSnapshot: snapshot as any,
        resolvedTemplateData: resolved.resolved as any,
      },
    })
    updated++
  }

  return { updated, unresolved }
}

async function main() {
  const confirmed = process.argv.includes('--confirm')
  const resnapshot = process.argv.includes('--resnapshot')
  const includeInactive = process.argv.includes('--include-inactive')

  const report = await upgradeTemplates(confirmed, includeInactive)
  const snap = await rebuildSnapshots(resnapshot)

  console.log(JSON.stringify({ confirmed, resnapshot, includeInactive, templates: report, snapshots: snap }, null, 2))

  if (report.some(r => r.action === 'publish' || r.action === 'will-publish')) {
    console.log(
      confirmed
        ? '\nSELESAI. Versi lama di-ARCHIVE (tetap dapat diaudit).'
        : '\nDRY-RUN. Tambahkan --confirm untuk menulis perubahan.',
    )
  }
  if (snap.unresolved.length) process.exitCode = 2
}

if (require.main === module) {
  main()
    .catch(e => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(() => getPrisma().$disconnect())
}
