/**
 * Backup data versi template kontrak + snapshot kontrak sebelum rollout.
 *
 * Backup LOGIS (JSON), bukan dump biner. Alasannya: `pg_dump` tidak tersedia di
 * environment ini, sedangkan data yang berisiko berubah saat rollout hanya
 * berada di dua tabel + kolom snapshot pada `contracts`, sehingga export JSON
 * cukup untuk rollback penuh dan mudah diaudit.
 *
 * Output: backend/backups/contract-template-versioning-<timestamp>.json
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)

async function main() {
  const [templates, versions, contracts] = await Promise.all([
    prisma.contractTemplate.findMany({ orderBy: { id: 'asc' } }),
    prisma.contractTemplateVersion.findMany({ orderBy: { id: 'asc' } }),
    prisma.contract.findMany({
      select: {
        id: true, status: true, templateId: true, templateVersionId: true,
        templateData: true, templateSnapshot: true, resolvedTemplateData: true,
        updatedAt: true
      },
      orderBy: { id: 'asc' }
    })
  ])

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = resolve(__dirname, '../backups')
  mkdirSync(dir, { recursive: true })
  const file = resolve(dir, `contract-template-versioning-${stamp}.json`)

  writeFileSync(file, JSON.stringify({
    createdAt: new Date().toISOString(),
    databaseHost: databaseUrl.replace(/\/\/[^@]*@/, '//***@'),
    counts: { templates: templates.length, versions: versions.length, contracts: contracts.length },
    templates,
    versions,
    contracts
  }, null, 2))

  console.log('Backup tertulis:', file)
  console.log(`  templates=${templates.length} versions=${versions.length} contracts=${contracts.length}`)
}

async function run() {
  try {
    await main()
  } catch (e) {
    console.error(e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

run()
