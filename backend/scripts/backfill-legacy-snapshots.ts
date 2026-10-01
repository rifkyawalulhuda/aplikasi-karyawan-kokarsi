/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Penutupan rollout: lengkapi kontrak legacy tanpa `templateSnapshot`.
 *
 * Kontrak lama (dibuat sebelum Phase 3) masih dirender lewat jalur hard-code
 * (`renderPkwtPdf` / `renderMitraPdf`) sehingga PDF-nya bisa berubah bila admin
 * mengedit template — pelanggaran prinsip "PDF lama tidak boleh memakai template
 * baru". Skrip ini membangun snapshot immutable dari versi PUBLISHED template
 * yang tertaut, memakai ULANG logika produksi (TemplateSnapshotService) supaya
 * tidak ada jalur kedua yang bisa menyimpang.
 *
 * Idempoten: kontrak yang sudah punya `templateSnapshot.contentDefinition`
 * dilewati. Jalankan `--dry-run` untuk melihat rencana tanpa menulis.
 *
 * Pemakaian:
 *   npx ts-node scripts/backfill-legacy-snapshots.ts --dry-run
 *   npx ts-node scripts/backfill-legacy-snapshots.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })

import { TemplateSnapshotService } from '../src/contract-templates/template-snapshot.service'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const snapshotService = new TemplateSnapshotService(prisma as any)

  // ---- Preflight: pastikan tidak ada kontrak legacy yang akan kehilangan
  // jalur render saat gate kontaminasi aktif. Setiap template yang BENAR-BENAR
  // dipakai kontrak WAJIB punya versi PUBLISHED, kalau tidak `loadContract`
  // akan melempar "Template key ... belum terdaftar di generator dokumen".
  const usedTemplateIds = await prisma.contract.findMany({
    where: { templateId: { not: null } },
    select: { templateId: true },
    distinct: ['templateId'],
  })
  const ids = usedTemplateIds.map(r => r.templateId as number)
  const templatesUsed = await prisma.contractTemplate.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      templateKey: true,
      versions: { where: { status: 'PUBLISHED' }, select: { id: true } },
    },
  })
  const withoutPublished = templatesUsed.filter(t => t.versions.length === 0)
  if (withoutPublished.length) {
    console.error('PREFLIGHT GAGAL: template berikut dipakai kontrak tetapi tidak punya')
    console.error('versi PUBLISHED, sehingga kontrak legacy yang tertaut tidak bisa di-snapshot:')
    for (const t of withoutPublished) console.error(`  id=${t.id} code=${t.code} key=${t.templateKey}`)
    console.error('Jalankan rollout/bootstrap versi terlebih dahulu.')
    process.exit(1)
  }
  console.log(`preflight OK: ${templatesUsed.length} template dipakai kontrak, semua punya versi PUBLISHED`)

  const contracts = await prisma.contract.findMany({

    where: { templateId: { not: null } },
    include: {
      employee: {
        include: {
          jobRole: { select: { id: true, name: true } },
          workLocation: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          jobLevel: { select: { id: true, name: true } },
        },
      },
      template: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'asc' },
  })

  console.log(`kontrak ber-templateId: ${contracts.length}${dryRun ? ' (DRY RUN)' : ''}`)

  let sudah = 0
  let dibuat = 0
  let terlewat: Array<{ id: number; contractNo: string; alasan: string }> = []

  for (const contract of contracts) {
    const snapshot = contract.templateSnapshot as any
    if (snapshot?.contentDefinition) {
      sudah++
      continue
    }

    let built: Awaited<ReturnType<TemplateSnapshotService['buildSnapshot']>> = null
    try {
      built = await snapshotService.buildSnapshot({
        templateId: contract.templateId as number,
        employee: contract.employee ?? undefined,
        contract: {
          contractNo: contract.contractNo,
          startDate: contract.startDate,
          endDate: contract.endDate,
          signedDate: contract.signedDate ?? null,
          baseCompensation: contract.baseCompensation ?? null,
        },
        templateData: (contract.templateData as Record<string, any> | null) ?? null,
      })
    } catch (error: any) {
      // Field wajib tidak tersedia → kontrak ini memang tidak dapat di-snapshot
      // tanpa melengkapi data karyawan. Laporkan, jangan gagalkan seluruh batch.
      terlewat.push({
        id: contract.id,
        contractNo: contract.contractNo,
        alasan: error?.message ?? String(error),
      })
      continue
    }

    if (!built) {
      terlewat.push({
        id: contract.id,
        contractNo: contract.contractNo,
        alasan: `template ${contract.template?.code ?? contract.templateId} tidak punya versi PUBLISHED`,
      })
      continue
    }

    console.log(`  + kontrak ${contract.id} (${contract.contractNo}) ← template ${contract.template?.code} v${built.templateSnapshot.templateVersionNumber}`)
    if (!dryRun) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          templateVersionId: built.templateVersionId,
          templateSnapshot: built.templateSnapshot as any,
          resolvedTemplateData: built.resolvedTemplateData as any,
        },
      })
    }
    dibuat++
  }

  console.log(`\nringkasan: sudah punya snapshot=${sudah} | ${dryRun ? 'akan dibuat' : 'dibuat'}=${dibuat} | terlewat=${terlewat.length}`)
  for (const item of terlewat) {
    console.log(`  ! kontrak ${item.id} (${item.contractNo}): ${item.alasan}`)
  }

  if (terlewat.length) {
    console.log('\nCatatan: kontrak "terlewat" perlu dilengkapi dulu data karyawannya')
    console.log('(NIK / tempat lahir / alamat sesuai fieldDefinitions wajib versi PUBLISHED),')
    console.log('lalu jalankan ulang skrip ini.')
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('GAGAL:', error)
    process.exit(1)
  })
