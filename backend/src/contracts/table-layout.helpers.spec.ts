import { computeColumnWidths, computeRowHeight, wrapCellLines } from './table-layout.helpers'

/**
 * Regresi tabel kontrak.
 *
 * BUG yang dijaga: `width` dulu diperlakukan sebagai persen mentah, padahal
 * setiap kolom dibuat editor dengan `width: 100`. Tabel 3 kolom lalu meminta
 * 300% ruang dan meluber keluar halaman.
 */
describe('computeColumnWidths', () => {
  it('menormalisasi [100,100,100] agar totalnya TEPAT selebar kolom', () => {
    const widths = computeColumnWidths(
      [{ width: 100 }, { width: 100 }, { width: 100 }],
      300,
    )
    expect(widths).toEqual([100, 100, 100])
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(300, 6)
  })

  it('tidak pernah melebihi totalWidth walau bobot kolom besar', () => {
    const widths = computeColumnWidths([{ width: 100 }, { width: 100 }], 260.4)
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(260.4, 6)
    expect(Math.max(...widths)).toBeLessThanOrEqual(260.4 + 1e-9)
  })

  it('menghormati proporsi bobot', () => {
    const widths = computeColumnWidths([{ width: 50 }, { width: 30 }, { width: 20 }], 100)
    expect(widths).toEqual([50, 30, 20])
  })

  it('kolom tanpa width / tidak valid dianggap bobot 1 (bagi rata)', () => {
    const widths = computeColumnWidths([{}, { key: 'b' }, { width: 0 }], 90)
    expect(widths).toEqual([30, 30, 30])
  })

  it('mengembalikan array kosong untuk kolom kosong', () => {
    expect(computeColumnWidths([], 100)).toEqual([])
  })
})

describe('wrapCellLines', () => {
  const fakeDoc = {
    font() { return this },
    fontSize() { return this },
    // Lebar proporsional: 1 karakter = 1 unit.
    widthOfString(s: string) { return s.length },
  }

  it('membungkus kata yang melebihi lebar menjadi beberapa baris', () => {
    const lines = wrapCellLines(fakeDoc as never, 'aaa bbb ccc ddd', 7, 'F', 9)
    expect(lines).toEqual(['aaa bbb', 'ccc ddd'])
  })

  it('menghormati newline eksplisit', () => {
    const lines = wrapCellLines(fakeDoc as never, 'a\nb', 100, 'F', 9)
    expect(lines).toEqual(['a', 'b'])
  })

  it('kata yang lebih panjang dari lebar tetap utuh (tidak dipotong)', () => {
    const lines = wrapCellLines(fakeDoc as never, 'aaaaaaaaaa', 3, 'F', 9)
    expect(lines).toEqual(['aaaaaaaaaa'])
  })

  it('teks kosong menghasilkan satu baris kosong', () => {
    expect(wrapCellLines(fakeDoc as never, '', 50, 'F', 9)).toEqual([''])
  })
})

describe('computeRowHeight', () => {
  const fakeDoc = {
    font() { return this },
    fontSize() { return this },
    heightOfString(_s: string, o: { width: number }) { return o.width <= 10 ? 40 : 12 },
  }

  it('memakai tinggi sel tertinggi + padding', () => {
    const h = computeRowHeight(fakeDoc as never, ['x', 'y'], [5, 100], 9, 8, 6)
    // width-8 = -3 (<=10) -> 40 ; width-8 = 92 -> 12 ; max(40,12,9)+6 = 46
    expect(h).toBe(46)
  })
})
