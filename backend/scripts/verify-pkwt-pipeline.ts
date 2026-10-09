/**
 * Verifikasi end-to-end jalur PRODUKSI PKWT.
 *
 * Tujuan: membuktikan bahwa blok konten yang benar-benar dihasilkan produksi
 * (`definitionToContentDefinition(getContractDocumentDefinition('PKWT_DRIVER'))`
 * — definisi yang dipakai seed) dapat dirender oleh pintu tunggal
 * `createPkwtPdfBuffer` dan hasilnya memenuhi geometri master.
 *
 * Sengaja BUKAN unit test: butuh font host + Python/pdfplumber. Jalankan manual:
 *   npx ts-node scripts/verify-pkwt-pipeline.ts
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  CONTRACT_DOCUMENT_DEFINITIONS,
  getContractDocumentDefinition,
} from '../src/contracts/contract-document-definitions'
import { definitionToContentDefinition } from '../src/contract-templates/default-template-definition'
import { PKWT_HEADER_CHROME, PKWT_GEOMETRY } from '../src/contracts/pkwt-layout.engine'
import { createPkwtPdfBuffer, resolvePkwtFonts } from '../src/contracts/pkwt-document.renderer'
import { PKWT_PREVIEW_VALUES } from '../src/contracts/pkwt-preview-sample'

const MEASURE_PY = `
import json, sys, pdfplumber
with pdfplumber.open(sys.argv[1]) as pdf:
    out = {"pages": len(pdf.pages), "chars": 0, "fonts": {}, "sizes": {}}
    for p in pdf.pages:
        out["chars"] += len(p.chars)
        for c in p.chars:
            out["fonts"][c.get("fontname")] = out["fonts"].get(c.get("fontname"), 0) + 1
            s = round(float(c.get("size")), 2)
            out["sizes"][str(s)] = out["sizes"].get(str(s), 0) + 1
    print(json.dumps(out))
`

async function main() {
  const keys = Object.keys(CONTRACT_DOCUMENT_DEFINITIONS).filter((k) => k.startsWith('PKWT_'))
  console.log(`Definisi PKWT terdaftar: ${keys.join(', ')}\n`)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pkwt-verify-'))
  const fonts = resolvePkwtFonts()
  console.log(`Font badan    : ${fonts.regular}`)
  console.log(`Font kop      : ${fonts.headerRegular}\n`)

  for (const key of keys) {
    const def = getContractDocumentDefinition(key)
    if (!def) {
      console.log(`!! ${key}: definisi tidak ditemukan`)
      continue
    }
    const content: any = definitionToContentDefinition(def)
    const blocksId: any[] = content?.languages?.id ?? []
    const blocksEn: any[] = content?.languages?.en ?? []

    const buffer = await createPkwtPdfBuffer({
      blocks: blocksId,
      blocksEn,
      values: { ...PKWT_PREVIEW_VALUES },
      orgLines: [...PKWT_HEADER_CHROME.org],
      addressLines: [...PKWT_HEADER_CHROME.address],
      contactLine: PKWT_HEADER_CHROME.contactLine,
      numberLabel: `${PKWT_HEADER_CHROME.numberPrefix} ${PKWT_PREVIEW_VALUES['contract.contractNo']}`,
      fonts,
      signature: {
        leftTitle: PKWT_HEADER_CHROME.signature.leftTitle,
        rightTitle: PKWT_HEADER_CHROME.signature.rightTitle,
        leftName: PKWT_PREVIEW_VALUES['employee.fullName'],
        leftRole: PKWT_PREVIEW_VALUES['employee.jobRole'],
        rightName: PKWT_PREVIEW_VALUES['settings.cooperativeChairmanName'],
        rightRole: PKWT_HEADER_CHROME.signature.rightRoleLabel,
      },
    })

    const pdfPath = path.join(tmp, `${key}.pdf`)
    fs.writeFileSync(pdfPath, buffer)

    const raw = buffer.toString('latin1')
    const hasLucida = raw.includes('LucidaSans-Typewriter')
    const hasTimes = /TimesNewRoman/.test(raw)

    const measured = JSON.parse(
      execFileSync('python', ['-c', MEASURE_PY, pdfPath]).toString(),
    ) as { pages: number; chars: number; fonts: Record<string, number>; sizes: Record<string, number> }

    const bodySize = Object.entries(measured.sizes).sort((a, b) => b[1] - a[1])[0]

    console.log(`== ${key}`)
    console.log(`   blok ID/EN     : ${blocksId.length} / ${blocksEn.length}`)
    console.log(`   halaman        : ${measured.pages}`)
    console.log(`   glyph          : ${measured.chars}`)
    console.log(`   Lucida embed   : ${hasLucida}  | Times embed: ${hasTimes}`)
    console.log(`   ukuran dominan : ${bodySize?.[0]}pt (${bodySize?.[1]} glyph), master ${PKWT_GEOMETRY.font.body}pt`)
    console.log(`   font terukur   : ${Object.keys(measured.fonts).join(', ')}`)
    console.log()
  }

  console.log(`PDF tersimpan di: ${tmp}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
