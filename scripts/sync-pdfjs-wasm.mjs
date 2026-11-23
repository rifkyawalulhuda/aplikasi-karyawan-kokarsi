import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Menyalin file WebAssembly pdfjs-dist ke `public/pdfjs-wasm`.
 *
 * PDF.js men-decode gambar hasil scan (JBIG2 / JPEG2000) lewat WebAssembly dan
 * meminta file decoder berdasarkan nama aslinya (`jbig2.wasm`,
 * `openjpeg.wasm`, ...). Karena itu file tidak boleh lewat bundler Vite yang
 * memberi nama ber-hash, dan tidak bisa ditangani `nitro.publicAssets` saat
 * `nuxt dev` (aset itu hanya didaftarkan pada build produksi).
 *
 * Hasil salinan di-ignore git; skrip ini dijalankan otomatis oleh `postinstall`,
 * `predev`, dan `prebuild` sehingga selalu sinkron dengan versi pdfjs-dist.
 */
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(projectRoot, 'node_modules', 'pdfjs-dist', 'wasm')
const targetDir = join(projectRoot, 'public', 'pdfjs-wasm')

if (!existsSync(sourceDir)) {
  console.warn(`[sync-pdfjs-wasm] folder sumber tidak ditemukan: ${sourceDir}`)
  console.warn('[sync-pdfjs-wasm] preview PDF hasil scan akan tampil kosong sampai pdfjs-dist terpasang.')
  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })
cpSync(sourceDir, targetDir, { recursive: true, force: true })

const files = readdirSync(targetDir).filter(name => /\.(wasm|js)$/.test(name))
console.log(`[sync-pdfjs-wasm] ${files.length} file disalin ke public/pdfjs-wasm (${files.join(', ')})`)
