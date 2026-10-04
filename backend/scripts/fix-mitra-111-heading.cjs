/**
 * Perbaikan data: Judul Pasal blok 10 template MITRA "111" (id=18600).
 *
 * MASALAH
 * -------
 * Blok 10 versi DRAFT menyimpan heading dengan SPASI, bukan newline:
 *     "PASAL 1 RUANG LINGKUP"   (1 baris)
 * sementara blok pasal lain memakai newline:
 *     "PASAL 2\nJANGKA WAKTU PERJANJIAN"   (2 baris)
 * Akibatnya di PDF judul blok 10 menyatu dalam satu baris.
 *
 * Penyebabnya: editor memakai `UInput` (satu baris) sehingga Enter tidak bisa
 * membuat baris baru. UI sudah diperbaiki ke `UTextarea`; script ini
 * memperbaiki DATANYA.
 *
 * CAKUPAN
 * -------
 * HANYA versi DRAFT (id=90). Versi PUBLISHED (id=87) dan ARCHIVED (id=86)
 * sengaja TIDAK diubah karena bersifat immutable.
 *
 * PEMAKAIAN
 * ---------
 *   node --env-file=.env scripts/fix-mitra-111-heading.cjs           # dry-run
 *   node --env-file=.env scripts/fix-mitra-111-heading.cjs --apply   # tulis
 *
 * Aman dijalankan berulang: blok yang heading-nya sudah benar dilewati.
 */
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

// Ikuti pola `src/prisma/prisma.service.ts` (Prisma 7 memakai adapter pg).
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const APPLY = process.argv.includes('--apply')
const TEMPLATE_ID = 18600
const DRAFT_VERSION_ID = 90
/** Index array blok 10 (1-based 10 -> index 9) pada versi DRAFT. */
const TARGET_INDEX = 9
/** Judul blok 10 seharusnya 2 baris seperti pasal lain. */
const NEW_HEADING = 'PASAL 1\nRUANG LINGKUP'

async function main() {
  const version = await prisma.contractTemplateVersion.findUnique({
    where: { id: DRAFT_VERSION_ID },
    select: { id: true, templateId: true, versionNumber: true, status: true, contentDefinition: true },
  })

  if (!version) throw new Error(`Versi ${DRAFT_VERSION_ID} tidak ditemukan.`)
  if (version.templateId !== TEMPLATE_ID) {
    throw new Error(`Versi ${DRAFT_VERSION_ID} bukan milik template ${TEMPLATE_ID} (templateId=${version.templateId}).`)
  }
  if (String(version.status).toUpperCase() !== 'DRAFT') {
    throw new Error(`Versi ${DRAFT_VERSION_ID} berstatus ${version.status}, bukan DRAFT. Dibatalkan demi keamanan.`)
  }

  console.log(`Template ${version.templateId} | versi ${version.versionNumber} (id=${version.id}, ${version.status})`)
  console.log(`Mode: ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}\n`)

  const def = version.contentDefinition
  const blocks = def?.languages?.id
  if (!Array.isArray(blocks)) throw new Error('contentDefinition.languages.id bukan array.')

  const block = blocks[TARGET_INDEX]
  if (!block) throw new Error(`Blok index ${TARGET_INDEX} tidak ada.`)
  if (block.type !== 'article') throw new Error(`Blok index ${TARGET_INDEX} bertipe "${block.type}", bukan "article".`)

  const before = String(block.heading ?? '')
  console.log('Blok 10 sebelum :', JSON.stringify(before))

  if (before === NEW_HEADING) {
    console.log('Sudah benar (2 baris). Tidak ada yang diubah.')
    return
  }
  // Hanya perbaiki pola "PASAL 1 RUANG LINGKUP" -> "PASAL 1\nRUANG LINGKUP".
  // Jangan sentuh heading yang sudah multi-baris (mungkin sudah disunting manual).
  if (before.includes('\n')) {
    console.log('Heading sudah multi-baris — dilewati agar tidak menimpa suntingan manual.')
    return
  }
  if (before.trim() !== 'PASAL 1 RUANG LINGKUP') {
    console.log(`Heading tidak sesuai pola yang diharapkan. Dibatalkan.`)
    return
  }

  block.heading = NEW_HEADING
  console.log('Blok 10 sesudah :', JSON.stringify(block.heading))

  if (!APPLY) {
    console.log('\nDRY-RUN selesai. Jalankan ulang dengan --apply untuk menyimpan.')
    return
  }

  // `contentDefinition` bertipe Json — tulis ulang objek penuh agar perubahan
  // pada `blocks` ikut tersimpan.
  await prisma.contractTemplateVersion.update({
    where: { id: DRAFT_VERSION_ID },
    data: { contentDefinition: def },
  })
  console.log('\nTersimpan. Verifikasi dengan membaca ulang...')

  const check = await prisma.contractTemplateVersion.findUnique({
    where: { id: DRAFT_VERSION_ID },
    select: { contentDefinition: true },
  })
  const saved = check?.contentDefinition?.languages?.id?.[TARGET_INDEX]?.heading
  console.log('Terverifikasi    :', JSON.stringify(saved))
  console.log(saved === NEW_HEADING ? 'OK — heading kini 2 baris.' : 'GAGAL — nilai tidak sesuai.')
}

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
