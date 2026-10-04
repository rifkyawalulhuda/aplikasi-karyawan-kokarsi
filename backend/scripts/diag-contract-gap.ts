/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/first */
/**
 * DIAGNOSTIK (read-only) - render konrak lewat JALUR PRODUKSI
 * (renderMitraDocumentInto) dengan mode reservasi ON/OFF, lalu bandingkan
 * jumlah halaman + tinggi kotak yang BENAR-BENAR digambar + gap yang terlihat.
 */
import { config } from 'dotenv'
import { resolve, join } from 'path'
import { promises as fs, existsSync } from 'fs'
import zlib from 'zlib'
import PDFDocument from 'pdfkit'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })

import { renderMitraDocumentInto } from '../src/contracts/mitra-document.renderer'
import { MITRA_GEOMETRY, MITRA_HEADER_CHROME } from '../src/contracts/mitra-layout.engine'
import { buildValueMap, interpolate } from '../src/contracts/contract-block-renderer'

const G = MITRA_GEOMETRY
const FONT_DIR = process.env.FONT_DIR ?? 'C:/Windows/Fonts'
const ASSET_ROOT = resolve(process.cwd(), 'assets')
/**
 * Dekstrak operator `re` (rect) dari content stream PDF tanpa dependensi
 * eksternal, dengan dekompresi FlateDecode (zlib). Dipakai untuk MEMBUKTIKAN
 * mode mana yang menghasilkan PDF tertentu: kotak halaman terakhir dipendekkan
 * ~551pt = reservasi ON, ~670pt = OFF.
 */
