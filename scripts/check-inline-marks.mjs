/**
 * Verifikasi `app/utils/inline-marks.ts` (helper pemformatan inline sisi FE).
 *
 * Mengapa harness ini ada: `app/` tidak punya infrastruktur tes (tanpa
 * Vitest/Jest), sehingga satu-satunya cara membuktikan logika toolbar benar
 * adalah menjalankannya langsung dengan Node. Pola ini meniru
 * `scripts/check-field-usage.mjs`.
 *
 * Bagian terpenting: uji PARITAS — parser FE dibandingkan langsung dengan
 * `parseInlineRuns()` backend (`backend/src/contracts/inline-marks.ts`, modul
 * murni tanpa dependensi) pada kumpulan teks yang sama. Kalau kedua parser
 * memberi run yang sama, pratinjau editor dijamin merepresentasikan PDF
 * dengan benar.
 *
 * Cara pakai:
 *   node scripts/check-inline-marks.mjs
 *
 * Keluar dengan kode 1 bila ada assertion yang gagal.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))

function loadTsModule(relPath) {
  const source = readFileSync(resolve(here, relPath), 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  return import(`data:text/javascript,${encodeURIComponent(js)}`)
}

const fe = await loadTsModule('../app/utils/inline-marks.ts')
const be = await loadTsModule('../backend/src/contracts/inline-marks.ts')

const {
  parseInlineMarks,
  stripInlineMarks,
  hasInlineMarks,
  activeMarksAt,
  activeMarksForRange,
  toggleMark
} = fe

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

function marksSet(set) {
  return [...set].sort()
}

// ── 1. Parse dasar ────────────────────────────────────────────────────────────
console.log('inline-marks: parse dasar')
check('bold + teks biasa', parseInlineMarks('**tebal** dan normal'), [
  { text: 'tebal', bold: true, italic: false, underline: false },
  { text: ' dan normal', bold: false, italic: false, underline: false }
])
check('italic `*` tunggal', parseInlineMarks('a *miring* b'), [
  { text: 'a ', bold: false, italic: false, underline: false },
  { text: 'miring', bold: false, italic: true, underline: false },
  { text: ' b', bold: false, italic: false, underline: false }
])
check('underline `__`', parseInlineMarks('__garis__'), [
  { text: 'garis', bold: false, italic: false, underline: true }
])
check('nesting `***teks***`', parseInlineMarks('***teks***'), [
  { text: 'teks', bold: true, italic: true, underline: false }
])
check('teks kosong → satu run kosong', parseInlineMarks(''), [
  { text: '', bold: false, italic: false, underline: false }
])

// ── 2. Aturan pelindung teks legal ───────────────────────────────────────────
console.log('\ninline-marks: pelindung teks legal')
check('placeholder opaque', parseInlineMarks('{{custom.ktp_issued_date}}'), [
  { text: '{{custom.ktp_issued_date}}', bold: false, italic: false, underline: false }
])
check('`__` di dalam placeholder diabaikan', parseInlineMarks('{{a__b}}'), [
  { text: '{{a__b}}', bold: false, italic: false, underline: false }
])
check('snake_case aman', parseInlineMarks('nama_depan dan __x__'), [
  { text: 'nama_depan dan ', bold: false, italic: false, underline: false },
  { text: 'x', bold: false, italic: false, underline: true }
])
check('delimiter tanpa pasangan jadi literal', parseInlineMarks('a * b'), [
  { text: 'a * b', bold: false, italic: false, underline: false }
])
check('pasangan tanpa isi jadi literal', parseInlineMarks('a****b'), [
  { text: 'a****b', bold: false, italic: false, underline: false }
])
check('escape `\\*` jadi literal', parseInlineMarks('\\*bukan tebal\\*'), [
  { text: '*bukan tebal*', bold: false, italic: false, underline: false }
])

// ── 3. Helper turunan ────────────────────────────────────────────────────────
console.log('\ninline-marks: strip / has')
check('stripInlineMarks', stripInlineMarks('**a** b __c__ *d*'), 'a b c d')
check('stripInlineMarks tanpa mark', stripInlineMarks('teks polos'), 'teks polos')
check('hasInlineMarks true', hasInlineMarks('ada **tebal**'), true)
check('hasInlineMarks false untuk literal', hasInlineMarks('a * b'), false)

// ── 4. Status toolbar ────────────────────────────────────────────────────────
console.log('\ninline-marks: activeMarks')
const boldText = '**halo** dunia'
check('kursor di tengah mark', marksSet(activeMarksAt(boldText, 3)), ['bold'])
check('tepi isi tetap aktif (pos 6)', marksSet(activeMarksAt(boldText, 6)), ['bold'])
check('di luar mark', marksSet(activeMarksAt(boldText, 8)), [])
check('seleksi penuh isi', marksSet(activeMarksForRange(boldText, 2, 6)), ['bold'])
check('seleksi termasuk delimiter', marksSet(activeMarksForRange(boldText, 0, 8)), ['bold'])
check('seleksi melewati batas mark', marksSet(activeMarksForRange(boldText, 2, 10)), [])
check('nesting dua mark', marksSet(activeMarksAt('***teks***', 4)).join(','), 'bold,italic')

// ── 5. toggleMark ────────────────────────────────────────────────────────────
console.log('\ninline-marks: toggleMark')
check('toggle ON', toggleMark('halo dunia', 0, 4, 'bold'), {
  text: '**halo** dunia', selectionStart: 2, selectionEnd: 6
})
check('toggle OFF dari dalam isi', toggleMark(boldText, 2, 6, 'bold'), {
  text: 'halo dunia', selectionStart: 0, selectionEnd: 4
})
check('toggle OFF termasuk delimiter', toggleMark(boldText, 0, 8, 'bold'), {
  text: 'halo dunia', selectionStart: 0, selectionEnd: 4
})
check('seleksi kosong sisipkan pasangan', toggleMark('abc', 1, 1, 'bold'), {
  text: 'a****bc', selectionStart: 3, selectionEnd: 3
})
check('nesting italic di dalam bold', toggleMark('**halo dunia**', 7, 12, 'italic'), {
  text: '**halo *dunia***', selectionStart: 8, selectionEnd: 13
})
check('placeholder ikut terapit', toggleMark('{{a.b}}', 0, 7, 'bold'), {
  text: '**{{a.b}}**', selectionStart: 2, selectionEnd: 9
})
check('dua rentang tersapu ikut dilepas', toggleMark('**a** x **b**', 1, 11, 'bold').text, 'a x b')
check('underline di dalam isi bold', toggleMark('__u__ **b**', 8, 9, 'underline').text, '__u__ **__b__**')

// Placeholder OPAQUE punya konsekuensi yang disengaja: delimiter yang jatuh DI
// DALAM `{{...}}` tidak dihitung, jadi mark yang menyapu placeholder tidak
// berpasangan → dibiarkan sebagai teks literal (peringatan, bukan error).
const crossed = toggleMark('Upah {{contract.baseCompensation}} ok', 7, 40, 'bold')
check('mark menyapu placeholder tidak berpasangan', hasInlineMarks(crossed.text), false)
check('karakter isi tetap utuh', stripInlineMarks(crossed.text).includes('contract.baseCompensation}} ok'), true)

// Invariant: toggle ON tidak pernah menghapus karakter isi — hanya menyisipkan
// delimiter mengapit seleksi.
const original = 'Upah {{contract.baseCompensation}} dan snake_case'
const on = toggleMark(original, 35, 44, 'underline')
check('toggle ON mempertahankan seluruh karakter', on.text, `${original.slice(0, 35)}__${original.slice(35, 44)}__${original.slice(44)}`)
// Setelah OFF kembali, teks pulih persis ke semula.
const off = toggleMark(on.text, on.selectionStart, on.selectionEnd, 'underline')
check('toggle ON lalu OFF pulih persis', off.text, original)

// ── 6. PARITAS FE ↔ BE ───────────────────────────────────────────────────────
console.log('\ninline-marks: paritas parseInlineMarks (FE) vs parseInlineRuns (BE)')
const parityCases = [
  'Teks polos tanpa mark',
  '**tebal** dan *miring* dan __garis bawah__',
  '***tebal dan miring***',
  'snake_case_field tetap utuh',
  'a * b * c (delimiter ganjil)',
  'a****b (pasangan kosong)',
  'Gaji: {{contract.baseCompensation}} per bulan',
  '{{custom.ktp_issued_date}} tanpa mark',
  'Mitra __MITRA_TERM__ token warisan',
  'escape: \\*literal\\* dan \\_garis\\_',
  'Baris 1 **lanjut**\nbaris 2 __tebal__',
  '**mark *di* dalam** nesting',
  '***tumpuk*** __dua__',
  'bintang tunggal * di akhir',
  ''
]
let parityFailures = 0
for (const text of parityCases) {
  const feRuns = parseInlineMarks(text)
  const beRuns = be.parseInlineRuns(text)
  if (JSON.stringify(feRuns) !== JSON.stringify(beRuns)) {
    parityFailures += 1
    failures += 1
    console.log(`  FAIL paritas: ${JSON.stringify(text)}\n       FE: ${JSON.stringify(feRuns)}\n       BE: ${JSON.stringify(beRuns)}`)
  } else {
    console.log(`  ok   ${JSON.stringify(text).slice(0, 60)}`)
  }
}
// Catatan: invariant `runsToText(parse(t)) === t` backend hanya berlaku untuk
// teks TANPA delimiter literal — `runsToText` sengaja meng-escape `*` literal
// menjadi `\*`. Itu sudah tercakup spec backend; di sini cukup paritas parse.
if (parityFailures === 0) console.log('  ok   seluruh kasus paritas identik')

if (failures > 0) {
  console.error(`\n${failures} assertion GAGAL.`)
  process.exit(1)
}
console.log('\nSemua assertion inline-marks lulus.')
