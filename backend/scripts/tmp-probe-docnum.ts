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

async function main() {
  const rows = await prisma.vendorContract.findMany({
    where: { OR: [{ documentName: { contains: 'Layanan', mode: 'insensitive' } }, { documentNumber: { contains: '#' } }] },
    select: { id: true, documentName: true, documentNumber: true },
    take: 15,
  })
  console.log('--- vendorContract ---')
  console.table(rows.map(r => ({ id: r.id, doc: r.documentName, no: r.documentNumber, len: r.documentNumber?.length })))
  await prisma.$disconnect()
}

main()
