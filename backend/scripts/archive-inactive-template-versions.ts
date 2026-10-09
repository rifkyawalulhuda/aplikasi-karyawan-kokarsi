/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Arsipkan versi PUBLISHED milik template yang sudah dinonaktifkan.
 *
 * Latar: `bootstrapVersions()` versi awal tidak menyaring `isActive`, sehingga
 * template data uji yang dinonaktifkan tetap mendapat versi PUBLISHED. Versi
 * tersebut tidak dihapus (tetap bisa diaudit), hanya diarsipkan.
 *
 * Idempoten. Tanpa `--confirm` hanya menampilkan rencana.
 */
import { config } from 'dotenv'
import { resolve } from 'path'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
const confirmed = process.argv.includes('--confirm')

async function main() {
  const inactive = await prisma.contractTemplate.findMany({
    where: { isActive: false },
    include: { versions: { orderBy: { versionNumber: 'asc' } } }
  })

  let archived = 0
  for (const template of inactive) {
    const published = template.versions.filter(v => v.status === 'PUBLISHED')
    if (published.length === 0) continue

    const contracts = await prisma.contract.count({
      where: { templateVersionId: { in: published.map(v => v.id) } }
    })
    console.log(`[template ${template.id}] ${template.name} — versi PUBLISHED: `
      + published.map(v => `v${v.versionNumber}`).join(', ')
      + ` | kontrak tertaut: ${contracts}`)
    if (contracts > 0) {
      console.log('  DILEWATI: masih ada kontrak yang menunjuk versi ini.')
      continue
    }
    archived += published.length
    if (confirmed) {
      await prisma.contractTemplateVersion.updateMany({
        where: { id: { in: published.map(v => v.id) } },
        data: { status: 'ARCHIVED' }
      })
    }
  }

  console.log(`\nRingkasan: versi diarsipkan=${archived}`)
  if (!confirmed) console.log('MODE DRY-RUN: tidak ada perubahan ditulis. Tambahkan --confirm untuk eksekusi.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
