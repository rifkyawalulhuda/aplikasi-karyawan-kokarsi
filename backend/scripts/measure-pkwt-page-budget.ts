/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Ukur ANGGARAN HALAMAN PKWT: sweep `lineGap` x `blockGap` dan laporkan jumlah
 * halaman keempat varian PKWT bawaan.
 *
 * Kenapa alat ini ada: `PKWT_GEOMETRY.blockGap` punya **plafon keras** yang
 * bergerak setiap kali jumlah blok berubah — menambah satu blok saja bisa
 * memindahkan seluruh dokumen ke halaman 5, dan satu halaman tambahan pada
 * kontrak legal berarti satu lembar yang ikut ditandatangani. Jangan menaikkan
 * `blockGap`/`lineGap` berdasarkan perkiraan; ukur di sini.
 *
 * `PKWT_GEOMETRY` bertipe `as const` (batasan tipe saja), jadi objeknya masih
 * dapat diubah saat runtime dari skrip ini — itulah yang memungkinkan sweep
 * tanpa mengubah sumber.
 *
 * Jalankan: npx ts-node --transpile-only scripts/measure-pkwt-page-budget.ts
 */
import { CONTRACT_DOCUMENT_DEFINITIONS, getContractDocumentDefinition } from '../src/contracts/contract-document-definitions'
import { definitionToContentDefinition } from '../src/contract-templates/default-template-definition'
import { createPkwtPdfBuffer, resolvePkwtFonts } from '../src/contracts/pkwt-document.renderer'
import { PKWT_GEOMETRY, PKWT_HEADER_CHROME } from '../src/contracts/pkwt-layout.engine'
import { PKWT_PREVIEW_VALUES, PKWT_PREVIEW_VALUES_EN } from '../src/contracts/pkwt-preview-sample'

const geometry = PKWT_GEOMETRY as any
const keys = Object.keys(CONTRACT_DOCUMENT_DEFINITIONS).filter(k => k.startsWith('PKWT_'))

/**
 * Hitung halaman dari buffer TANPA python — sweep ini butuh puluhan pengukuran,
 * dan memanggil pdfplumber tiap kali membuatnya kehabisan waktu. Pola `/Type
 * /Page` (bukan `/Pages`) sama dengan yang dipakai `pkwt-document.renderer.spec.ts`.
 */
function countPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

async function pagesFor(key: string): Promise<number> {
  const content = definitionToContentDefinition(getContractDocumentDefinition(key))
  const buffer = await createPkwtPdfBuffer({
    blocks: content?.languages?.id ?? [],
    blocksEn: content?.languages?.en ?? [],
    values: { ...PKWT_PREVIEW_VALUES },
    valuesEn: { ...PKWT_PREVIEW_VALUES_EN },
    orgLines: [...PKWT_HEADER_CHROME.org],
    addressLines: [...PKWT_HEADER_CHROME.address],
    contactLine: PKWT_HEADER_CHROME.contactLine,
    numberLabel: `${PKWT_HEADER_CHROME.numberPrefix} 174/KUKP-SII/VII/2026`,
    fonts: resolvePkwtFonts(),
    signature: {
      leftTitle: PKWT_HEADER_CHROME.signature.leftTitle,
      rightTitle: PKWT_HEADER_CHROME.signature.rightTitle,
      leftName: PKWT_PREVIEW_VALUES['employee.fullName'],
      leftRole: PKWT_PREVIEW_VALUES['employee.jobRole'],
      rightName: PKWT_PREVIEW_VALUES['settings.cooperativeChairmanName'],
      rightRole: PKWT_HEADER_CHROME.signature.rightRoleLabel,
    },
  })
  return countPages(buffer)
}

async function main() {
  // Nilai saat ini diikutkan lebih dulu supaya hasilnya bisa dibandingkan
  // langsung dengan keadaan sumber.
  const lineGaps = [...new Set([PKWT_GEOMETRY.lineGap, 1.6, 1.4, 1.2, 1.0, 0.8])]
  const blockGaps = [...new Set([PKWT_GEOMETRY.blockGap, 10, 8.5, 8, 6, 4])]

  console.log(`lineGap sekarang: ${PKWT_GEOMETRY.lineGap} | blockGap sekarang: ${PKWT_GEOMETRY.blockGap}`)
  console.log('lineGap blockGap | ' + keys.map(k => k.replace('PKWT_', '').padEnd(11)).join('') + '| 4 semua?')
  for (const lineGap of lineGaps) {
    for (const blockGap of blockGaps) {
      geometry.lineGap = lineGap
      geometry.blockGap = blockGap
      const pages: number[] = []
      for (const key of keys) pages.push(await pagesFor(key))
      console.log(
        `${String(lineGap).padEnd(7)} ${String(blockGap).padEnd(8)} | `
        + pages.map(p => String(p).padEnd(11)).join('')
        + `| ${pages.every(p => p === 4) ? 'YA' : '-'}`,
      )
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
