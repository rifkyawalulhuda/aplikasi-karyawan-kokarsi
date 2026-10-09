/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Selaraskan KATALOG field template dengan definisi kode
 * (`SYSTEM_FIELD_SEEDS` + `CONTRACT_INPUT_FIELD_SEEDS`) — termasuk MEMBUAT baris
 * yang belum ada.
 *
 * Kenapa perlu: `TemplateFieldsService.ensureSystemFields()` berjalan otomatis
 * saat backend boot (`onModuleInit`). Field katalog yang BARU ditambahkan di kode
 * (mis. `employee.gender`) tidak ada di database sampai backend dijalankan ulang.
 * Selama itu `validateContentDefinition` menolak versi template yang memakai
 * placeholder tersebut dengan "Placeholder ... tidak terdaftar di katalog field",
 * sehingga publish dan pratinjau ikut gagal.
 *
 * Skrip ini memanggil seed PRODUKSI yang sama, jadi tidak ada logika seed kedua
 * yang bisa menyimpang dari `ensureSystemFields()`.
 *
 * Berbeda dari `sync-field-labels.ts` — yang hanya menimpa label/tipe baris yang
 * SUDAH ada — skrip ini menambahkan baris yang hilang.
 *
 * Idempoten. Jalankan: npx ts-node scripts/sync-system-fields.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// dotenv HARUS dimuat SEBELUM modul PrismaService di-import: modul itu membaca
// `process.env.DATABASE_URL` saat di-load dan membuat koneksi di level modul.
config({ path: resolve(__dirname, '../.env') })

const { TemplateFieldsService } = require('../src/contract-templates/template-fields.service')
const { PrismaService } = require('../src/prisma/prisma.service')

async function main() {
  const prisma = new PrismaService()
  try {
    const before = await prisma.client.templateFieldDefinition.count()
    const { created } = await new TemplateFieldsService(prisma).ensureSystemFields()
    const after = await prisma.client.templateFieldDefinition.count()

    console.log(`Katalog field: ${before} -> ${after} baris (${created} dibuat).`)
    if (created === 0) console.log('Tidak ada field baru; katalog sudah selaras dengan kode.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
