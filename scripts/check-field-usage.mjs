/**
 * Verifikasi `app/utils/field-usage.ts` (pencarian pemakaian Field Dinamis).
 *
 * Mengapa harness ini ada: `app/` tidak punya infrastruktur tes (tanpa
 * Vitest/Jest, tanpa spec), sehingga satu-satunya cara membuktikan logika
 * pemindaian benar tanpa merender komponen adalah menjalankannya langsung
 * dengan Node. Pola ini meniru `scripts/check-block-picker-coverage.mjs`.
 *
 * Cara pakai:
 *   node scripts/check-field-usage.mjs
 *
 * Keluar dengan kode 1 bila ada assertion yang gagal.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../app/utils/field-usage.ts'), 'utf8')

// Modul ini ESM TypeScript murni tanpa dependensi Nuxt, jadi cukup
// ditranspilasi dengan `typescript` (sudah devDependency root — tidak ada
// toolchain baru) lalu dievaluasi dari data URL.
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText

const module_ = await import(`data:text/javascript,${encodeURIComponent(js)}`)

const { scanFieldUsage, normalizeFieldKey, isDynamicField, locationLabelFor, uniqueBlockLabels } = module_

let failures = 0
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL ${name}\n       harap: ${e}\n       dapat: ${a}`)
  }
}

// ── Blok contoh menyerupai contentDefinition MITRA ──────────────────────────
const blocks = [
  {
    id: 'title-1',
    type: 'title',
    text: 'PERJANJIAN KERJA SAMA'
  },
  {
    id: 'article-2',
    type: 'article',
    heading: 'Pasal 1 — Ketentuan Umum {{custom.ktp_issued_date}}',
    paragraphs: [
      'Pihak Pertama {{employee.fullName}} beralamat di {{employee.address}}.',
      'Tanggal terbit KTP: {{custom.ktp_issued_date}}.'
    ]
  },
  {
    id: 'list-3',
    type: 'list',
    items: ['Nama: {{employee.fullName}}', 'Tidak ada field di sini', 'KTP: {{custom.ktp_issued_date}}']
  },
  {
    id: 'table-4',
    type: 'table',
    columns: [{ key: 'label', label: 'Komponen' }, { key: 'value', label: 'Nilai' }],
    rows: [
      { label: 'Upah', value: '{{contract.baseCompensation}}' },
      { label: 'Nama', value: '{{employee.fullName}}' }
    ]
  },
  {
    id: 'paragraph-5',
    type: 'paragraph',
    text: 'Placeholder rusak: {{ktp_issued_date.x.y}} dan tanpa prefix {{ktp_issued_date}}.'
  },
  { id: 'pageBreak-6', type: 'pageBreak' }
]

console.log('field-usage: pemindaian dasar')
const scan = scanFieldUsage(blocks)

check('jumlah kemunculan', scan.occurrences.length, 9)
check('jumlah placeholder rusak', scan.malformed.length, 1)
check('placeholder rusak terdeteksi', scan.malformed[0]?.key, 'ktp_issued_date.x.y')

console.log('\nfield-usage: normalisasi prefix custom.')
check('custom.ktp_issued_date → ktp_issued_date', normalizeFieldKey('custom.ktp_issued_date'), 'ktp_issued_date')
check('ktp_issued_date tetap', normalizeFieldKey('ktp_issued_date'), 'ktp_issued_date')
check('employee.fullName tidak diubah', normalizeFieldKey('employee.fullName'), 'employee.fullName')
check('string kosong aman', normalizeFieldKey(undefined), '')

console.log('\nfield-usage: pencocokan key katalog ↔ konten')
// INI INTI FITUR: key katalog tanpa prefix harus menemukan placeholder ber-prefix.
// 4 kemunculan = heading pasal + paragraf 2 + poin 3 (semua `{{custom.*}}`)
// DI TAMBAH `{{ktp_issued_date}}` tanpa prefix di blok 5 — turut ternormalisasi.
check('ktp_issued_date ditemukan 4×', scan.byKey.get('ktp_issued_date')?.length, 4)
check('employee.fullName ditemukan 3×', scan.byKey.get('employee.fullName')?.length, 3)

console.log('\nfield-usage: lokasi blok')
const ktpBlocks = uniqueBlockLabels(scan.byKey.get('ktp_issued_date') ?? [])
check('ktp dipakai di blok 2,3,5', ktpBlocks.map(b => b.blockIndex + 1), [2, 3, 5])
check('blok 2 punya 2 kemunculan', ktpBlocks.find(b => b.blockIndex === 1)?.count, 2)

const fullNameBlocks = uniqueBlockLabels(scan.byKey.get('employee.fullName') ?? [])
check('fullName dipakai di blok 2,3,4', fullNameBlocks.map(b => b.blockIndex + 1), [2, 3, 4])

console.log('\nfield-usage: sub-bagian')
const inHeading = scan.byKey.get('ktp_issued_date')?.find(o => o.path === 'head:0')
check('judul pasal terlacak', inHeading?.locationLabel, 'judul pasal')
const inParagraph = scan.byKey.get('employee.address')?.[0]
check('paragraf 1 terlacak', inParagraph?.locationLabel, 'paragraf 1')
const inSecondParagraph = scan.byKey.get('ktp_issued_date')?.find(o => o.path === 'art:1')
check('paragraf 2 terlacak', inSecondParagraph?.locationLabel, 'paragraf 2')
const inItem = scan.byKey.get('ktp_issued_date')?.find(o => o.path?.startsWith('item:'))
check('poin 3 terlacak', inItem?.locationLabel, 'poin 3')
const inCell = scan.byKey.get('contract.baseCompensation')?.[0]
check('sel tabel baris 1', inCell?.locationLabel, 'sel tabel (baris 1)')
check('blockId ikut terbawa', inCell?.blockId, 'table-4')

console.log('\nfield-usage: penyaring field dinamis')
check('CONTRACT_INPUT dianggap dinamis', isDynamicField({ sourceType: 'CONTRACT_INPUT' }), true)
check('SYSTEM bukan dinamis', isDynamicField({ sourceType: 'SYSTEM' }), false)
check('MASTER_REFERENCE bukan dinamis', isDynamicField({ sourceType: 'MASTER_REFERENCE' }), false)
check('undefined aman', isDynamicField(undefined), false)

console.log('\nfield-usage: ketahanan')
check('input null aman', scanFieldUsage(null).occurrences.length, 0)
check('array kosong aman', scanFieldUsage([]).occurrences.length, 0)
check('blok tanpa id tetap terindeks', scanFieldUsage([{ type: 'paragraph', text: '{{a.b}}' }]).occurrences[0]?.blockId, '__index_0')
// Regresi penting: regex global punya `lastIndex` yang bocor antar panggilan bila
// tidak di-reset, sehingga pemindaian kedua mengembalikan hasil kosong.
check('pemindaian kedua sama hasilnya', scanFieldUsage(blocks).occurrences.length, 9)
check('pemindaian ketiga sama hasilnya', scanFieldUsage(blocks).byKey.get('ktp_issued_date')?.length, 4)
// Placeholder berulang di satu teks harus dihitung semua, bukan satu.
check('duplikat dalam satu teks dihitung', scanFieldUsage([
  { id: 'p', type: 'paragraph', text: '{{a.b}} lalu {{a.b}} lagi' }
]).occurrences.length, 2)

console.log('\nfield-usage: label lokasi')
check('path null + article', locationLabelFor(null, 'article'), 'paragraf 1')
check('path null + list', locationLabelFor(null, 'list'), 'poin 1')
check('path null + table', locationLabelFor(null, 'table'), 'sel pertama')
check('path null + paragraph', locationLabelFor(null, 'paragraph'), 'isi blok')
check('path row:2:0', locationLabelFor('row:2:0', 'table'), 'sel tabel (baris 3)')

if (failures > 0) {
  console.error(`\n${failures} assertion GAGAL.`)
  process.exit(1)
}
console.log('\nSemua assertion field-usage lulus.')
