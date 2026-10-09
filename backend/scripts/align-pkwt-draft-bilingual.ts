/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Selaraskan struktur ID↔EN pada DRAFT PKWT yang sudah diketik manual di editor
 * template.
 *
 * Kenapa perlu skrip: `contentDefinition` sebuah VERSI template tersimpan di DB,
 * bukan dibaca dari kode. Memperbaiki seed/definisi di kode TIDAK mengubah versi
 * draft yang sudah ada, jadi draft yang sudah diketik harus ditambal langsung
 * pada baris versinya.
 *
 * Tiga operasi, semuanya idempoten:
 *   1. Kolom ID — baris "Jenis Kelamin" diberi `{{employee.gender}}`.
 *   2. Kolom EN — blok identitas PIHAK KEDUA yang belum ada DITAMBAHKAN, memuat
 *      baris "Gender : {{employee.gender}}". Tanpa ini placeholder hanya
 *      tercetak di kolom kiri, sebab draft mengisi kolom ID lebih dulu.
 *   3. Kolom ID — blok paragraf yang MENDUPLIKASI teks blok `opening` dibuang.
 *
 * Mengapa nomor 3 menentukan: engine memasangkan baris ID/EN menurut NOMOR URUT
 * BLOK (`buildPkwtRowsFromStructuredParagraphs`). Satu blok ID berlebih membuat
 * setiap pasangan baris sesudahnya bergeser satu — judul pasal ID duduk di
 * sebelah redaksi EN yang bukan pasangannya. Duplikat itu tidak ada di master.
 *
 * Redaksi EN diambil dari master `docs/sample-legal-doc/pdf/PKWT DRIVER 2026.pdf`
 * (halaman 1, kolom kanan), dengan koreksi yang disengaja supaya kolom Inggris
 * bersih dari kata Indonesia:
 *   - master menulis label `N a m a` → di sini `Name`;
 *   - master mencetak bulan Indonesia (`20 Mei 1980`) → di sini lewat
 *     `displayValueEn` resolver (`2 July 1996`).
 *
 * Label nilainya sendiri TIDAK di-hardcode di sini: resolver yang menerjemahkan
 * `MALE` → "Laki-laki" (ID) / "Male" (EN). Lihat `genderLabel` di
 * `src/contract-templates/template-value-resolver.helpers.ts`.
 *
 * Default DRY-RUN. Pemakaian:
 *   npx ts-node scripts/align-pkwt-draft-bilingual.ts                     (dry-run)
 *   npx ts-node scripts/align-pkwt-draft-bilingual.ts --confirm
 *   npx ts-node scripts/align-pkwt-draft-bilingual.ts --confirm --version=123
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { validateContentDefinition } from '../src/contract-templates/template-schema.validator'

/** Id versi draft yang ditambal. Bisa ditimpa lewat argumen `--version=<id>`. */
const DEFAULT_VERSION_ID = 100

/** Label baris gender per bahasa, sesuai master `PKWT DRIVER 2026.pdf`. */
const GENDER_ROW_LABELS: Record<string, RegExp> = {
  id: /^\s*Jenis Kelamin\s*:/m,
  en: /^\s*Gender\s*:/m,
}

const PLACEHOLDER = '{{employee.gender}}'

/**
 * Blok identitas PIHAK KEDUA kolom INGGRIS, disisipkan tepat setelah blok
 * `opening`. Strukturnya sejajar dengan dua blok paragraf identitas kolom ID
 * (perusahaan lalu karyawan) supaya baris ID/EN bertemu pada baris yang sama:
 * engine memasangkan kolom per nomor urut blok, bukan per indeks baris.
 */
const EN_IDENTITY_BLOCKS: any[] = [
  {
    id: 'identity-company',
    type: 'paragraph',
    text: [
      'I.\tKoperasi Karyawan PT. Sankyu Indonesia International - Unit Jakarta In Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav. 20 Cikarang Pusat Bekasi, represented by HARI SUHONO',
      '',
      'Hereinafter refer to Company',
    ].join('\n'),
  },
  {
    id: 'identity-employee',
    type: 'paragraph',
    text: [
      'II.\tName          :  {{employee.fullName}}',
      'Birth date          :  {{employee.birthPlace}},  {{employee.birthDate}}',
      `Gender : ${PLACEHOLDER}`,
    ].join('\n'),
  },
]

function parseArgs(argv: string[]) {
  const versionArg = argv.find(a => a.startsWith('--version='))
  return {
    confirm: argv.includes('--confirm'),
    versionId: versionArg ? Number(versionArg.split('=')[1]) : DEFAULT_VERSION_ID,
  }
}

/**
 * Tambahkan placeholder ke baris label gender bila belum ada.
 * Mengembalikan teks baru, atau `null` bila tidak ada perubahan.
 */
export function patchGenderRow(text: string, labelPattern: RegExp): string | null {
  if (typeof text !== 'string' || text.length === 0) return null
  const lines = text.split('\n')
  let changed = false

  const patched = lines.map(line => {
    if (!labelPattern.test(line)) return line
    if (line.includes(PLACEHOLDER)) return line
    // Buang spasi di ujung baris dulu supaya sisa ketikan editor tidak menumpuk.
    changed = true
    return `${line.replace(/\s+$/, '')} ${PLACEHOLDER}`
  })

  return changed ? patched.join('\n') : null
}

