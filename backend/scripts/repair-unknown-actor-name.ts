/**
 * Bersihkan nama pelaku versi template yang tercatat "unknown".
 *
 * Konteks: `contract-template-versions.controller.ts` dulu memakai
 * `req.user?.username`, padahal JWT tidak membawa `username` (identitasnya di
 * `fullName`/`employeeNo`). Akibatnya setiap simpan/terbit/rollback/hapus versi
 * tercatat "unknown" dan kartu template menampilkan
 * "Diterbitkan 20 Okt 2026 oleh unknown".
 *
 * Nama pelaku asli untuk baris lama TIDAK bisa dipulihkan: activity log untuk
 * kejadian yang sama juga tercatat "unknown", dan tidak ada sumber lain yang
 * menyimpan identitasnya. Jadi baris lama dikosongkan (NULL), bukan diisi nama
 * tebakan — kartu lalu hanya menampilkan tanggal terbit, tanpa klaim siapa
 * penerbitnya. Jejak audit yang jujur lebih baik daripada nama karangan.
 *
 * Penggunaan:
 *   npm run contract-templates:repair-actor --                 (dry-run)
 *   npm run contract-templates:repair-actor -- --confirm       (menulis)
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

const confirmed = process.argv.includes('--confirm')

/** Placeholder yang pernah tertulis, bukan nama orang. */
const PLACEHOLDERS = ['unknown']

async function main() {
  const versions = await prisma.contractTemplateVersion.findMany({
    where: {
      OR: [
        { createdByName: { in: PLACEHOLDERS } },
        { publishedByName: { in: PLACEHOLDERS } },
      ],
    },
    select: {
      id: true,
      templateId: true,
      versionNumber: true,
      status: true,
      createdByName: true,
      publishedByName: true,
    },
    orderBy: { id: 'asc' },
  })

  console.log(`Versi dengan nama placeholder: ${versions.length}`)
  console.table(versions)

  if (!versions.length) {
    console.log('Tidak ada yang perlu diperbaiki.')
    await prisma.$disconnect()
    return
  }

  if (!confirmed) {
    console.log('\nDry-run. Tambahkan --confirm untuk menulis.')
    await prisma.$disconnect()
    return
  }

  const result = await prisma.$transaction([
    prisma.contractTemplateVersion.updateMany({
      where: { createdByName: { in: PLACEHOLDERS } },
      data: { createdByName: null },
    }),
    prisma.contractTemplateVersion.updateMany({
      where: { publishedByName: { in: PLACEHOLDERS } },
      data: { publishedByName: null },
    }),
  ])
  console.log(`\nSelesai: createdByName ${result[0].count} baris, publishedByName ${result[1].count} baris.`)
  await prisma.$disconnect()
}

main()
