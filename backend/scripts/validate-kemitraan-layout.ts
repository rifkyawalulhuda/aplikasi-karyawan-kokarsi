/**
 * Harness validasi layout "Perjanjian Kemitraan".
 *
 * Merender MITRA_DRIVER memakai mesin layout baru (mitra-layout.engine.ts)
 * dengan konten dari Template Kontrak, lalu mengukur hasilnya secara
 * programmatic terhadap geometri master.
 *
 * Jalankan: npx ts-node scripts/validate-kemitraan-layout.ts
 */
import PDFDocument from 'pdfkit'
import { promises as fs } from 'fs'
import { join, resolve } from 'path'
import { definitionToContentDefinition } from '../src/contract-templates/default-template-definition'
import { getContractDocumentDefinition } from '../src/contracts/contract-document-definitions'
import { renderMitraLayout, renderMitraSignature, MITRA_GEOMETRY } from '../src/contracts/mitra-layout.engine'
import { MITRA_PREVIEW_VALUES } from '../src/contracts/mitra-preview-sample'

const FONT_DIR = process.env.FONT_DIR
  ?? (process.platform === 'win32' ? 'C:/Windows/Fonts' : '/usr/share/fonts/truetype/msttcorefonts')

const ASSET_ROOT = resolve(process.cwd(), 'assets')

/** Nilai placeholder contoh (dynamic data) — SATU sumber dengan pratinjau editor. */
const SAMPLE_VALUES: Record<string, string> = MITRA_PREVIEW_VALUES

async function main() {
  const def = getContractDocumentDefinition('MITRA_DRIVER')
  if (!def) throw new Error('MITRA_DRIVER definition not found')

  const content = definitionToContentDefinition(def)
  const blocks = content.languages.id

  const outPath = resolve(process.cwd(), 'tmp', 'perjanjian-kemitraan-generated.pdf')
  await fs.mkdir(resolve(process.cwd(), 'tmp'), { recursive: true })

  const doc = new PDFDocument({
    size: [MITRA_GEOMETRY.pageWidth, MITRA_GEOMETRY.pageHeight],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    autoFirstPage: true,
  })

  const buffers: Buffer[] = []
  doc.on('data', (chunk: Buffer) => {
    buffers.push(chunk)
  })
  const done = new Promise<void>((res) => doc.on('end', () => res()))

  const numberLabel = `Nomor: ${SAMPLE_VALUES['contract.contractNo']}`
  const dateLabel = `Tanggal ${SAMPLE_VALUES['contract.startDate']}`

  renderMitraLayout(doc, blocks, {
    values: SAMPLE_VALUES,
    title: def.title,
    numberLabel,
    dateLabel,
    logoPath: join(ASSET_ROOT, 'contract-logo-mitra.jpg'),
    fonts: {
      regular: join(FONT_DIR, 'times.ttf'),
      bold: join(FONT_DIR, 'timesbd.ttf'),
      italic: join(FONT_DIR, 'timesi.ttf'),
    },
  })

  renderMitraSignature(doc, {
    leftHeader: "KOPERASI PT. SANKYU INT'L",
    leftName: SAMPLE_VALUES['settings.cooperativeChairmanName'],
    leftRole: '(Ketua Koperasi)',
    rightHeader: 'MITRA',
    rightName: SAMPLE_VALUES['employee.fullName'],
    rightRole: `( ${SAMPLE_VALUES['employee.jobRole']} )`,
  })

  doc.end()
  await done
  await fs.writeFile(outPath, Buffer.concat(buffers))
  console.log('WROTE', outPath)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
