import { scoreValue } from './search-ranking'

/**
 * Regresi peringkat pencarian global.
 *
 * Urutan penting: hasil yang cocok PERSIS harus menang atas awalan, awalan atas
 * batas kata, dan substring paling lemah. Kalau urutan ini rusak, command
 * palette menampilkan entitas yang salah di baris pertama.
 */
describe('scoreValue — peringkat relevansi', () => {
  it('persis > awalan > batas kata > substring', () => {
    const q = 'budi'
    expect(scoreValue('Budi', q)).toBeGreaterThan(scoreValue('Budi Santoso', q))
    expect(scoreValue('Budi Santoso', q)).toBeGreaterThan(scoreValue('Pak Budi', q))
    expect(scoreValue('Pak Budi', q)).toBeGreaterThan(scoreValue('Subudi', q))
    expect(scoreValue('Subudi', q)).toBeGreaterThan(0)
  })

  it('tidak peka huruf besar/kecil', () => {
    expect(scoreValue('BUDI', 'budi')).toBe(100)
    expect(scoreValue('budi', 'BUDI')).toBe(100)
  })

  it('batas kata mengenali pemisah non-alfanumerik', () => {
    // "sankyu" adalah kata utuh di "PT Sankyu Int'l" → batas kata (60).
    expect(scoreValue("PT Sankyu Int'l", 'sankyu')).toBe(60)
    // "ank" hanya substring di dalam kata → 40, bukan batas kata.
    expect(scoreValue("PT Sankyu Int'l", 'ank')).toBe(40)
  })

  it('mengembalikan 0 untuk nilai kosong atau tidak cocok', () => {
    expect(scoreValue('', 'budi')).toBe(0)
    expect(scoreValue(null, 'budi')).toBe(0)
    expect(scoreValue(undefined, 'budi')).toBe(0)
    expect(scoreValue('Santoso', 'budi')).toBe(0)
  })

  it('query dengan karakter regex tidak melempar', () => {
    expect(() => scoreValue('a.b', 'a.b')).not.toThrow()
    expect(scoreValue('a.b', 'a.b')).toBe(100)
    expect(scoreValue('axb', 'a.b')).toBe(0)
  })

  it('query satu karakter tidak dianggap batas kata di dalam angka', () => {
    // "1" pada "SP 1" adalah batas kata (dipisah spasi) → 60.
    expect(scoreValue('SP 1', '1')).toBe(60)
  })
})
