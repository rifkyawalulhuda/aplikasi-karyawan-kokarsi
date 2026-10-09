/**
 * Penjaga regresi: SETIAP tipe di `BLOCK_PICKER` harus punya cabang di map
 * `add()` pada `app/components/kontrak/TemplateContentModal.vue`.
 *
 * Latar belakang: `BLOCK_PICKER` sempat menawarkan `title` ("Judul Dokumen")
 * dan `subtitle` ("Subjudul") padahal map di `add()` tidak punya keduanya.
 * Akibatnya `d[type]` bernilai `undefined`, entri itu di-push ke `blocks`, lalu
 * render membaca `b.id` dari `undefined` → TypeError di `renderList` → halaman
 * membeku total.
 *
 * Jalankan: node scripts/check-block-picker-coverage.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = join(root, 'app/components/kontrak/TemplateContentModal.vue')
const src = readFileSync(file, 'utf8')

/** Tipe yang ditawarkan ke pengguna pada modal "Tambah blok". */
const picker = [...src.matchAll(/\{ type: '([a-zA-Z]+)', label:/g)].map(m => m[1])

/** Cabang yang benar-benar membuat objek blok di dalam `add()`. */
// Mendukung bentuk lama (`const d: any = {` … `blocks.value.push(d[type])`)
// maupun bentuk sekarang (`const d: Record<…> = {` … `const block = d[type]`).
const dMatch = /const d:\s*(?:any|Record<[^\n]*?>)\s*=\s*\{/.exec(src)
const endMatch = /(?:const block = d\[type\]|blocks\.value\.push\(d\[type\]\))/.exec(src)
const start = dMatch ? dMatch.index : -1
const end = endMatch ? endMatch.index : -1
if (start === -1 || end === -1 || end < start) {
  console.error('GAGAL: blok map `add()` tidak ditemukan di TemplateContentModal.vue.')
  console.error('Skrip ini perlu diperbarui bila bentuk add() berubah.')
  process.exit(1)
}
const mapped = [...src.slice(start, end).matchAll(/^\s{4}([a-zA-Z]+): \{/gm)].map(m => m[1])

const missing = picker.filter(t => !mapped.includes(t))
const orphan = mapped.filter(t => !picker.includes(t))

console.log(`BLOCK_PICKER : ${picker.length} tipe → ${picker.join(', ')}`)
console.log(`add() map    : ${mapped.length} tipe → ${mapped.join(', ')}`)

if (orphan.length) {
  console.warn(`PERINGATAN: ada di add() tapi tidak ditawarkan picker: ${orphan.join(', ')}`)
}

if (missing.length) {
  console.error(`\nGAGAL: tipe berikut ditawarkan picker TAPI tidak ada di add(): ${missing.join(', ')}`)
  console.error('Menambahkannya ke picker tanpa cabang di add() akan membuat halaman membeku.')
  process.exit(1)
}

console.log('\nOK: semua tipe picker punya cabang di add().')
