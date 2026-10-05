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
import {
  resolvePkwtFonts,
  resolvePkwtLogoPath,
  createPkwtPdfBuffer,
  blocksToPkwtParagraphs
} from './pkwt-document.renderer'
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

describe('blocksToPkwtParagraphs — runs & align', () => {
  const values = { 'employee.fullName': 'Budi' }

  it('teks tanpa mark tidak menghasilkan runs (jalur lama dipertahankan)', () => {
    const paras = blocksToPkwtParagraphs(
      [{ id: 'p1', type: 'paragraph', text: 'Teks biasa saja.' }],
      values
    )
    expect(paras).toHaveLength(1)
    expect(paras[0].runs).toBeUndefined()
    expect(paras[0].align).toBeUndefined()
  })

  it('teks bermark menghasilkan runs setelah interpolasi', () => {
    // Urutan penting: `{{...}}` diganti DULU, baru mark dibaca — sehingga nilainya
    // yang menjadi bold, bukan nama placeholder-nya.
    const paras = blocksToPkwtParagraphs(
      [{ id: 'p1', type: 'paragraph', text: 'Halo **{{employee.fullName}}**!' }],
      values
    )
    expect(paras[0].text).toBe('Halo **Budi**!')
    expect(paras[0].runs).toEqual([
      { text: 'Halo ', bold: false, italic: false, underline: false },
      { text: 'Budi', bold: true, italic: false, underline: false },
      { text: '!', bold: false, italic: false, underline: false },
    ])
  })

  it('judul pasal TIDAK diberi runs walau memuat tanda bintang', () => {
    const paras = blocksToPkwtParagraphs(
      [{ id: 'a1', type: 'article', heading: 'PASAL 1 * CATATAN', paragraphs: ['isi'] }],
      values
    )
    expect(paras[0].bold).toBe(true)
    expect(paras[0].runs).toBeUndefined()
  })

  it('paragraf pasal bermark mendapat runs', () => {
    const paras = blocksToPkwtParagraphs(
      [{ id: 'a1', type: 'article', heading: 'PASAL 1', paragraphs: ['__garis__ bawah'] }],
      values
    )
    const body = paras[1]
    expect(body.runs).toEqual([
      { text: 'garis', bold: false, italic: false, underline: true },
      { text: ' bawah', bold: false, italic: false, underline: false },
    ])
  })

  it('align diteruskan ke SELURUH paragraf blok, termasuk judul pasal', () => {
    const paras = blocksToPkwtParagraphs(
      [{
        id: 'a1',
        type: 'article',
        heading: 'PASAL 1',
        paragraphs: ['satu', 'dua'],
        align: 'center'
      }],
      values
    )
    expect(paras.map(p => p.align)).toEqual(['center', 'center', 'center'])
  })

  it('headingAlign mengatur JUDUL pasal sendiri; uraian tetap ikut align blok', () => {
    const paras = blocksToPkwtParagraphs(
      [{
        id: 'a1',
        type: 'article',
        heading: 'PASAL 1',
        paragraphs: ['satu', 'dua'],
        headingAlign: 'center',
        align: 'justify',
      }],
      values
    )
    // Judul ikut headingAlign, BUKAN align blok; uraian tetap align blok.
    expect(paras.map(p => p.align)).toEqual(['center', 'justify', 'justify'])
  })

  it('headingAlign tanpa align blok: hanya judul yang berubah', () => {
    const paras = blocksToPkwtParagraphs(
      [{
        id: 'a1',
        type: 'article',
        heading: 'PASAL 1',
        paragraphs: ['satu'],
        headingAlign: 'center',
      }],
      values
    )
    expect(paras.map(p => p.align)).toEqual(['center', undefined])
  })

  it('headingAlign tidak sah diabaikan → judul kembali ke align blok (perilaku lama)', () => {
    const paras = blocksToPkwtParagraphs(
      [{
        id: 'a1',
        type: 'article',
        heading: 'PASAL 1',
        paragraphs: ['satu'],
        headingAlign: 'middle',
        align: 'center',
      }],
      values
    )
    expect(paras.map(p => p.align)).toEqual(['center', 'center'])
  })

  it('align TIDAK diambil dari blok list (di luar lingkup)', () => {
    const paras = blocksToPkwtParagraphs(
      [{ id: 'l1', type: 'list', style: 'bullet', items: ['a', 'b'], align: 'center' }],
      values
    )
    expect(paras.map(p => p.align)).toEqual([undefined, undefined])
  })

  it('align bernilai tidak dikenal diabaikan (perilaku lama)', () => {
    const paras = blocksToPkwtParagraphs(
      [{ id: 'p1', type: 'paragraph', text: 'isi', align: 'middle' }],
      values
    )
    expect(paras[0].align).toBeUndefined()
  })

  it('blockIndex & blockId tetap konsisten setelah penambahan runs/align', () => {
    // Blok yang tidak menghasilkan paragraf tidak boleh memakai nomor urut.
    const paras = blocksToPkwtParagraphs(
      [
        { id: 't1', type: 'title', text: 'JUDUL' },
        { id: 'p1', type: 'paragraph', text: 'satu **tebal**' },
        { id: 's1', type: 'signature' },
        { id: 'p2', type: 'paragraph', text: 'dua' },
      ],
      values
    )
    expect(paras.map(p => [p.blockId, p.blockIndex])).toEqual([
      ['p1', 0],
      ['p2', 1],
    ])
  })
})

describe('PKWT document renderer — mark & perataan di PDF NYATA', () => {
  maybe('mark tidak mengubah jumlah halaman (paginasi terjaga)', async () => {
    const plain = await createPkwtPdfBuffer(baseOpts())
    const marked = await createPkwtPdfBuffer({
      ...baseOpts(),
      blocks: BLOCKS.id.map(block =>
        block.type === 'paragraph'
          ? { ...block, text: 'Pada hari ini, **Kamis**, 2 Juli 2026.' }
          : block
      ),
    })
    expect(countPages(marked)).toBe(countPages(plain))
  })

  maybe('perataan center/right tidak mengubah jumlah halaman', async () => {
    const plain = await createPkwtPdfBuffer(baseOpts())
    for (const align of ['left', 'center', 'right', 'justify']) {
      const aligned = await createPkwtPdfBuffer({
        ...baseOpts(),
        blocks: BLOCKS.id.map(block =>
          block.type === 'paragraph' || block.type === 'article'
            ? { ...block, align }
            : block
        ),
      })
      expect(countPages(aligned)).toBe(countPages(plain))
    }
  })

  maybe('menanamkan Lucida BOLD saat teks bermark (font mark benar-benar dipakai)', async () => {
    const buffer = await createPkwtPdfBuffer({
      ...baseOpts(),
      blocks: BLOCKS.id.map(block =>
        block.type === 'paragraph'
          ? { ...block, text: 'Kata **tebal** di sini.' }
          : block
      ),
    })
    // Nama font BOLD tertanam di resources PDF. Kalau mark tidak sampai ke
    // renderer, font ini tidak akan pernah muncul.
    expect(buffer.toString('latin1')).toContain('LucidaSans-TypewriterBold')
  })

  maybe('mark + perataan bersamaan tetap menghasilkan PDF sah', async () => {
    const buffer = await createPkwtPdfBuffer({
      ...baseOpts(),
      blocks: BLOCKS.id.map(block =>
        block.type === 'paragraph'
          ? { ...block, text: '**Tebal** dan *miring* __garis__.', align: 'center' }
          : block
      ),
    })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(1000)
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
