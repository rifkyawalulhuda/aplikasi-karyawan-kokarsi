/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pindai TABRAKAN penanda inline pada seluruh versi template kontrak.
 *
 * Latar: pemformatan inline (Fase 1–2) menafsirkan `**bold**`, `*italic*`, dan
 * `__underline__` di dalam teks `paragraph` / `article.paragraphs`. Teks legal
 * warisan yang kebetulan memuat karakter itu (mis. `**PERHATIAN**` yang memang
 * dimaksudkan tercetak dengan bintang) akan BERUBAH TAMPILAN saat fitur
 * dinyalakan, dan validator Fase 3 kini MENOLAK mark di lokasi yang tidak
 * didukung (heading pasal, list, tabel, title/subtitle, signature, pageBreak).
 *
 * Skrip ini memetakan keduanya SEBELUM editor dinyalakan, supaya setiap temuan
 * bisa dievaluasi manual (lihat rencana, gerbang Fase 3 butir 16).
 *
 * HANYA MEMBACA. Tidak ada `--confirm`, tidak ada tulis apa pun.
 *
 * Pemakaian (dari `backend/`):
 *   npx ts-node scripts/scan-inline-mark-collisions.ts
 *   npx ts-node scripts/scan-inline-mark-collisions.ts --family=MITRA
 *   npx ts-node scripts/scan-inline-mark-collisions.ts --status=PUBLISHED
 *   npx ts-node scripts/scan-inline-mark-collisions.ts --json
 *   npx ts-node scripts/scan-inline-mark-collisions.ts --strict   # exit 1 bila ada temuan blocking
 *
 * Klasifikasi temuan:
 *   blocking  — mark SAH di lokasi yang tidak didukung renderer → publish ditolak.
 *   align     — `align` bernilai tak dikenal atau dipasang pada tipe blok yang
 *               tidak mendukungnya → publish ditolak.
 *   warning   — delimiter tidak berpasangan di lokasi yang didukung → dicetak
 *               literal, tidak memblokir.
 *   info      — mark sah di lokasi yang didukung → akan TERFORMAT mulai sekarang.
 *               Inilah "tabrakan" yang harus dievaluasi manusia per temuan.
 */
import { config } from 'dotenv'
import { resolve } from 'path'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { hasInlineMarks, validateInlineMarks } from '../src/contracts/inline-marks'
import { ALIGN_CAPABLE_BLOCKS, blockAlign } from '../src/contract-templates/template-schema.validator'

config({ path: resolve(__dirname, '../.env') })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)

const argv = process.argv.slice(2)
const flags = {
  json: argv.includes('--json'),
  strict: argv.includes('--strict'),
  family: argv.find(a => a.startsWith('--family='))?.slice('--family='.length).toUpperCase(),
  status: argv.find(a => a.startsWith('--status='))?.slice('--status='.length).toUpperCase(),
}

/** Satu teks yang bisa dipindai, beserta jalur dan aturan mark-nya. */
interface TextTarget {
  path: string
  text: string
  allowMarks: boolean
}

/**
 * Ambil seluruh nilai teks sebuah blok.
 *
 * Pemetaan ini SENGAJA meniru `validateContentDefinition()`
 * (`src/contract-templates/template-schema.validator.ts`) agar laporan skrip
 * ini sama dengan yang akan ditolak/diterima publish. Bila aturan validator
 * berubah, ubah juga di sini.
 */
function textTargets(block: any, blockPath: string): TextTarget[] {
  const out: TextTarget[] = []
  const push = (path: string, text: unknown, allowMarks: boolean) => {
    if (typeof text === 'string') out.push({ path, text, allowMarks })
  }

  if (block?.type === 'signature' || block?.type === 'pageBreak') {
    for (const [key, value] of Object.entries(block)) push(`${blockPath}.${key}`, value, false)
  }
  if (block?.type === 'title' || block?.type === 'subtitle') {
    push(`${blockPath}.text`, block.text, false)
  }
  if (block?.type === 'article') {
    push(`${blockPath}.heading`, block.heading, false)
    ;(block.paragraphs ?? []).forEach((p: any, i: number) => push(`${blockPath}.paragraphs[${i}]`, p, true))
  }
  if (block?.type === 'list') {
    ;(block.items ?? []).forEach((item: any, i: number) => {
      typeof item === 'string'
        ? push(`${blockPath}.items[${i}]`, item, false)
        : push(`${blockPath}.items[${i}].text`, item?.text, false)
    })
  }
  if (block?.type === 'table') {
    ;(block.columns ?? []).forEach((col: any, i: number) => push(`${blockPath}.columns[${i}].label`, col?.label, false))
    ;(block.rows ?? []).forEach((row: any, r: number) => {
      for (const [key, value] of Object.entries(row ?? {})) push(`${blockPath}.rows[${r}].${key}`, value, false)
    })
  }
  if (block?.type === 'paragraph') push(`${blockPath}.text`, block.text, true)

  return out
}

/** Potongan teks untuk laporan — cukup panjang untuk mengenali konteksnya. */
function excerpt(text: string, width = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat
}

interface Finding {
  severity: 'blocking' | 'align' | 'warning' | 'info'
  path: string
  message: string
  excerpt: string
}

