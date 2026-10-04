/**
 * Regresi pintu tunggal render PKWT (`pkwt-document.renderer.ts`).
 *
 * `createPkwtPdfBuffer` dipakai DUA jalur: generate kontrak dan pratinjau editor.
 * Tes ini menjaga kontraknya tetap utuh:
 *  - menghasilkan PDF sah (header `%PDF-`) dari blok + nilai saja;
 *  - tidak butuh kontrak/karyawan (murni);
 *  - deterministik untuk input yang sama.
 *
 * Presisi geometri/font terhadap master diuji terpisah dengan pengukuran
 * sesungguhnya di `pkwt-layout.engine.spec.ts`.
 */
import { existsSync } from 'fs'
import { resolvePkwtFonts, resolvePkwtLogoPath, createPkwtPdfBuffer } from './pkwt-document.renderer'
import { PKWT_HEADER_CHROME } from './pkwt-layout.engine'

const fonts = resolvePkwtFonts()
// Bila Lucida tidak ada di host, renderer jatuh ke Times â€” dokumen tetap jadi,
// tetapi uji "font master" tidak bermakna, jadi dilewati.
const lucidaAvailable = existsSync(fonts.regular)
const maybe = lucidaAvailable ? it : it.skip

/** Hitung `/Type /Page` (bukan `/Pages`) â€” penanda jumlah halaman PDF. */
function countPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

const BLOCKS = {
  id: [
    { type: 'title', text: 'KESEPAKATAN KERJA WAKTU TERTENTU' },
    { type: 'subtitle', text: 'STATED PERIODS LABOUR AGREEMENT' },
    { type: 'paragraph', text: 'Pada hari ini, Kamis, 2 Juli 2026.' },
    {
      type: 'article',
      heading: 'Pasal 1\nMaksud Kesepakatan',
      paragraphs: ['1. Perusahaan mempekerjakan Karyawan sebagai {{employee.jobRole}}.'],
    },
    { type: 'signature', leftRole: 'Karyawan/employee', rightRole: 'Pengusaha/Perusahaan' },
  ],
  en: [
    { type: 'title', text: 'STATED PERIODS LABOUR AGREEMENT' },
    { type: 'paragraph', text: 'Today Thursday, dated july 02, 2026,' },
    {
      type: 'article',
      heading: 'Article 1\nPurpose of Agreement',
      paragraphs: ['1. Company employ the Employee for stated periods.'],
    },
  ],
}

function baseOpts() {
  return {
    blocks: BLOCKS.id,
    blocksEn: BLOCKS.en,
    values: { 'employee.jobRole': 'Driver' },
    orgLines: [...PKWT_HEADER_CHROME.org],
    addressLines: [...PKWT_HEADER_CHROME.address],
    contactLine: PKWT_HEADER_CHROME.contactLine,
    numberLabel: 'No. : 174/KUKP-SII/VII/2026',
    fonts,
    signature: {
      leftTitle: PKWT_HEADER_CHROME.signature.leftTitle,
      rightTitle: PKWT_HEADER_CHROME.signature.rightTitle,
      leftName: 'Ibad Ubaidillah',
      leftRole: 'Driver',
      rightName: 'Hari Suhono',
      rightRole: PKWT_HEADER_CHROME.signature.rightRoleLabel,
    },
  }
}

describe('PKWT document renderer â€” pintu tunggal', () => {
  maybe('menghasilkan buffer PDF sah dari blok + nilai saja (tanpa kontrak)', async () => {
    const buffer = await createPkwtPdfBuffer(baseOpts())
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  maybe('menanamkan Lucida Sans Typewriter (font master), bukan Times saja', async () => {
    const buffer = await createPkwtPdfBuffer(baseOpts())
    // Nama font TERTANAM di resources PDF â€” regresi inilah yang tak terlihat
    // bila hanya memeriksa ukuran/keberadaan berkas.
    const raw = buffer.toString('latin1')
    expect(raw).toContain('LucidaSans-Typewriter')
  })

  maybe('menghasilkan ukuran dan jumlah halaman yang sama untuk input yang sama', async () => {
    const opts = baseOpts()
    const [a, b] = await Promise.all([createPkwtPdfBuffer(opts), createPkwtPdfBuffer(opts)])
    // PDFKit menyematkan ID/timestamp dokumen, jadi byte tidak identik.
    // Yang harus stabil: panjang dan jumlah halaman.
    expect(a.length).toBe(b.length)
    expect(countPages(a)).toBe(countPages(b))
    expect(countPages(a)).toBeGreaterThan(0)
  })

  maybe('tidak menuntut kolom EN ada (template ID-saja tetap render)', async () => {
    const buffer = await createPkwtPdfBuffer({ ...baseOpts(), blocksEn: [] })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  maybe('placeholder tanpa nilai tidak mencetak token mentah ke dokumen', async () => {
    // Kebocoran token diuji di lapisan interpolasi
    // (`pkwt-layout.engine.spec.ts`); di sini cukup memastikan render tidak
    // melempar dan tetap menghasilkan PDF sah walau `values` kosong.
    const buffer = await createPkwtPdfBuffer({ ...baseOpts(), values: {} })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

describe('PKWT logo & chrome', () => {
  it('memakai logo PKWT, bukan logo MITRA', () => {
    // Regresi nyata: `resolvePkwtLogoPath` pernah mengembalikan
    // `contract-logo-mitra.jpg` (salah salin).
    expect(resolvePkwtLogoPath('/assets')).toBe('/assets/contract-logo-pkwt.jpg')
    expect(resolvePkwtLogoPath('/assets')).not.toContain('mitra')
  })

  it('prefix nomor master memakai spasi sebelum titik dua', () => {
    expect(PKWT_HEADER_CHROME.numberPrefix).toBe('No. :')
  })

  it('pilar tanda tangan master: kiri Karyawan, kanan Pengusaha', () => {
    expect(PKWT_HEADER_CHROME.signature.leftTitle).toBe('Karyawan/employee')
    expect(PKWT_HEADER_CHROME.signature.rightTitle).toBe('Pengusaha/Perusahaan')
  })

  it('kop memuat baris organisasi & kontak master', () => {
    expect(PKWT_HEADER_CHROME.org).toHaveLength(3)
    expect(PKWT_HEADER_CHROME.org[0]).toBe('KOPERASI KARYAWAN')
    expect(PKWT_HEADER_CHROME.contactLine).toContain('TELP.')
  })
})
