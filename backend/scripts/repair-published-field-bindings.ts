/**
 * Perbaikan data: selaraskan `fieldDefinitions` versi PUBLISHED dengan binding
 * katalog template (`contract_template_fields`).
 *
 * Konteks: `publish()` tidak pernah menerapkan binding katalog ke
 * `fieldDefinitions`, dan `prisma/seed.ts` lama membuat versi PUBLISHED
 * **sebelum** binding `ktp_issued_date` ditulis. Akibatnya versi PUBLISHED yang
 * sudah ada tidak memuat field dinamis sama sekali, sehingga
 * `GET /contract-templates/:id/fields` mengembalikan daftar kosong dan form
 * kontrak tidak menampilkan "Tanggal Terbit KTP Mitra".
 *
 * Skrip ini menulis ulang kolom `fieldDefinitions` versi PUBLISHED memakai
 * helper yang sama dengan `createDraft`/`updateDraft`
 * (`applyTemplateBindings`), sehingga hasilnya identik dengan yang akan
 * dihasilkan jalur normal. `contentDefinition` TIDAK disentuh.
 *
 * Penggunaan:
 *   npm run contract-templates:repair-field-bindings                      (dry-run, semua template)
 *   npm run contract-templates:repair-field-bindings -- --confirm         (menulis)
 *   npm run contract-templates:repair-field-bindings -- --family=MITRA --confirm
 *
 * Setelah perbaikan, periksa: GET /contract-templates/:id/fields
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)

import {
  applyTemplateBindings,
  normalizeVersionFieldDefinitions,
  extractContractInputFields,
} from '../src/contract-templates/template-field-bindings.helpers'

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}

const familyFilter = arg('family')
const confirmed = process.argv.includes('--confirm')

async function main() {
  const templates = await prisma.contractTemplate.findMany({
    where: familyFilter ? { family: familyFilter as never } : {},
    orderBy: { id: 'asc' },
  })
  console.log(`Template diperiksa: ${templates.length}${familyFilter ? ` (family=${familyFilter})` : ''}\n`)

  let changed = 0
  let skipped = 0
  let missingPublished = 0

  for (const template of templates) {
    const bindings = await prisma.contractTemplateField.findMany({
      where: { templateId: template.id, field: { is: { isActive: true } } },
      include: { field: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const contractInputBindings = bindings.filter(b => b.field?.sourceType === 'CONTRACT_INPUT')

    const published = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: template.id, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })

    if (!published) {
      missingPublished += 1
      console.log(`- ${template.code}: tidak ada versi PUBLISHED — dilewati`)
      continue
    }

    const before = normalizeVersionFieldDefinitions(published.fieldDefinitions)
    const beforeKeys = new Set(before.map(f => f.key))
    // `applyTemplateBindings` menambah field ter-bind yang belum ada dan
    // menyelaraskan flag `required`; salin array agar perbandingan tetap sahih.
    const after = applyTemplateBindings([...before.map(f => ({ ...f }))], bindings)

    const added = after.filter(f => !beforeKeys.has(f.key)).map(f => f.key)
    const requiredChanged = after
      .filter(f => beforeKeys.has(f.key))
      .filter(f => before.find(b => b.key === f.key)?.required !== f.required)
      .map(f => f.key)

    if (added.length === 0 && requiredChanged.length === 0) {
      skipped += 1
      console.log(`- ${template.code}: sudah selaras (v${published.versionNumber}, ${beforeKeys.size} field) — dilewati`)
      continue
    }

    changed += 1
    console.log(`- ${template.code}: v${published.versionNumber} id=${published.id} family=${template.family}`)
    console.log(`    binding CONTRACT_INPUT : ${contractInputBindings.map(b => b.field.key).join(', ') || '(tidak ada)'}`)
    console.log(`    field ditambahkan      : ${added.join(', ') || '(tidak ada)'}`)
    console.log(`    required berubah       : ${requiredChanged.join(', ') || '(tidak ada)'}`)
    console.log(`    form akan menampilkan  : ${extractContractInputFields(after).map(f => `${f.key}${f.required ? '*' : ''}`).join(', ') || '(kosong)'}`)

    if (!confirmed) continue

    await prisma.contractTemplateVersion.update({
      where: { id: published.id },
      data: { fieldDefinitions: after as never },
    })
    console.log('    → ditulis')
  }

  console.log(`\nRingkasan: ${changed} perlu diperbaiki, ${skipped} sudah selaras, ${missingPublished} tanpa versi PUBLISHED.`)
  if (!confirmed) {
    console.log('\nDRY-RUN. Tambahkan --confirm untuk menulis perubahan.')
    return
  }
  console.log('\nSELESAI. `contentDefinition` tidak diubah — hanya `fieldDefinitions` yang diselaraskan.')
  console.log('Verifikasi: GET /contract-templates/:id/fields harus memuat field di atas.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