/** Pindai satu `contentDefinition`; kembalikan temuan tanpa melempar apa pun. */
function scanContent(content: any): Finding[] {
  const findings: Finding[] = []
  const languages = content?.languages
  if (!languages || typeof languages !== 'object') {
    return [{ severity: 'blocking', path: 'languages', message: 'contentDefinition tidak memiliki `languages`', excerpt: '' }]
  }

  for (const lang of Object.keys(languages)) {
    const blocks = languages[lang]
    if (!Array.isArray(blocks)) continue

    blocks.forEach((block: any, idx: number) => {
      const blockPath = `languages.${lang}[${idx}]${block?.id ? `#${block.id}` : ''}`

      // 1) Properti `align` — nilainya dan tipe blok yang membolehkannya.
      if (block && block.align !== undefined) {
        if (blockAlign(block.align) === undefined) {
          findings.push({
            severity: 'align',
            path: `${blockPath}.align`,
            message: `Nilai align "${String(block.align)}" tidak valid (harus left/center/right/justify)`,
            excerpt: '',
          })
        } else if (!(ALIGN_CAPABLE_BLOCKS as readonly string[]).includes(block.type)) {
          findings.push({
            severity: 'align',
            path: `${blockPath}.align`,
            message: `align="${String(block.align)}" pada blok ${String(block.type)} — tidak didukung, ditolak validator`,
            excerpt: '',
          })
        }
      }

      // 2) Penanda inline per nilai teks.
      for (const target of textTargets(block, blockPath)) {
        const { issues } = validateInlineMarks(target.text, {
          allowMarks: target.allowMarks,
          location: target.path,
        })
        const marked = hasInlineMarks(target.text)

        if (!target.allowMarks) {
          // Lokasi tanpa dukungan mark: hanya mark SAH yang jadi error validator.
          if (marked) {
            findings.push({
              severity: 'blocking',
              path: target.path,
              message: 'Penanda format pada lokasi yang tidak didukung → publish akan DITOLAK',
              excerpt: excerpt(target.text),
            })
          }
          continue
        }

        if (marked) {
          findings.push({
            severity: 'info',
            path: target.path,
            message: 'Penanda format sah pada teks yang didukung → akan TERFORMAT mulai fase ini',
            excerpt: excerpt(target.text),
          })
        }
        for (const issue of issues) {
          if (issue.severity === 'warning') {
            findings.push({
              severity: 'warning',
              path: target.path,
              message: issue.message,
              excerpt: excerpt(target.text),
            })
          }
        }
      }
    })
  }

  return findings
}

const ORDER: Record<Finding['severity'], number> = { blocking: 0, align: 1, warning: 2, info: 3 }

async function main() {
  const versions = await prisma.contractTemplateVersion.findMany({
    include: { template: { select: { name: true, code: true, family: true, isActive: true } } },
    orderBy: [{ templateId: 'asc' }, { versionNumber: 'asc' }],
  })

  const scoped = versions.filter(v =>
    (!flags.family || v.template.family === flags.family)
    && (!flags.status || v.status === flags.status))

  type Row = Finding & {
    versionId: number
    versionNumber: number
    status: string
    template: string
    family: string
  }

  const rows: Row[] = []
  for (const version of scoped) {
    for (const finding of scanContent(version.contentDefinition)) {
      rows.push({
        ...finding,
        versionId: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        template: version.template.name,
        family: version.template.family,
      })
    }
  }

  rows.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]
    || a.family.localeCompare(b.family)
    || a.template.localeCompare(b.template)
    || a.versionNumber - b.versionNumber
    || a.path.localeCompare(b.path))

  if (flags.json) {
    console.log(JSON.stringify({ scanned: scoped.length, total: rows.length, findings: rows }, null, 2))
  } else {
    console.log(`Menycan ${scoped.length} versi template (dari ${versions.length} total) — HANYA MEMBACA, tidak ada perubahan DB.\n`)
    if (rows.length === 0) {
      console.log('TIDAK ADA temuan. Tidak ada teks existing yang terpengaruh penanda inline.')
    }
    let current = ''
    for (const row of rows) {
      const head = `${row.family} · ${row.template} · v${row.versionNumber} (${row.status}, id ${row.versionId})`
      if (head !== current) {
        current = head
        console.log(`\n=== ${head} ===`)
      }
      console.log(`  [${row.severity.toUpperCase()}] ${row.path}`)
      console.log(`     ${row.message}`)
      if (row.excerpt) console.log(`     teks: ${row.excerpt}`)
    }
    const tally = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.severity] = (acc[row.severity] ?? 0) + 1
      return acc
    }, {})
    console.log('\nRingkasan: '
      + `blocking=${tally.blocking ?? 0} align=${tally.align ?? 0} warning=${tally.warning ?? 0} info=${tally.info ?? 0}`)
    console.log('Langkah berikutnya: evaluasi setiap temuan BLOCKING/ALIGN sebelum editor dinyalakan; '
      + 'temuan INFO adalah teks yang tampilannya akan berubah (bold/italic/underline).')
  }

  const blocking = rows.filter(row => row.severity === 'blocking' || row.severity === 'align').length
  if (flags.strict && blocking > 0) {
    console.error(`\n--strict: ${blocking} temuan harus diselesaikan sebelum fitur dinyalakan.`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