function rectsFromPdf(buf: Buffer): Array<{ stream: number, x: number, y: number, w: number, h: number }> {
  const out: Array<{ stream: number, x: number, y: number, w: number, h: number }> = []
  const raw = buf.toString('latin1')
  const objRe = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g
  let m: RegExpExecArray | null
  const streams: string[] = []
  while ((m = objRe.exec(raw)) !== null) {
    const sm = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(m[2])
    if (!sm) continue
    let body = sm[1]
    if (/FlateDecode/.test(m[2])) {
      try {
        body = zlib.inflateSync(Buffer.from(sm[1], 'latin1')).toString('latin1')
      } catch {
        try { body = zlib.inflateRawSync(Buffer.from(sm[1], 'latin1')).toString('latin1') } catch { continue }
      }
    }
    if (/(^|\s)re(\s|$)/.test(body)) streams.push(body)
  }
  streams.forEach((s, idx) => {
    const re = /([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+re/g
    let r: RegExpExecArray | null
    while ((r = re.exec(s)) !== null) {
      out.push({ stream: idx, x: +r[1], y: +r[2], w: +r[3], h: +r[4] })
    }
  })
  return out
}

/** Kotak kolom = rect dengan lebar khas kolom (bukan tabel tanda tangan). */
function columnBoxes(rects: Array<{ stream: number, x: number, y: number, w: number, h: number }>) {
  const colW = G.left.x1 - G.left.x0
  return rects.filter((r) => Math.abs(r.w - colW) < 1.5 && r.h > 50)
}



async function renderWith(target: any, blocks: any[], values: Record<string, string>, title: string, reserve: boolean) {
  const doc = new PDFDocument({
    size: [G.pageWidth, G.pageHeight],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    autoFirstPage: true,
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<void>((res) => doc.on('end', () => res()))

  const boxEvents: Array<{ page: number, x0: number, top: number, bottom: number }> = []
  const textEvents: Array<{ page: number, x: number, top: number, bottom: number, sample: string }> = []
  let pending: any = null
  // Halaman aktif dilacak dari addPage/switchToPage (doc.page.number tidak ada
  // di PDFKit). Halaman buffered dibuat saat interleave antar stream.
  let currentPage = 0
  let lastPage = 0
  const realAddPage = doc.addPage.bind(doc)
  ;(doc as any).addPage = (...a: any[]) => {
    const r = realAddPage(...a)
    lastPage += 1
    currentPage = lastPage
    return r
  }
  const realSwitch = doc.switchToPage.bind(doc)
  ;(doc as any).switchToPage = (...a: any[]) => {
    const r = realSwitch(...a)
    if (typeof a[0] === 'number') currentPage = a[0]
    return r
  }
  const isColX = (x: number) => Math.abs(x - G.left.x0) < 1 || Math.abs(x - G.right.x0) < 1
  const realRect = doc.rect.bind(doc)
  ;(doc as any).rect = (x: number, y: number, w: number, h: number, ...rest: any[]) => {
    pending = isColX(x) ? { page: currentPage, x0: x, top: y, bottom: y + h } : null
    return realRect(x, y, w, h, ...rest)
  }
  const realStroke = doc.stroke.bind(doc)
  ;(doc as any).stroke = (...a: any[]) => {
    if (pending) { boxEvents.push(pending); pending = null }
    return realStroke(...a)
  }
  // Tangkap setiap penempatan teks (x, y = baseline). `bottom` memakai tinggi
  // font sebagai aproksimasi batas bawah glif.
  const realText = doc.text.bind(doc)
  ;(doc as any).text = (t: any, x?: any, y?: any, ...rest: any[]) => {
    const fs2 = (doc as any)._fontSize ?? 12
    const yy = typeof y === 'number' ? y : (doc as any).y
    const xx = typeof x === 'number' ? x : (doc as any).x
    textEvents.push({ page: currentPage, x: xx, top: yy - fs2, bottom: yy, sample: String(t).slice(0, 45) })
    return realText(t, x, y, ...rest)
  }

  renderMitraDocumentInto(doc, {
    blocks,
    values,
    fallbackTitle: target.template?.name,
    numberLabel: `${MITRA_HEADER_CHROME.numberPrefix} ${target.contractNo}`,
    reserveSignatureZone: reserve,
    logoPath: existsSync(join(ASSET_ROOT, 'contract-logo-mitra.jpg'))
      ? join(ASSET_ROOT, 'contract-logo-mitra.jpg') : undefined,
    fonts: {
      regular: join(FONT_DIR, 'times.ttf'),
      bold: join(FONT_DIR, 'timesbd.ttf'),
      italic: join(FONT_DIR, 'timesi.ttf'),
    },
    signature: {
      employeeName: values['employee.fullName'] || target.employee?.fullName || '',
      jobRole: values['employee.jobRole'] || target.employee?.jobRole?.name || '',
    },
  } as any)

  const totalPages = doc.bufferedPageRange().count
  const finalPage = (doc as any).__mitraFinalPage
  const plan = (doc as any).__mitraSplit
  doc.end()
  await done

  console.log('='.repeat(78))
  console.log(`MODE reserveSignatureZone = ${reserve}  ->  HALAMAN: ${totalPages}`)
  console.log(`  PLAN      : ${JSON.stringify(plan)}`)
  console.log(`  FINALPAGE : ${JSON.stringify(finalPage)}`)
  for (let p = 0; p < totalPages; p++) {
    const all = boxEvents.filter((b) => b.page === p)
    if (!all.length) continue
    const deepest = Math.max(...all.map((b) => b.bottom))
    const top = Math.min(...all.map((b) => b.top))
    // Gap = ruang kosong di bawah kotak yang benar-benar digambar.
    console.log(
      `  hal ${String(p + 1).padStart(2)}: kotak top=${top.toFixed(1)} bottom=${deepest.toFixed(1)}` +
      ` tinggi=${(deepest - top).toFixed(1)}  GAP ke bawah halaman=${(G.pageHeight - deepest).toFixed(1)}pt`,
    )
  }
  const outDir = resolve(process.cwd(), 'tmp')
  await fs.mkdir(outDir, { recursive: true })
  const outPath = join(outDir, `diag-gap-${target.contractNo.replace(/[^A-Z0-9]+/gi, '-')}-${reserve ? 'ON' : 'OFF'}.pdf`)
  await fs.writeFile(outPath, Buffer.concat(chunks))

  // Geometri per halaman: kotak TERDALAM yang digambar + teks TERDALAM.
  // Gap yang terlihat = jarak dari teks terakhir halaman N ke teks pertama
  // halaman N+1 (atau ke batas bawah halaman untuk halaman terakhir).
  console.log('  HAL | kotakTop | kotakBottom | teksBawah | sisaKeBawahHalaman')
  for (let p = 0; p < totalPages; p++) {
    const all = boxEvents.filter((b) => b.page === p)
    const texts = textEvents.filter((t) => t.page === p)
    if (!all.length) { console.log(`  ${String(p + 1).padStart(3)} | (tidak ada kotak)`); continue }
    const top = Math.min(...all.map((b) => b.top))
    const bottom = Math.max(...all.map((b) => b.bottom))
    const textBottom = texts.reduce((m, t) => Math.max(m, t.bottom), 0)
    console.log(
      `  ${String(p + 1).padStart(3)} | ${top.toFixed(1).padStart(8)} | ${bottom.toFixed(1).padStart(11)} | ` +
      `${textBottom.toFixed(1).padStart(9)} | ${(G.pageHeight - Math.max(bottom, textBottom)).toFixed(1).padStart(8)}`,
    )
  }

  // Gap antar halaman: jarak dari teks TERAKHIR halaman N ke teks PERTAMA
  // halaman N+1. Ini yang dirasakan pembaca sebagai "ruang kosong".
  console.log('  GAP antar halaman (teks terakhir hal N  ->  teks pertama hal N+1):')
  for (let p = 0; p + 1 < totalPages; p++) {
    const a = textEvents.filter((t) => t.page === p).reduce((m, t) => Math.max(m, t.bottom), 0)
    const bs = textEvents.filter((t) => t.page === p + 1)
    const b = bs.length ? bs.reduce((m, t) => Math.min(m, t.top), Infinity) : NaN
    const last = textEvents.filter((t) => t.page === p).sort((u, v) => v.bottom - u.bottom)[0]
    const first = bs.sort((u, v) => u.top - v.top)[0]
    console.log(
      `    hal ${p + 1} -> ${p + 2}: ${(b - a).toFixed(1).padStart(7)}pt` +
      `   [..\"${last?.sample.slice(-24) ?? ''}\"] -> [\"${first?.sample.slice(0, 24) ?? ''}\"]`,
    )
  }

  return { totalPages, boxEvents }
}

async function main() {
  const needle = process.argv[2] ?? 'UDIN'
  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
  } as any)

  const contracts = await (prisma as any).contract.findMany({
    where: { OR: [{ contractNo: { contains: needle } }, { employee: { fullName: { contains: needle } } }] },
    include: { employee: { include: { jobRole: true } }, template: true },
    take: 10,
  })
  console.log(`KONTRAK cocok "${needle}": ${contracts.length}`)
  for (const c of contracts) {
    const snap = c.templateSnapshot
    console.log(
      `  id=${c.id} no=${c.contractNo} emp=${c.employee?.fullName} template=${c.template?.code}/${c.template?.family} snapshot=${!!(snap?.contentDefinition && c.resolvedTemplateData)}`,
    )
  }

  const target = contracts.find((c: any) => (c.templateSnapshot?.contentDefinition && c.resolvedTemplateData)) ?? contracts[0]
  if (!target) return
  const content = target.templateSnapshot?.contentDefinition ?? {}
  const langs = content?.languages ?? {}
  const blocks: any[] = langs.id ?? langs[Object.keys(langs)[0]] ?? []
  const values = buildValueMap(target.resolvedTemplateData)
  const titleBlock = blocks.find((b: any) => b?.type === 'title')
  const title = (titleBlock?.text ? interpolate(String(titleBlock.text), values) : 'PERJANJIAN').toUpperCase()

  console.log(`TARGET: id=${target.id} no=${target.contractNo} emp=${target.employee?.fullName}`)

  // PDF yang BENAR-BENAR tersimpan untuk kontrak ini (yang dilihat pengguna).
  const saved = join(process.cwd(), 'uploads', 'contracts', String(target.id),
    `${target.contractNo.replace(/\//g, '-')}.pdf`)
  if (existsSync(saved)) {
    const rects = rectsFromPdf(await fs.readFile(saved))
    const boxes = columnBoxes(rects)
    console.log('='.repeat(78))
    console.log(`PDF TERSIMPAN: ${saved}`)
    console.log(`  ${boxes.length} kotak kolom; tinggi kotak per stream:`)
    const byStream = new Map<number, number[]>()
    for (const b of boxes) {
      if (!byStream.has(b.stream)) byStream.set(b.stream, [])
      byStream.get(b.stream)!.push(b.y + b.h)
    }
    for (const [s, ys] of byStream) {
      console.log(`    stream ${s}: bottoms = ${ys.map((v) => v.toFixed(1)).join(', ')}`)
    }
    const lastBox = Math.max(...boxes.map((b) => b.y + b.h))
    console.log(`  KOTAK TERAKHIR (terendah) = ${lastBox.toFixed(1)}pt  (OFF≈670, ON≈551)`)
  } else {
    console.log(`PDF tersimpan tidak ada: ${saved}`)
  }

  await renderWith(target, blocks, values, title, false)
  await renderWith(target, blocks, values, title, true)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
