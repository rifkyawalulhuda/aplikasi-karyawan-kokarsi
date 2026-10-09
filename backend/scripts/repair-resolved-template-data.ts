/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Perbaiki `resolvedTemplateData` kontrak yang tidak lengkap.
 *
 * Akar masalah: placeholder SYSTEM yang dipakai konten tetapi tidak terdaftar
 * di `fieldDefinitions` versi tidak pernah di-resolve, sehingga tercetak
 * `...............` di PDF (padahal pratinjau — memakai data contoh — lengkap).
 *
 * Skrip ini membangun ulang `resolvedTemplateData` (+ `fieldDefinitions` pada
 * snapshot) memakai `TemplateSnapshotService.buildSnapshot()` — sumber yang SAMA
 * dengan jalur pembuatan kontrak — sehingga hasilnya identik dengan kontrak baru.
 *
 * `contentDefinition` pada snapshot TIDAK diubah (konten beku tetap utuh).
 * Field CONTRACT_INPUT yang memang kosong (mis. `ktp_issued_date`) tetap kosong.
 *
 * Default DRY-RUN.
 *   npx ts-node scripts/repair-resolved-template-data.ts
 *   npx ts-node scripts/repair-resolved-template-data.ts --confirm
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan')

import { TemplateSnapshotService } from '../src/contract-templates/template-snapshot.service'

const prisma: any = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
prisma.client = prisma
const CONFIRM = process.argv.includes('--confirm')

const RE = /\{\{\s*([^}]+?)\s*\}\}/g

/** Kumpulkan placeholder yang dipakai konten snapshot. */
function usedPlaceholders(content: any): string[] {
  const out = new Set<string>()
  for (const lang of Object.keys(content?.languages ?? {})) {
    for (const b of content.languages[lang] ?? []) {
      const texts: string[] = []
      if (typeof b?.text === 'string') texts.push(b.text)
      if (typeof b?.heading === 'string') texts.push(b.heading)
      if (Array.isArray(b?.paragraphs)) texts.push(...b.paragraphs.filter((p: any) => typeof p === 'string'))
      if (Array.isArray(b?.items)) for (const it of b.items) texts.push(typeof it === 'string' ? it : (it?.text ?? ''))
      if (Array.isArray(b?.rows)) for (const r of b.rows) for (const v of Object.values(r ?? {})) if (typeof v === 'string') texts.push(v)
      for (const t of texts) { let m: RegExpExecArray | null; const re = new RegExp(RE.source, 'g'); while ((m = re.exec(t)) !== null) out.add(m[1]) }
    }
  }
  return [...out]
}

async function main() {
  const svc = new TemplateSnapshotService(prisma)

  const contracts = await prisma.contract.findMany({
    where: { templateSnapshot: { not: null as any }, templateId: { not: null } },
    include: { employee: { include: { jobRole: true, workLocation: true, department: true } }, template: true },
    orderBy: { id: 'asc' },
  })

  let repaired = 0
  let skipped = 0
  const problems: string[] = []

  for (const c of contracts) {
    const snap = c.templateSnapshot as any
    const content = snap?.contentDefinition
    if (!content) { skipped++; continue }
    const used = usedPlaceholders(content)
    const resolved = (c.resolvedTemplateData ?? {}) as Record<string, any>
    const missing = used.filter(k => !(k in resolved))
    if (missing.length === 0) { skipped++; continue }

    console.log(`#${c.id} ${c.template?.code} ${c.contractNo}`)
    console.log(`   hilang: ${missing.join(', ')}`)

    // Field CONTRACT_INPUT memang milik kontrak (data yang diisi petugas).
    const templateData: Record<string, any> = {}
    for (const [k, v] of Object.entries(resolved)) {
      if (k.startsWith('custom.')) {
        const raw = v && typeof v === 'object' && 'value' in (v as any) ? (v as any).value : v
        templateData[k.slice('custom.'.length)] = raw
      }
    }
    const input = {
      templateId: c.templateId as number,
      employee: c.employee,
      contract: {
        contractNo: c.contractNo,
        startDate: c.startDate,
        endDate: c.endDate,
        signedDate: c.signedDate,
        baseCompensation: c.baseCompensation,
      },
      templateData,
    }
    let rebuilt: any
    try {
      rebuilt = await svc.rebuildWithContent(input, content, snap?.fieldDefinitions ?? [])
    } catch (e: any) {
      problems.push(`#${c.id}: ${e?.message}`)
      console.log(`   GAGAL membangun ulang: ${e?.message}`)
      continue
    }
    if (!rebuilt) { console.log('   (template tidak ditemukan)'); continue }

    const recovered = used.filter(k => !(k in resolved) && k in rebuilt.resolvedTemplateData)
    console.log(`   pulih: ${recovered.join(', ') || '(tidak ada)'}`)

    if (CONFIRM) {
      await prisma.contract.update({
        where: { id: c.id },
        data: {
          resolvedTemplateData: rebuilt.resolvedTemplateData as any,
          templateSnapshot: rebuilt.templateSnapshot as any,
        },
      })
    }
    repaired++
  }

  console.log(`\nKontrak diperbaiki : ${repaired}`)
  console.log(`Dilewati (lengkap) : ${skipped}`)
  if (problems.length) console.log(`Bermasalah         : ${problems.length}`)
  console.log(CONFIRM ? '\nSELESAI.' : '\nDRY-RUN. Tambahkan --confirm untuk menulis.')
}

main().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
