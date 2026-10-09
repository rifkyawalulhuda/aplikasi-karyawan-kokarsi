/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DIAGNOSTIK (read-only): ukur geometri PDF MASTER (acuan desain) supaya target
 * layout dapat dibandingkan angka-per-angka, bukan ditebak.
 *
 * Jalankan: npx ts-node --project tsconfig.scripts.json scripts/diag-master-pdf.ts "path/master.pdf"
 */
import { promises as fs } from 'fs'
import { resolve } from 'path'
import zlib from 'zlib'

interface R { stream: number, x: number, y: number, w: number, h: number }

/** Kumpulkan operator `re` dari semua content stream (FlateDecode didukung). */
function rectsFromPdf(buf: Buffer): R[] {
  const out: R[] = []
  const raw = buf.toString('latin1')
  const objRe = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g
  let m: RegExpExecArray | null
  const streams: string[] = []
  while ((m = objRe.exec(raw)) !== null) {
    const sm = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(m[2])
    if (!sm) continue
    let body = sm[1]
    if (/FlateDecode/.test(m[2])) {
      try { body = zlib.inflateSync(Buffer.from(sm[1], 'latin1')).toString('latin1') }
      catch { try { body = zlib.inflateRawSync(Buffer.from(sm[1], 'latin1')).toString('latin1') } catch { continue } }
    }
    if (/(^|\s)re(\s|$)/.test(body)) streams.push(body)
  }
  streams.forEach((s, idx) => {
    const re = /([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+re/g
    let r: RegExpExecArray | null
    while ((r = re.exec(s)) !== null) out.push({ stream: idx, x: +r[1], y: +r[2], w: +r[3], h: +r[4] })
  })
  return out
}

async function main() {
  const p = resolve(process.argv[2] ?? '')
  const buf = await fs.readFile(p)
  const txt = buf.toString('latin1')
  const pages = (txt.match(/\/Type\s*\/Page[^s]/g) ?? []).length
  const mediaBox = /\/MediaBox\s*\[([^\]]+)\]/.exec(txt)?.[1]?.trim()
  const rects = rectsFromPdf(buf)

  console.log(`PDF   : ${p}`)
  console.log(`HAL   : ${pages}`)
  console.log(`MEDIA : [${mediaBox}]`)
  console.log(`RECT  : ${rects.length} operator`)
  console.log('')
  const byStream = new Map<number, R[]>()
  for (const r of rects) {
    if (!byStream.has(r.stream)) byStream.set(r.stream, [])
    byStream.get(r.stream)!.push(r)
  }
  for (const [s, rs] of [...byStream.entries()].sort((a, b) => a[0] - b[0])) {
    // Kelompokkan per lebar (kotak kolom punya lebar khas, tabel tanda tangan lain).
    const byW = new Map<string, R[]>()
    for (const r of rs) {
      const k = r.w.toFixed(1)
      if (!byW.has(k)) byW.set(k, [])
      byW.get(k)!.push(r)
    }
    const parts = [...byW.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([w, list]) => {
        const tops = list.map((r) => r.y)
        const bots = list.map((r) => r.y + r.h)
        return `w=${w} x=${list[0].x.toFixed(1)} n=${list.length} yTop=${Math.min(...tops).toFixed(1)} yBot=${Math.max(...bots).toFixed(1)}`
      })
    console.log(`stream ${s} (hal ${s + 1}):`)
    for (const p2 of parts) console.log(`    ${p2}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
