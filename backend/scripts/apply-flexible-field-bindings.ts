/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Terapkan binding field yang fleksibel pada template MITRA:
 *
 *  1. `ktp_issued_date` dijadikan OPSIONAL (`required: false`) — field tetap
 *     tampil di form kontrak, tetapi tidak lagi memblokir submit. Admin dapat
 *     mencentang "Wajib" dari panel Field template bilamana perlu.
 *  2. Selaraskan `fieldDefinitions` versi PUBLISHED dengan binding terkini
 *     (`applyTemplateBindings`), supaya `GET /contract-templates/:id/fields`
 *     dan `TemplateSnapshotService` melihat flag terbaru.
 *
 * `contentDefinition` TIDAK disentuh — hanya metadata field.
 *
 * Idempoten & default DRY-RUN.
 *   npx ts-node scripts/apply-flexible-field-bindings.ts
 *   npx ts-node scripts/apply-flexible-field-bindings.ts --confirm
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan')

import {
  applyTemplateBindings,
  normalizeVersionFieldDefinitions,
  extractContractInputFields,
} from '../src/contract-templates/template-field-bindings.helpers'

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
const CONFIRM = process.argv.includes('--confirm')
const OPTIONAL_KEYS = ['ktp_issued_date']

async function main() {
  const templates = await prisma.contractTemplate.findMany({ orderBy: { id: 'asc' } })
  let bindingsChanged = 0
  let versionsChanged = 0
  let noPublished = 0

  for (const template of templates) {
    const rows = await prisma.contractTemplateField.findMany({
      where: { templateId: template.id },
      include: { field: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const targets = rows.filter(r => OPTIONAL_KEYS.includes(r.field.key) && r.required)

    for (const row of targets) {
      bindingsChanged++
      console.log(`  [binding] ${template.code}: ${row.field.key} required -> false`)
      if (CONFIRM) {
        await prisma.contractTemplateField.update({ where: { id: row.id }, data: { required: false } })
      }
    }

    // Selaraskan versi PUBLISHED agar flag baru terlihat endpoint & snapshot.
    const published = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: template.id, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    if (!published) { noPublished++; continue }

    const current = normalizeVersionFieldDefinitions(published.fieldDefinitions)
    const bindings = await prisma.contractTemplateField.findMany({
      where: { templateId: template.id, field: { is: { isActive: true } } },
      include: { field: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    // Saat dry-run, binding belum ditulis — pakai baris yang sudah dipaksa false
    // agar hasil simulasi sama dengan hasil nyata.
    const effectiveBindings = bindings.map(b =>
      OPTIONAL_KEYS.includes(b.field.key) ? { ...b, required: false } : b)
    const catalogContractInputKeys = await prisma.templateFieldDefinition.findMany({
      where: { isActive: true, sourceType: 'CONTRACT_INPUT' },
      select: { key: true },
    })
    const next = applyTemplateBindings(current, effectiveBindings as any, {
      catalogContractInputKeys: catalogContractInputKeys.map(r => r.key),
    })
    const changed = JSON.stringify(current.map(d => [d.key, d.required])) !== JSON.stringify(next.map(d => [d.key, d.required]))

    if (changed) {
      versionsChanged++
      console.log(`  [version] ${template.code} v${published.versionNumber}`)
      if (CONFIRM) {
        await prisma.contractTemplateVersion.update({
          where: { id: published.id },
          data: { fieldDefinitions: next as any },
        })
      }
    }
  }

  console.log(`\nBinding diubah      : ${bindingsChanged}`)
  console.log(`Versi diselaraskan  : ${versionsChanged}`)
  console.log(`Tanpa versi PUBLISH : ${noPublished}`)
  if (!CONFIRM) {
    console.log('\nDRY-RUN. Tambahkan --confirm untuk menulis.')
    return
  }

  // Ringkasan hasil
  console.log('\n=== HASIL: field dinamis per template (tanda * = wajib) ===')
  for (const template of templates) {
    const published = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: template.id, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    const fields = published ? extractContractInputFields(published.fieldDefinitions) : []
    console.log(`  ${template.code.padEnd(22)} ${fields.map(f => `${f.key}${f.required ? '*' : ''}`).join(', ') || '(kosong)'}`)
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
