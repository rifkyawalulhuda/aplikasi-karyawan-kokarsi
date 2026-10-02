import * as fs from 'fs'
import * as path from 'path'
import { definitionToContentDefinition } from './default-template-definition'
import { CONTRACT_DOCUMENT_DEFINITIONS } from '../contracts/contract-document-definitions'
import { mitraInterpolate, scrubRawTokens, MITRA_HEADER_CHROME } from '../contracts/mitra-layout.engine'

const MITRA_KEYS = Object.values(CONTRACT_DOCUMENT_DEFINITIONS)
  .filter(d => d.family === 'MITRA')
  .map(d => d.key)

/**
 * Aturan PASSTHROUGH (section 10 revisi):
 *
 *  - Seluruh teks kontrak HARUS berasal dari Template Kontrak
 *    (`definition.sections` → contentDefinition), bukan dari kode layanan.
 *  - Kode hanya boleh menyimpan CHROME: kop surat + label tetap pada judul
 *    dan blok tanda tangan.
 *
 * Test ini mengunci aturan tersebut supaya tidak regresi.
 */
describe('MITRA passthrough — teks kontrak berasal dari template', () => {
  it('setiap MITRA menghasilkan blok dari sections template (bukan teks kode)', () => {
    for (const key of MITRA_KEYS) {
      const def = (CONTRACT_DOCUMENT_DEFINITIONS as any)[key]
      const content = definitionToContentDefinition(def)
      const blocks = content.languages.id

      // Harus ada title + signature (chrome struktural) dan minimal 15 PASAL.
      const headings = blocks
        .filter((b: any) => b.type === 'article')
        .map((b: any) => String(b.heading))
      const pasal = headings.filter(h => /^PASAL\s+\d+/i.test(h))
      expect(pasal.length).toBe(15)

      // Pembukaan/para pihak/penutup harus ada sebagai paragraf (tanpa heading).
      const paragraphs = blocks.filter((b: any) => b.type === 'paragraph')
      expect(paragraphs.length).toBeGreaterThanOrEqual(9)

      const allText = JSON.stringify(blocks)
      expect(allText).toContain('PIHAK PERTAMA')
      expect(allText).toContain('PIHAK KEDUA')
    }
  })

  it('tidak ada section ringkasan ciptaan kode ("Para Pihak"/"Ruang Lingkup dan Posisi"/"Jangka Waktu")', () => {
    for (const key of MITRA_KEYS) {
      const def = (CONTRACT_DOCUMENT_DEFINITIONS as any)[key]
      const blocks = definitionToContentDefinition(def).languages.id
      const headings = blocks
        .filter((b: any) => b.type === 'article')
        .map((b: any) => String(b.heading).replace(/\n/g, ' '))
      expect(headings).not.toContain('Para Pihak')
      expect(headings).not.toContain('Ruang Lingkup dan Posisi')
      expect(headings).not.toContain('Jangka Waktu')
    }
  })

  it('placeholder memakai format {{...}} yang dikenali resolver, bukan __TOKEN__ legacy', () => {
    for (const key of MITRA_KEYS) {
      const def = (CONTRACT_DOCUMENT_DEFINITIONS as any)[key]
      const allText = JSON.stringify(definitionToContentDefinition(def))
      expect(allText).not.toMatch(/__MITRA_(TERM|IMBALAN|ADDRESS|PHONE|EMAIL)__/)
    }
  })

  it('tidak ada teks kontrak yang di-hardcode di layanan (hanya chrome)', () => {
    const servicePath = path.join(__dirname, '..', 'contracts', 'contract-document.service.ts')
    const src = fs.readFileSync(servicePath, 'utf8')

    // Kalimat kontrak khas MITRA tidak boleh muncul di layanan sama sekali.
    const forbidden = [
      'Perjanjian Kemitraan selanjutnya disebut sebagai',
      'Bahwa PIHAK PERTAMA adalah suatu koperasi',
      'Bahwa PIHAK KEDUA merupakan pihak yang bersedia',
      'Sehubungan dengan hal-hal tersebut diatas',
      'Demikian Perjanjian ini dibuat dalam 2 (dua)',
      'Kemudian PIHAK PERTAMA dan PIHAK KEDUA untuk selanjutnya',
      'Akta Pendirian Nomor',
      'Penyediaan Tenaga Kerja',
    ]
    for (const s of forbidden) {
      expect(src).not.toContain(s)
    }
  })

  it('jalur render MITRA tidak lagi memakai dot-leader sebagai fallback', () => {
    const servicePath = path.join(__dirname, '..', 'contracts', 'contract-document.service.ts')
    const src = fs.readFileSync(servicePath, 'utf8')

    // Ambil method renderMitraLayoutFromBlocks dan renderMitraPdf secara presisi
    // (brace-matched), lalu pastikan bebas dot-leader & kop surat literal.
    for (const name of ['private renderMitraLayoutFromBlocks', 'private renderMitraPdf']) {
      const body = extractMethod(src, name)
      expect(body.length).toBeGreaterThan(100)
      expect(body).not.toContain('(...........................)')
      expect(body).not.toContain('TELP. 021 - 50555340')
      expect(body).not.toContain('GIIC - KOTA DELTAMAS')
      expect(body).not.toContain('KOPERASI PT. SANKYU')
    }
  })

  it('layanan tidak memanggil header corporate untuk MITRA (hanya PKWT)', () => {
    const servicePath = path.join(__dirname, '..', 'contracts', 'contract-document.service.ts')
    const src = fs.readFileSync(servicePath, 'utf8')

    // Kop surat MITRA dikelola terpusat di mitra-layout.engine.ts.
    // Layanan hanya boleh memakai drawCorporateHeader untuk PKWT.
    expect(src).not.toMatch(/drawCorporateHeader\s*\(\s*doc\s*,\s*'MITRA'\s*\)/)
  })

  it('tidak ada fungsi mati yang menyimpan teks kontrak MITRA', () => {
    const servicePath = path.join(__dirname, '..', 'contracts', 'contract-document.service.ts')
    const src = fs.readFileSync(servicePath, 'utf8')

    // Fungsi-fungsi ini pernah memuat hardcode MITRA; harus tetap terhapus.
    for (const dead of ['renderSignaturePage', 'renderSequentialColumns', 'formatDayName']) {
      expect(src).not.toContain(`private ${dead}(`)
    }
  })

  it('nama variabel dinamis tidak pernah tercetak di dokumen final', () => {
    // ATURAN: placeholder kosong → titik-titik, BUKAN nama variabel mentah.
    const cases = [
      ['2. Bpk./Ibu {{employee.fullName}}, KTP {{employee.nik}}', {}],
      ['Nomor {{custom.ktp_issued_date}}', { 'custom.ktp_issued_date': '' }],
      ['Term {{contract.termRange}}', { 'contract.termRange': '   ' }],
    ]
    for (const [tpl, vals] of cases) {
      const rendered = scrubRawTokens(mitraInterpolate(tpl as string, vals as Record<string, string>))
      expect(rendered).not.toContain('{{')
      expect(rendered).not.toContain('}}')
      expect(rendered).not.toContain('custom.')
      expect(rendered).not.toContain('employee.')
      expect(rendered).toContain('...')
    }
  })

  it('token mentah gaya lama (<<...>>, __TOKEN__) dibersihkan', () => {
    const rendered = scrubRawTokens('a <<custom.ktp_issued_date>> b __MITRA_TERM__ c')
    expect(rendered).not.toContain('<<')
    expect(rendered).not.toContain('__MITRA')
    expect(rendered).not.toContain('ktp_issued_date')
  })

  it('label pihak tidak dicetak dua kali di blok tanda tangan', () => {
    // Header pilar = "PIHAK PERTAMA"/"PIHAK KEDUA" (chrome).
    // Baris jabatan di bawah nama HARUS jabatan, bukan label pihak lagi.
    const { leftRoleLabel, rightRoleFallback, leftHeader, rightHeader } = MITRA_HEADER_CHROME.signature
    expect(leftRoleLabel).not.toBe('PIHAK PERTAMA')
    expect(rightRoleFallback).not.toBe('PIHAK KEDUA')
    expect(leftHeader).not.toBe('PIHAK PERTAMA')
    expect(rightHeader).not.toBe('PIHAK KEDUA')

    // Service tidak boleh memakai sig.leftRole/rightRole sebagai jabatan.
    const servicePath = path.join(__dirname, '..', 'contracts', 'contract-document.service.ts')
    const src = fs.readFileSync(servicePath, 'utf8')
    expect(src).not.toMatch(/leftRole:\s*sig\?\.leftRole/)
    expect(src).not.toMatch(/rightRole:\s*sig\?\.rightRole/)
  })
})

/** Ambil isi method mulai `name` sampai kurung kurawal penutupnya seimbang. */
function extractMethod(src: string, name: string): string {
  const start = src.indexOf(name)
  if (start < 0) return ''
  let i = src.indexOf('{', start)
  if (i < 0) return ''
  let depth = 0
  for (let j = i; j < src.length; j++) {
    const ch = src[j]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(start, j + 1)
    }
  }
  return ''
}
