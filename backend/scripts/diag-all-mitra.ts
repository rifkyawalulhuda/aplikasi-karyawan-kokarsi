/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/first */
/**
 * REGRESI (read-only): render SEMUA template MITRA nyata lewat jalur produksi
 * dan laporkan halaman + apakah tanda tangan menambah halaman / menembus kotak.
 *
 * Jalankan: npx ts-node --project tsconfig.scripts.json scripts/diag-all-mitra.ts
 */
import { config } from 'dotenv'
import { resolve, join } from 'path'
import { promises as fs, existsSync } from 'fs'
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

async function renderOne(target: any) {
  const content = target.templateSnapshot?.contentDefinition ?? {}
  const langs = content?.languages ?? {}
  const blocks: any[] = langs.id ?? langs[Object.keys(langs)[0]] ?? []
  if (!blocks.length) return null
  const values = buildValueMap(target.resolvedTemplateData)
  const titleBlock = blocks.find((b: any) => b?.type === 'title')
  const title = (titleBlock?.text ? interpolate(String(titleBlock.text), values) : 'PERJANJIAN').toUpperCase()

  const doc = new PDFDocument({
    size: [G.pageWidth, G.pageHeight],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    autoFirstPage: true,
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<void>((res) => doc.on('end', () => res()))

  const boxes: Array<{ stream: number, top: number, bottom: number }> = []
  let pending: any = null
  let page = 0
  const realAdd = doc.addPage.bind(doc)
  ;(doc as any).addPage = (...a: any[]) => { const r = realAdd(...a); page += 1; return r }
  const realSwitch = doc.switchToPage.bind(doc)
  ;(doc as any).switchToPage = (...a: any[]) => { const r = realSwitch(...a); if (typeof a[0] === 'number') page = a[0]; return r }
  const isCol = (x: number) => Math.abs(x - G.left.x0) < 1 || Math.abs(x - G.right.x0) < 1
  const realRect = doc.rect.bind(doc)
  ;(doc as any).rect = (x: number, y: number, w: number, h: number, ...rest: any[]) => {
    pending = isCol(x) ? { stream: page, top: y, bottom: y + h } : null
    return realRect(x, y, w, h, ...rest)
  }
  const realStroke = doc.stroke.bind(doc)
  ;(doc as any).stroke = (...a: any[]) => {
    if (pending) { boxes.push(pending); pending = null }
    return realStroke(...a)
  }

  renderMitraDocumentInto(doc, {
    blocks,
    values,
    fallbackTitle: target.template?.name,
    numberLabel: `${MITRA_HEADER_CHROME.numberPrefix} ${target.contractNo}`,
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
  })

  const pages = doc.bufferedPageRange().count
  const plan = (doc as any).__mitraSplit
  const fin = (doc as any).__mitraFinalPage
  const sig = (doc as any).__mitraSignatureBox
  doc.end()
  await done
  return { pages, plan, fin, sig, boxes }
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
  } as any)

  const contracts = await (prisma as any).contract.findMany({
    where: { templateSnapshot: { not: null } },
    include: { employee: { include: { jobRole: true } }, template: true },
    orderBy: { id: 'asc' },
  })
  const targets = contracts.filter((c: any) => c.templateSnapshot?.contentDefinition && c.resolvedTemplateData)
  console.log(`${targets.length} kontrak dengan snapshot.\n`)
  console.log('id   | no                              | hal | planPages | reserve | sigPage | sigTop-bot   | boxBottom | OK')
  console.log('-'.repeat(118))
  for (const t of targets) {
    const r = await renderOne(t)
    if (!r) { console.log(`${t.id} | (tanpa blok id)`); continue }
    const sigOk = r.sig && r.sig.page <= r.pages - 1 && r.sig.top >= r.sig.boxBottomOnLast - 0.01
    const noExtra = r.sig ? r.sig.page === r.pages - 1 : true
    const ok = r.pages === r.plan?.pageCount && sigOk && noExtra
    console.log(
      `${String(t.id).padStart(4)} | ${String(t.contractNo).padEnd(31)} | ${String(r.pages).padStart(3)} | ` +
      `${String(r.plan?.pageCount).padStart(9)} | ${String(r.plan?.reserveShrink ?? '-').padStart(7)} | ` +
      `${(r.sig ? String(r.sig.page + 1) : '?').padStart(7)} | ` +
      `${(r.sig ? `${r.sig.top.toFixed(1)}-${r.sig.bottom.toFixed(1)}` : '-').padStart(12)} | ` +
      `${(r.fin ? r.fin.lastPageBoxBottom.toFixed(1) : '-').padStart(9)} | ${ok ? 'OK' : 'FAIL'}`,
    )
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
