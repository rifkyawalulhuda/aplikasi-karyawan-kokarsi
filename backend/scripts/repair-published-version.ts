/**
 * Perbaikan versi PUBLISHED yang rusak untuk satu template.
 *
 * Konteks: pada template id=5 (PKWT_DRIVER) sebuah DRAFT ("TEST AJA WAKTU
 * TERTENTU") dipublikasikan sehingga v1 yang kanonik ter-archive. Skrip ini
 * mengembalikan versi target sebagai PUBLISHED **tanpa** melewati
 * createDraft/publish, karena keduanya membaca `lastVersion` PUBLISHED yang
 * sudah rusak dan akan mempertahankan konten yang salah.
 *
 * Penggunaan:
 *   npm run contract-templates:repair-version -- --template=5 --version=1           (dry-run)
 *   npm run contract-templates:repair-version -- --template=5 --version=1 --confirm (menulis)
 *
 * Setelah perbaikan, jalankan rollout ulang agar kontrak terkait dapat snapshot
 * yang benar: npm run contract-templates:rollout
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

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}

const templateId = Number(arg('template'))
const versionNumber = Number(arg('version'))
const confirmed = process.argv.includes('--confirm')

if (!Number.isInteger(templateId) || templateId <= 0) throw new Error('Wajib: --template=<id>')
if (!Number.isInteger(versionNumber) || versionNumber <= 0) throw new Error('Wajib: --version=<versionNumber>')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function titleOf(contentDefinition: any): string {
  const arr = contentDefinition?.languages?.id
  const first = Array.isArray(arr) ? arr[0] : null
  return String(first?.text ?? first?.heading ?? '(n/a)')
}

async function main() {
  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
    include: { versions: { orderBy: { versionNumber: 'asc' } } }
  })
  if (!template) throw new Error(`Template id=${templateId} tidak ditemukan`)

  const target = template.versions.find(v => v.versionNumber === versionNumber)
  if (!target) throw new Error(`Versi ${versionNumber} tidak ditemukan pada template ${templateId}`)

  const currentPublished = template.versions.find(v => v.status === 'PUBLISHED')
  const affected = await prisma.contract.findMany({
    where: { templateId },
    select: { id: true, status: true, templateVersionId: true }
  })

  console.log('Template      :', `${template.code} (${template.name})`)
  console.log('PUBLISHED kini:', currentPublished ? `v${currentPublished.versionNumber} id=${currentPublished.id} judul=${JSON.stringify(titleOf(currentPublished.contentDefinition))}` : '(tidak ada)')
  console.log('Target        :', `v${target.versionNumber} id=${target.id} status=${target.status} judul=${JSON.stringify(titleOf(target.contentDefinition))}`)
  console.log('Kontrak terkait:', affected.length, JSON.stringify(affected))

  if (target.status === 'PUBLISHED') {
    console.log('\nTidak ada perubahan: versi target sudah PUBLISHED.')
    return
  }

  if (!confirmed) {
    console.log('\nDRY-RUN. Tambahkan --confirm untuk menulis perubahan.')
    return
  }

  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    await tx.contractTemplateVersion.updateMany({
      where: { templateId, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' }
    })
    return tx.contractTemplateVersion.update({
      where: { id: target.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        publishedByName: 'Repair (rollback v1 kanonik)',
        changeSummary: `Dipulihkan ke v${target.versionNumber}: versi salah publish dikembalikan`
      }
    })
  })

  console.log('\nSELESAI. PUBLISHED sekarang: v' + result.versionNumber, 'id=' + result.id)
  console.log('Versi rusak di-archive, bukan dihapus — dapat diperiksa ulang kapan saja.')
  console.log('\nLangkah lanjut: npm run contract-templates:rollout   (dry-run dulu)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