/** Apakah kolom sudah punya blok identitas karyawan (deteksi id ATAU isi). */
function hasEmployeeIdentity(blocks: any[]): boolean {
  return blocks.some(b =>
    b?.id === 'identity-employee'
    || (typeof b?.text === 'string' && b.text.includes('{{employee.fullName}}') && b.text.includes('{{employee.gender}}')),
  )
}

/**
 * Buang blok paragraf yang MENDUPLIKASI teks blok `opening`.
 *
 * Sengaja dipersempit ke teks `opening` saja — bukan "semua blok yang identik" —
 * supaya tidak ada konten legal lain yang ikut terhapus. Duplikat seperti ini
 * lahir dari editor (blok ter-paste dua kali) dan tidak ada di master.
 *
 * @returns daftar blok yang dibuang (untuk pelaporan), tanpa mengubah masukan.
 */
export function findDuplicateOpeningBlocks(blocks: any[]): any[] {
  const opening = blocks.find(b => b?.id === 'opening' && typeof b?.text === 'string')
  if (!opening) return []

  const text = opening.text.trim()
  if (text.length === 0) return []

  return blocks.filter(b =>
    b !== opening
    && b?.type === 'paragraph'
    && typeof b?.text === 'string'
    && b.text.trim() === text,
  )
}

async function main() {
  const { confirm, versionId } = parseArgs(process.argv.slice(2))

  config({ path: resolve(__dirname, '../.env') })
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)

  try {
    const version = await prisma.contractTemplateVersion.findUnique({
      where: { id: versionId },
      include: { template: { select: { family: true, code: true } } },
    })
    if (!version) throw new Error(`Versi template id=${versionId} tidak ditemukan`)

    const content = structuredClone(version.contentDefinition) as any
    const languages = content?.languages ?? {}
    let changes = 0

    // ── 1. Kolom ID: baris gender diberi placeholder ──
    for (const block of (languages.id ?? []) as any[]) {
      if (block?.type !== 'paragraph' || typeof block.text !== 'string') continue
      if (!GENDER_ROW_LABELS.id.test(block.text)) continue
      const next = patchGenderRow(block.text, GENDER_ROW_LABELS.id)
      if (next == null) {
        console.log(`[id] blok ${block.id}: sudah memuat ${PLACEHOLDER}, dilewati`)
        continue
      }
      console.log(`[id] blok ${block.id}: menambah ${PLACEHOLDER}`)
      if (confirm) block.text = next
      changes += 1
    }

    // ── 2. Kolom EN: sisipkan blok identitas yang belum ada ──
    const enBlocks: any[] = Array.isArray(languages.en) ? languages.en : []
    if (hasEmployeeIdentity(enBlocks)) {
      console.log('[en] blok identitas karyawan sudah ada, dilewati')
    } else {
      const anchor = enBlocks.findIndex(b => b?.id === 'opening')
      const insertAt = anchor >= 0 ? anchor + 1 : 0
      console.log(`[en] menyisipkan ${EN_IDENTITY_BLOCKS.length} blok identitas pada indeks ${insertAt} (setelah blok "${enBlocks[anchor]?.id ?? '-'}")`)
      for (const block of EN_IDENTITY_BLOCKS) {
        console.log(`     + ${block.id}: ${JSON.stringify(block.text)}`)
      }
      if (confirm) enBlocks.splice(insertAt, 0, ...structuredClone(EN_IDENTITY_BLOCKS))
      languages.en = enBlocks
      changes += EN_IDENTITY_BLOCKS.length
    }

    // ── 3. Kolom ID: buang blok yang menduplikasi teks `opening` ──
    const idBlocks: any[] = Array.isArray(languages.id) ? languages.id : []
    const duplicates = findDuplicateOpeningBlocks(idBlocks)
    if (duplicates.length === 0) {
      console.log('[id] tidak ada blok yang menduplikasi `opening`')
    } else {
      for (const block of duplicates) {
        console.log(`[id] membuang blok duplikat ${block.id}: ${JSON.stringify(block.text.slice(0, 70))}…`)
      }
      if (confirm) {
        languages.id = idBlocks.filter(b => !duplicates.includes(b))
      }
      changes += duplicates.length
    }

    if (changes === 0) {
      console.log('\nTidak ada perubahan. Tidak ada yang ditulis.')
      return
    }

    if (!confirm) {
      console.log(`\nDRY-RUN: ${changes} perubahan akan ditulis. Jalankan ulang dengan --confirm untuk menerapkan.`)
      return
    }

    // Validasi memakai pintu yang sama dengan publish, supaya versi tersimpan
    // tidak pernah berada dalam keadaan yang akan ditolak `publish()`.
    const catalog = await prisma.templateFieldDefinition.findMany({ where: { isActive: true }, select: { key: true } })
    const family = (version.template?.family === 'PKWT' ? 'PKWT' : 'MITRA') as 'PKWT' | 'MITRA'
    validateContentDefinition(content, catalog.map(f => f.key), family)

    await prisma.contractTemplateVersion.update({
      where: { id: versionId },
      data: { contentDefinition: content as any },
    })
    console.log(`\nSelesai: ${changes} perubahan pada versi ${versionId} (template ${version.template?.code ?? '-'}, family ${family}).`)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
