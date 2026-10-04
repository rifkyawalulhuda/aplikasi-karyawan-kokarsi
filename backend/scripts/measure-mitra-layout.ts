/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/first */
/**
 * HARNESS PENGUKURAN (read-only) — bukan generator dokumen.
 *
 * Merender Template Kontrak MITRA (default: template 111) memakai MESIN
 * PRODUKSI yang sama dengan pratinjau editor & generate kontrak, lalu
 * melaporkan angka NYATA:
 *   - jumlah halaman
 *   - tinggi kotak per halaman (di-intersep dari `doc.rect`, jadi ini nilai
 *     yang BENAR-BENAR digambar, bukan rekonstruksi)
 *   - posisi tabel tanda tangan → apakah ia mendorong halaman baru
 *   - kesimpulan apakah halaman terakhir diawali sebelum/oleh tanda tangan
 *
 * Skrip ini TIDAK menulis ke DB dan TIDAK mengubah file mesin mana pun; hanya
 * menulis PDF diagnostik ke `tmp/`. Dipakai sebagai baseline sebelum/sesudah.
 *
 * Jalankan: npx ts-node scripts/measure-mitra-layout.ts [templateId]
 */
import { config } from 'dotenv'
import { resolve, join } from 'path'
import { promises as fs } from 'fs'
import PDFDocument from 'pdfkit'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })

import {
  renderMitraLayout,
  renderMitraSignature,
  MITRA_GEOMETRY,
  MITRA_HEADER_CHROME,
} from '../src/contracts/mitra-layout.engine'
import { normalizeArticleHeadings } from '../src/contract-templates/template-schema.validator'
import { MITRA_PREVIEW_VALUES } from '../src/contracts/mitra-preview-sample'

const FONT_DIR =
  process.env.FONT_DIR ??
  (process.platform === 'win32' ? 'C:/Windows/Fonts' : '/usr/share/fonts/truetype/msttcorefonts')

const ASSET_ROOT = resolve(process.cwd(), 'assets')
const G = MITRA_GEOMETRY

const fmt = (n: unknown) => (typeof n === 'number' ? n.toFixed(2) : String(n))

/** Kotak yang benar-benar digambar: { x0, top, height } per panggilan rect(). */
interface DrawnBox { x0: number; top: number; height: number }

/** Mode daftar: tampilkan semua template MITRA beserta versinya. */
async function listMitra(prisma: any) {
  const contracts = await prisma.contract.findMany({
    where: { contractNo: { contains: '111' } },
    orderBy: { id: 'asc' },
    select: { id: true, contractNo: true, templateId: true, templateVersionId: true, status: true },
    take: 20,
  })
  console.log('KONTRAK dengan contractNo mengandung "111":')
  if (!contracts.length) console.log('  (tidak ada)')
  for (const c of contracts) {
    console.log(`  id=${c.id} no=${c.contractNo} templateId=${c.templateId} verId=${c.templateVersionId} status=${c.status}`)
  }
  console.log('')
  const rows = await prisma.contractTemplate.findMany({
    where: { family: 'MITRA' },
    orderBy: { id: 'asc' },
    include: { versions: { orderBy: { versionNumber: 'desc' } } },
  })
  console.log('='.repeat(78))
  console.log('TEMPLATE KELUARGA MITRA DI DATABASE')
  console.log('='.repeat(78))
  console.log('  id  | code                 | nama                                    | versi')
  console.log('  ----+----------------------+-----------------------------------------+------------------')
  for (const t of rows) {
    const vers = t.versions
      .map((v: any) => `v${v.versionNumber}:${v.status}`)
      .join(', ')
    console.log(
      `  ${String(t.id).padStart(3)} | ${String(t.code).padEnd(20).slice(0, 20)} | ` +
        `${String(t.name).padEnd(39).slice(0, 39)} | ${vers}`,
    )
  }
  console.log('')
  console.log(`Cari juga yang code/name mengandung "111":`)
  const matches = await prisma.contractTemplate.findMany({
    where: {
      OR: [
        { code: { contains: '111' } },
        { name: { contains: '111' } },
      ],
    },
    orderBy: { id: 'asc' },
  })
  if (matches.length === 0) console.log('  (tidak ada)')
  for (const m of matches) {
    console.log(`  id=${m.id} code=${m.code} name=${m.name} family=${m.family}`)
  }
  console.log('='.repeat(78))
}

