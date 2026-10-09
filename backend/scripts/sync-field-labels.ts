/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Selaraskan LABEL + TIPE katalog field dengan definisi kode.
 *
 * Field SYSTEM yang di-seed jalur lama menyimpan label = key mentah
 * (mis. `doc.hariTanggal`), sehingga panel editor template menampilkan key
 * alih-alih nama manusia. Skrip ini menimpa `label` (dan `dataType`) untuk
 * key yang dikenal `SYSTEM_FIELD_SEEDS`, tanpa menyentuh `key`/`sourceType`.
 *
 * Idempoten & default DRY-RUN.
 *   npx ts-node scripts/sync-field-labels.ts            (dry-run)
 *   npx ts-node scripts/sync-field-labels.ts --confirm
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan')

import { SYSTEM_FIELD_SEEDS, CONTRACT_INPUT_FIELD_SEEDS } from '../src/contract-templates/template-field-seeds'

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
const CONFIRM = process.argv.includes('--confirm')

async function main() {
  const seeds = [...SYSTEM_FIELD_SEEDS, ...CONTRACT_INPUT_FIELD_SEEDS]
  let changed = 0
  let ok = 0
  for (const seed of seeds) {
    const row = await prisma.templateFieldDefinition.findUnique({ where: { key: seed.key } })
    if (!row) { console.log(`  (lewat) ${seed.key} — belum ada di katalog`); continue }
    const labelDiff = row.label !== seed.label
    const typeDiff = row.dataType !== seed.dataType
    if (!labelDiff && !typeDiff) { ok++; continue }
    changed++
    console.log(`  ~ ${seed.key}`)
    if (labelDiff) console.log(`      label: "${row.label}" -> "${seed.label}"`)
    if (typeDiff) console.log(`      tipe : ${row.dataType} -> ${seed.dataType}`)
    if (CONFIRM) {
      await prisma.templateFieldDefinition.update({
        where: { key: seed.key },
        data: { label: seed.label, dataType: seed.dataType as any },
      })
    }
  }
  console.log(`\n${changed} perlu diselaraskan, ${ok} sudah benar.`)
  console.log(CONFIRM ? 'SELESAI.' : 'DRY-RUN. Tambahkan --confirm untuk menulis.')
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
