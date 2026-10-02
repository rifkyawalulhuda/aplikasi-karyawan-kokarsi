import { isMasterStructured } from '../../scripts/upgrade-mitra-template-content'

/**
 * Penjaga migrasi konten MITRA.
 *
 * `isMasterStructured` menentukan apakah sebuah versi template sudah mengikuti
 * struktur master (pembukaan + para pihak + PASAL 1..15 + penutup) atau masih
 * memakai section ringkasan ciptaan kode lama.
 */
function content(headings: string[], paragraphCount = 0): any {
  return {
    languages: {
      id: [
        { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        ...Array.from({ length: paragraphCount }, (_, i) => ({
          id: `p${i}`,
          type: 'paragraph',
          text: 'isi',
        })),
        ...headings.map((h, i) => ({
          id: `a${i}`,
          type: 'article',
          heading: h,
          paragraphs: ['x'],
        })),
        { id: 'sig', type: 'signature', leftRole: 'PIHAK PERTAMA', rightRole: 'PIHAK KEDUA' },
      ],
    },
  }
}

describe('isMasterStructured — deteksi versi template MITRA', () => {
  it('menolak konten bergaya lama (section ringkasan ciptaan kode)', () => {
    const old = content(['Para Pihak', 'Ruang Lingkup dan Posisi', 'Jangka Waktu', 'PASAL 1\nRUANG LINGKUP'])
    expect(isMasterStructured(old)).toBe(false)
  })

  it('menolak bila salah satu section lama masih ada', () => {
    expect(isMasterStructured(content(['PASAL 1\nRUANG LINGKUP', 'Jangka Waktu']))).toBe(false)
    expect(isMasterStructured(content(['Para Pihak', 'PASAL 1\nRUANG LINGKUP']))).toBe(false)
    expect(isMasterStructured(content(['Ruang Lingkup dan Posisi']))).toBe(false)
  })

  it('menerima struktur master (15 PASAL tanpa section ringkasan)', () => {
    const headings = Array.from({ length: 15 }, (_, i) => `PASAL ${i + 1}\nNAMA PASAL`)
    expect(isMasterStructured(content(headings, 10))).toBe(true)
  })

  it('konten kosong tidak dianggap terstruktur', () => {
    expect(isMasterStructured({ languages: { id: [] } })).toBe(false)
    expect(isMasterStructured(null)).toBe(false)
    expect(isMasterStructured(undefined)).toBe(false)
  })
})
