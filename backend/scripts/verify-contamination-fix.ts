/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/first */
/**
 * Verifikasi end-to-end: bangun payload dokumen lewat service produksi untuk
 * kontrak 60/61/119, lalu pastikan teks yang akan tercetak bebas kontaminan.
 * Ini menempuh jalur render sebenarnya (loadContract → snapshot → definition),
 * bukan sekadar membaca kolom snapshot.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

config({ path: resolve(__dirname, '../.env') })

import { ContractDocumentService } from '../src/contracts/contract-document.service'
import { SettingsService } from '../src/settings/settings.service'
import { validateContentDefinition } from '../src/contract-templates/template-schema.validator'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)

async function main() {
  const prismaService = prisma as any
  const settings = new SettingsService(prismaService)
  const service = new ContractDocumentService(prismaService, settings)

  for (const id of [60, 61, 119]) {
    const payload = await (service as any).loadContract(id)
    const text = JSON.stringify(payload.definition) + JSON.stringify(payload.meta)

    // Kontaminan murni — WAJIB nol.
    const contaminants = ['HAHAHA', 'Pengusaha11', 'very stabilll', 'setabilll']
      .filter(t => text.includes(t))
    // Override yang disengaja pemilik template — dibiarkan apa adanya.
    const intentional = ['Driver ajaa'].filter(t => text.includes(t))

    console.log(`kontrak ${id}: missingFields=${payload.missingFields.length}`
      + ` kontaminan=${contaminants.length ? contaminants.join(',') : 'TIDAK ADA'}`
      + ` override-disengaja=[${intentional.join(',')}]`)
    if (contaminants.length) process.exitCode = 1

    // Versi template yang tertaut harus lolos validator skema.
    const version = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: payload.contract.templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' }
    })
    if (version) {
      const template = await prisma.contractTemplate.findUnique({ where: { id: version.templateId } })
      const keys = (Array.isArray(version.fieldDefinitions) ? version.fieldDefinitions : (version.fieldDefinitions as any)?.fields ?? [])
        .filter((f: any) => f?.key).map((f: any) => String(f.key))
      try {
        const res = validateContentDefinition(version.contentDefinition, keys, template?.family as any)
        console.log(`  versi v${version.versionNumber}: valid (${res.blockCount} blok, ${res.placeholderCount} placeholder)`)
      } catch (e) {
        console.log(`  versi v${version.versionNumber}: TIDAK VALID — ${(e as Error).message}`)
        process.exitCode = 1
      }
    }
  }

  // Judul/roleLabel yang disengaja harus TETAP ada (bukan ikut terhapus).
  const t17142 = await prisma.contractTemplate.findUnique({ where: { id: 17142 } })
  const overrides = t17142?.contentOverrides as any
  const preserved = overrides?.roleLabel === 'Driver ajaa'
  console.log(`override sengaja dipertahankan (roleLabel='Driver ajaa'): ${preserved}`)
  if (!preserved) process.exitCode = 1

  // ---- DoD #10: membuktikan penghapusan jalur runtime `contentOverrides`
  // TIDAK mengubah output PDF kontrak yang ada.
  //
  // PENTING — apa yang benar-benar menentukan output:
  //   * Kontrak ber-snapshot dirender lewat `renderSnapshotPdf` dan HANYA memakai
  //     `definition.title/subtitle` + `templateSnapshot.contentDefinition`.
  //   * `definition.recitals/roleLabel/firstPartyLabel/...` TIDAK dibaca oleh
  //     `renderSnapshotPdf`, jadi membandingkan objek `definition` secara utuh
  //     akan menghasilkan false positive (legacy-merge ≠ snapshot di key yang
  //     memang tidak dipakai).
  // Jadi yang benar-benar diuji di sini: (a) jalur render yang dipakai, dan
  // (b) apakah teks khas override legacy bocor ke output kontrak ber-snapshot.
  interface CloneableContract {
    templateSnapshot: any
    resolvedTemplateData: any
  }

  const legacyMarkers = ['Driver ajaa', 'Pengusaha11', 'HAHAHA', 'setabilll', 'very stabilll']
  let adaBocor = 0

  for (const id of [60, 61, 119]) {
    const contract = (await prisma.contract.findUnique({ where: { id } })) as unknown as CloneableContract | null
    const pakaiSnapshot = !!(contract?.templateSnapshot?.contentDefinition && contract?.resolvedTemplateData)
    const payload = await (service as any).loadContract(id)
    const outputText = JSON.stringify(payload.definition) + JSON.stringify(payload.meta)
    const bocor = legacyMarkers.filter(t => outputText.includes(t))

    console.log(`DoD #10 kontrak ${id}: render=${pakaiSnapshot ? 'renderSnapshotPdf (snapshot)' : 'legacy'}`
      + ` bocor-override-legacy=${bocor.length ? bocor.join(',') : 'TIDAK ADA'}`)
    if (!pakaiSnapshot || bocor.length) adaBocor++
  }

  if (adaBocor) {
    console.log(`  → ${adaBocor} kontrak masih bergantung pada jalur legacy/override; penghapusan TIDAK aman.`)
    process.exitCode = 1
  } else {
    console.log('  → semua kontrak ber-snapshot & bebas override legacy: penghapusan jalur runtime aman.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