async function main() {
  const templateId = Number(process.argv[2] ?? 111)
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')

  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })),
  } as any)

  try {
    if (process.argv.includes('--list')) {
      await listMitra(prisma)
      return
    }
    const template = await (prisma as any).contractTemplate.findUnique({
      where: { id: templateId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    })
    if (!template) throw new Error(`Template ${templateId} tidak ditemukan`)
    if (template.family !== 'MITRA') {
      throw new Error(`Template ${templateId} keluarga ${template.family}, bukan MITRA`)
    }
    const version =
      template.versions.find((v: any) => v.status === 'PUBLISHED') ?? template.versions[0]
    if (!version) throw new Error(`Template ${templateId} belum punya versi`)

    console.log('='.repeat(78))
    console.log(`TEMPLATE  : ${template.id} — ${template.name}`)
    console.log(`FAMILY    : ${template.family}   VERSION: v${version.versionNumber} (${version.status})`)
    console.log(`VERSION ID: ${version.id}`)
    console.log('='.repeat(78))

    const content = JSON.parse(JSON.stringify(version.contentDefinition ?? {}))
    const headingChanges = normalizeArticleHeadings(content)
    if (headingChanges > 0) {
      console.log(`[normalizeArticleHeadings] ${headingChanges} heading pasal dinormalisasi\n`)
    }

    const languages = content?.languages ?? {}
    const blocks: any[] = languages.id ?? languages[Object.keys(languages)[0]] ?? []

    const byType = new Map<string, number>()
    for (const b of blocks) byType.set(b.type, (byType.get(b.type) ?? 0) + 1)
    console.log(`BLOCKS    : ${blocks.length} total`)
    console.log(`            ${[...byType.entries()].map(([t, n]) => `${t}=${n}`).join(', ')}\n`)

    // ---- Render memakai mesin produksi ----
    const doc = new PDFDocument({
      size: [G.pageWidth, G.pageHeight],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      autoFirstPage: true,
    })
    const buffers: Buffer[] = []
    doc.on('data', (c: Buffer) => buffers.push(c))
    const done = new Promise<void>(res => doc.on('end', () => res()))

    /**
     * Intersep `doc.rect` + `doc.stroke` untuk menangkap kotak kolom yang
     * BENAR-BENAR digambar beserta nomor halamannya. Ini menghindari
     * merekonstruksi geometri `deepestByPage` yang bersifat internal.
     */
    const drawnBoxes: DrawnBox[] = []
    let pendingRect: DrawnBox | null = null
    const realRect = doc.rect.bind(doc)
    const realStroke = doc.stroke.bind(doc)
    // Hanya tangkap kotak KOLOM (x0 = kolom kiri/kanan). Kotak lain (mis. tabel
    // tanda tangan) juga memanggil rect()+stroke() dan harus diabaikan.
    const isColumnX = (x: number) =>
      Math.abs(x - G.left.x0) < 1 || Math.abs(x - G.right.x0) < 1
    ;(doc as any).rect = (x: number, y: number, w: number, h: number, ...rest: any[]) => {
      pendingRect = isColumnX(x) ? { x0: x, top: y, height: h } : null
      return realRect(x, y, w, h, ...rest)
    }
    ;(doc as any).stroke = (...args: any[]) => {
      if (pendingRect) {
        drawnBoxes.push(pendingRect)
        pendingRect = null
      }
      return realStroke(...args)
    }

    // Lacak nomor halaman aktif untuk mengaitkan setiap kotak dengan halamannya.
    // PENTING: `switchToPage()` pada buffered pages TIDAK memicu `addPage()`,
    // jadi penghitung manual akan salah. Halaman sesungguhnya dibaca dari
    // doc.page / bufferedPageRange saat rect digambar.
    const pageOfBox: number[] = []
    /**
     * Indeks halaman (0-based) yang sedang aktif.
     *
     * Saat `bufferPages: true`, `doc.addPage()` TIDAK langsung menulis halaman;
     * ia menaruhnya di `_pageBuffer`. `switchToPage()` juga hanya menggeser
     * `doc.page`. Karena itu penghitung manual salah — indeks sebenarnya adalah
     * `_pageBufferStart + posisi doc.page di dalam _pageBuffer`.
     */
    const pageIndexOf = (d: any): number => {
      const buf: any[] = d._pageBuffer ?? []
      const start: number = d._pageBufferStart ?? 0
      const at = buf.indexOf(d.page)
      return at >= 0 ? start + at : start + buf.length - 1
    }
    const realRectWrapped = (doc as any).rect
    ;(doc as any).rect = (x: number, y: number, w: number, h: number, ...rest: any[]) => {
      const res = realRectWrapped(x, y, w, h, ...rest)
      if (pendingRect) pageOfBox[drawnBoxes.length] = pageIndexOf(doc)
      return res
    }

    /**
     * Intersep `doc.text` untuk mencatat posisi Y terakhir SETIAP kolom.
     * Ini bukti langsung ketimpangan pembagian stream: berapa Y terakhir di
     * kolom kiri vs kanan pada halaman terakhir yang ber-konten.
     */
    const lastY = { left: 0, right: 0 }
    /** Y terdalam per halaman per kolom — inilah isi kotak yang SEBENARNYA. */
    const deepByPageCol: Record<number, { left: number; right: number }> = {}
    const realText = doc.text.bind(doc)
    ;(doc as any).text = (str: any, x?: any, y?: any, ...rest: any[]) => {
      const cur = (doc as any).x
      const isLeft = cur < G.pageWidth / 2
      const py = (doc as any).y
      const slot = (deepByPageCol[pageIndexOf(doc)] ??= { left: 0, right: 0 })
      if (isLeft) {
        lastY.left = Math.max(lastY.left, py)
        slot.left = Math.max(slot.left, py)
      } else {
        lastY.right = Math.max(lastY.right, py)
        slot.right = Math.max(slot.right, py)
      }
      return realText(str, x, y, ...rest)
    }

    renderMitraLayout(doc, blocks, {
      values: MITRA_PREVIEW_VALUES,
      title: template.name ?? 'PERJANJIAN KEMITRAAN',
      numberLabel: `${MITRA_HEADER_CHROME.numberPrefix} ${MITRA_PREVIEW_VALUES['contract.contractNo']}`,
      dateLabel: `${MITRA_HEADER_CHROME.datePrefix} ${MITRA_PREVIEW_VALUES['contract.startDate']}`,
      logoPath: join(ASSET_ROOT, 'contract-logo-mitra.jpg'),
      fonts: {
        regular: join(FONT_DIR, 'times.ttf'),
        bold: join(FONT_DIR, 'timesbd.ttf'),
        italic: join(FONT_DIR, 'timesi.ttf'),
      },
      reserveSignatureZone: true,
    })

    const afterBoxPass = (doc as any).bufferedPageRange().count
    const meta = (doc as any).__mitraFinalPage
    const boxesAfterLayout = drawnBoxes.length

    // Snapshot meta SEBELUM tanda tangan — ini yang dibaca renderMitraSignature.
    const metaBeforeSig = { ...(meta ?? {}) }

    // Tangkap geometri tabel tanda tangan (rect pada x = signatureTable.left).
    const T = G.signatureTable
    let sigTable: { top: number; height: number; page: number } | null = null
    ;(doc as any).rect = (x: number, y: number, w: number, h: number, ...rest: any[]) => {
      if (Math.abs(x - T.left) < 0.5) {
        sigTable = { top: y, height: h, page: pageIndexOf(doc) }
      }
      return realRect(x, y, w, h, ...rest)
    }

    renderMitraSignature(doc, {
      leftHeader: MITRA_HEADER_CHROME.signature.leftHeader,
      leftName: MITRA_PREVIEW_VALUES['settings.cooperativeChairmanName'] ?? '',
      leftRole: MITRA_HEADER_CHROME.signature.leftRoleLabel,
      rightHeader: MITRA_HEADER_CHROME.signature.rightHeader,
      rightName: MITRA_PREVIEW_VALUES['employee.fullName'] ?? '',
      rightRole: `( ${MITRA_PREVIEW_VALUES['employee.jobRole'] ?? ''} )`,
    })

    // Total halaman WAJIB diambil sebelum `doc.end()`; setelah end PDFKit
    // tidak lagi melaporkan bufferedPageRange.
    const totalPagesBeforeEnd = (doc as any).bufferedPageRange().count

    doc.end()
    await done

    const buf = Buffer.concat(buffers)

    await fs.mkdir(resolve(process.cwd(), 'tmp'), { recursive: true })
    const outPath = resolve(process.cwd(), 'tmp', `mitra-${templateId}-baseline.pdf`)
    await fs.writeFile(outPath, buf)

    // ---- Laporan ----
    // CATATAN: `bufferedPageRange()` hanya valid SEBELUM `doc.end()`; setelahnya
    // nilainya kembali 0. Karena itu total halaman ditangkap lebih awal.
    const boxPairs = Math.floor(boxesAfterLayout / 2)
    const totalPages = totalPagesBeforeEnd

    console.log('--- HASIL UKUR ---')
    console.log(`JUMLAH HALAMAN AKHIR     : ${totalPages}`)
    console.log(`Halaman saat pass kotak  : ${afterBoxPass}`)
    console.log(`Kotak kolom digambar     : ${boxesAfterLayout} → ${boxPairs} pasang (kiri+kanan)`)
    if (totalPages > afterBoxPass) {
      console.log('')
      console.log(`  !! TANDA TANGAN MENAMBAH ${totalPages - afterBoxPass} HALAMAN ` +
        `(${afterBoxPass} → ${totalPages})`)
      console.log('     Halaman itu dibuat SETELAH pass kotak selesai → TIDAK ber-border.')
      console.log('     INILAH "halaman yang tidak perlu" pada MITRA 18600.')
    } else {
      console.log('  (tanda tangan TIDAK menambah halaman)')
    }
    console.log('')

    console.log('KOTAK KOLOM — tinggi kiri vs kanan (x0 kiri=27.02, kanan=309.40):')
    console.log('  hal |  x0     |  boxTop |  bottom | tinggi  | selisih K-R')
    console.log('  ----+---------+---------+---------+---------+------------')
    drawnBoxes.forEach((b, i) => {
      const isLeft = b.x0 < 200
      const partner = isLeft ? drawnBoxes[i + 1] : drawnBoxes[i - 1]
      const diff = partner ? b.height - partner.height : 0
      const hal = pageOfBox[i] ?? -1
      console.log(
        `  ${String(hal).padStart(3)} | ${fmt(b.x0).padStart(7)} | ` +
          `${fmt(b.top).padStart(7)} | ${fmt(b.top + b.height).padStart(7)} | ` +
          `${fmt(b.height).padStart(7)} | ${(isLeft ? fmt(diff) : '   (kanan)').padStart(10)}`,
      )
    })
    console.log('')

    console.log('META AKHIR (dibaca renderMitraSignature):')
    console.log(`  pageCount          : ${metaBeforeSig?.pageCount}`)
    console.log(`  lastPage           : ${metaBeforeSig?.lastPage}`)
    console.log(`  lastPageBodyBottom : ${fmt(metaBeforeSig?.lastPageBodyBottom)}`)
    const splitInfo = (doc as any).__mitraSplit
    if (splitInfo) {
      console.log('RENCANA LAYOUT (diukur dari render engine):')
      console.log(`  split terpilih     : ${splitInfo.splitIndex}`)
      console.log(`  halaman disisihkan : ${splitInfo.reservedPage}`)
      console.log(`  perkiraan halaman  : ${splitInfo.pageCount}`)
    }
    console.log('')

    // Tabel tanda tangan mendarat di kolom kiri halaman terakhir dan TIDAK boleh
    // dihitung sebagai body saat menilai isi halaman. Nilai mentah dari intersep
    // text di halaman itu milik tabel → ganti dengan dasar kotak (pass kotak
    // terjadi SEBELUM tanda tangan, jadi kotak = posisi body sebenarnya).
    const boxBottomOf = (p: number): number => {
      const b = drawnBoxes.find((x, i) => (pageOfBox[i] ?? -1) === p && x.x0 < 200)
      return b ? b.top + b.height - G.boxPaddingBottom : 0
    }
    const sigPage = sigTable ? (sigTable as { page: number }).page : -1
    if (sigPage >= 0 && deepByPageCol[sigPage]) {
      const bodyB = boxBottomOf(sigPage)
      deepByPageCol[sigPage] = { left: bodyB, right: bodyB }
    }

    // ---- Analisis kapasitas: apakah halaman bisa dikurangi? ----
    // Halaman yang hanya berisi sisa konten (bukan halaman penuh) menentukan
    // berapa yang harus "ditarik" agar halaman itu hilang.
    const pg = metaBeforeSig?.pageCount ?? 0
    let lastContentPage = pg - 1
    while (lastContentPage > 0 && (deepByPageCol[lastContentPage]?.left ?? 0) === 0 &&
           (deepByPageCol[lastContentPage]?.right ?? 0) === 0) lastContentPage--

    // Berapa konten di halaman terakhir yang benar-benar berisi?
    const lc = deepByPageCol[lastContentPage] ?? { left: 0, right: 0 }
    const lastTop = lastContentPage === 0 ? G.firstPageBoxTop : G.contPageBoxTop
    const lastContent = Math.max(lc.left, lc.right) - lastTop

    // Ruang bebas yang bisa dipakai menampung konten itu di halaman-halaman sebelumnya:
    let freeAbove = 0
    for (let p = 0; p < lastContentPage; p++) {
      const c = deepByPageCol[p] ?? { left: 0, right: 0 }
      const bot = p === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom
      freeAbove += (bot - Math.max(c.left, c.right))
    }

    console.log('ANALISIS KAPASITAS:')
    console.log(`  total halaman            : ${pg}`)
    console.log(`  halaman berisi konten    : ${lastContentPage + 1} (0..${lastContentPage})`)
    console.log(`  konten di halaman terakhir: ${fmt(lastContent)}`)
    console.log(`  ruang bebas hlm 0..${lastContentPage - 1}   : ${fmt(freeAbove)}`)
    // Ruang bebas per KOLOM. Syarat menghilangkan halaman terakhir: SETIAP
    // stream (kiri & kanan) harus muat di halaman-halaman sebelumnya.
    const freeCol = { left: 0, right: 0 }
    for (let p = 0; p < lastContentPage; p++) {
      const c = deepByPageCol[p] ?? { left: 0, right: 0 }
      const bot = p === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom
      freeCol.left += bot - c.left
      freeCol.right += bot - c.right
    }
    // Konten halaman terakhir per kolom = dasar body dikurangi top kotak.
    const lastBodyBottom = boxBottomOf(lastContentPage)
    const lastPerCol = lastBodyBottom - lastTop

    console.log('  ruang bebas KIRI         : ' + fmt(freeCol.left))
    console.log('  ruang bebas KANAN        : ' + fmt(freeCol.right))
    console.log(`  konten hlm ${lastContentPage} per kolom  : ${fmt(lastPerCol)}`)
    console.log(`  -> KIRI  ${lastPerCol <= freeCol.left ? 'MUAT ✓' : 'TIDAK MUAT ✗'}` +
      ` | KANAN ${lastPerCol <= freeCol.right ? 'MUAT ✓' : 'TIDAK MUAT ✗'}`)
    console.log('')

    console.log('ISI NYATA per halaman (kotak digambar vs teks terdalam):')
    console.log('  hal | boxTop | boxBot(digambar) | teks K  | teks Ka | isi nyata | bantalan')
    console.log('  ----+--------+------------------+---------+---------+-----------+---------')
    for (let p = 0; p < (metaBeforeSig?.pageCount ?? 0); p++) {
      const pair = drawnBoxes.filter((b, i) => (pageOfBox[i] ?? -1) === p)
      const leftBox = pair.find(b => b.x0 < 200)
      const rightBox = pair.find(b => b.x0 > 200)
      if (!leftBox) continue
      const col = deepByPageCol[p] ?? { left: 0, right: 0 }
      const drawnBottom = leftBox.top + leftBox.height
      const contentBottom = Math.max(col.left, col.right)
      const slack = drawnBottom - contentBottom
      console.log(
        `  ${String(p).padStart(3)} | ${fmt(leftBox.top).padStart(6)} | ${fmt(drawnBottom).padStart(16)} | ` +
          `${fmt(col.left).padStart(7)} | ${fmt(col.right).padStart(7)} | ${fmt(contentBottom).padStart(9)} | ${fmt(slack).padStart(8)}`,
      )
      void rightBox
    }
    console.log('')

    // ---- Diagnosa ketimpangan stream ----
    const firstPageBoxes = drawnBoxes.filter(b => b.top > 150)
    const contBoxes = drawnBoxes.filter(b => b.top < 100)
    console.log('DIAGNOSA:')
    console.log('  TABEL TANDA TANGAN (terukur):')
    if (sigTable) {
      const st = sigTable as { top: number; height: number; page: number }
      const boxBot = st.page === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom
      console.log(`    halaman        : ${st.page}`)
      console.log(`    top            : ${fmt(st.top)}`)
      console.log(`    height         : ${fmt(st.height)}`)
      console.log(`    bottom         : ${fmt(st.top + st.height)}`)
      console.log(`    boxBottom hlm  : ${fmt(boxBot)}`)
      console.log(`    bodyBottom     : ${fmt(metaBeforeSig?.lastPageBodyBottom)}`)
      console.log(`    GAP kotak→ttd  : ${fmt(st.top - metaBeforeSig?.lastPageBodyBottom)}`)
      console.log(`    DI LUAR KOTAK? : ${st.top > metaBeforeSig?.lastPageBodyBottom ? 'YA ✓' : 'TIDAK ✗'}`)
      console.log(`    batas halaman  : ${fmt(G.pageHeight)} (sisa ${fmt(G.pageHeight - (st.top + st.height))})`)
    } else {
      console.log('    (tidak tertangkap)')
    }
    console.log('')
    console.log(`  Y terakhir kolom KIRI  : ${fmt(lastY.left)}`)
    console.log(`  Y terakhir kolom KANAN : ${fmt(lastY.right)}`)
    console.log(`  selisih K-R            : ${fmt(lastY.left - lastY.right)}` +
      (Math.abs(lastY.left - lastY.right) > 20 ? '  <-- TIMPANG' : '  (seimbang)'))
    console.log('')
    if (firstPageBoxes.length) {
      console.log(`  halaman 1 kotak : ${firstPageBoxes.length} (kiri+kanan) → halaman ber-konten`)
    }
    const partial = contBoxes.filter(b => b.height < 700)
    console.log(`  halaman kontinu penuh : ${contBoxes.length - partial.length}`)
    console.log(`  halaman kontinu pendek : ${partial.length}` +
      (partial.length ? ` (bottom ${partial.map(b => fmt(b.top + b.height)).join(', ')})` : ''))
    console.log('')
    if (metaBeforeSig?.pageCount != null && totalPages > metaBeforeSig.pageCount) {
      console.log(`>>> BUG TERBUKTI: passes kotak berhenti di ${metaBeforeSig.pageCount} halaman,`)
      console.log(`    tetapi output akhir ${totalPages} halaman — tanda tangan memaksa halaman baru.`)
    } else {
      console.log(`>>> Tanda tangan TIDAK menambah halaman (kotak ${metaBeforeSig?.pageCount} = akhir ${totalPages}).`)
    }
    console.log('')
    console.log(`PDF DIAGNOSTIK: ${outPath}`)
    console.log('='.repeat(78))
  } finally {
    await (prisma as any).$disconnect()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
