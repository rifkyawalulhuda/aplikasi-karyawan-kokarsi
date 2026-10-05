import { interpolate, buildValueMap, formatCell, listPrefix } from './contract-block-renderer'

describe('interpolate', () => {
  it('mengganti placeholder dengan nilai', () => {
    const values = { 'employee.fullName': 'Budi Santoso', 'contract.contractNo': '001/KK/2026' }
    expect(interpolate('Nama {{employee.fullName}} no {{contract.contractNo}}', values)).toBe(
      'Nama Budi Santoso no 001/KK/2026',
    )
  })

  it('placeholder tanpa nilai tetap terlihat (fail-visible) dengan penanda', () => {
    expect(interpolate('Nama {{employee.fullName}}', {})).toBe('Nama «employee.fullName»')
  })

  it('nilai kosong juga ditandai', () => {
    expect(interpolate('X {{custom.a}}', { 'custom.a': '' })).toBe('X «custom.a»')
  })

  it('teks tanpa placeholder tidak berubah', () => {
    expect(interpolate('Teks biasa', {})).toBe('Teks biasa')
  })

  it('string kosong aman', () => {
    expect(interpolate('', {})).toBe('')
  })
})

describe('buildValueMap', () => {
  it('mengambil displayValue dari bentuk { value, displayValue }', () => {
    const map = buildValueMap({
      'contract.contractNo': { value: 'X', displayValue: 'X' },
      'employee.fullName': { value: 'Budi', displayValue: 'Budi' },
    })
    expect(map).toEqual({ 'contract.contractNo': 'X', 'employee.fullName': 'Budi' })
  })

  it('mendukung nilai scalar langsung', () => {
    expect(buildValueMap({ 'custom.a': 'teks' })).toEqual({ 'custom.a': 'teks' })
  })

  it('null/undefined aman', () => {
    expect(buildValueMap(null)).toEqual({})
    expect(buildValueMap(undefined)).toEqual({})
  })

  it('default bahasa Indonesia: displayValueEn diabaikan', () => {
    // Pemanggil lama (MITRA satu kolom) tidak boleh ikut berubah.
    const map = buildValueMap({
      'employee.gender': { value: 'MALE', displayValue: 'Laki-laki', displayValueEn: 'Male' },
    })
    expect(map['employee.gender']).toBe('Laki-laki')
  })

  it("bahasa 'EN': memakai displayValueEn bila ada, jatuh ke displayValue bila tidak", () => {
    // Inti fitur gender bilingual: kolom kanan PKWT harus "Male", sementara
    // field lain (yang teksnya tidak bergantung bahasa) tetap satu nilai.
    const map = buildValueMap({
      'employee.gender': { value: 'MALE', displayValue: 'Laki-laki', displayValueEn: 'Male' },
      'employee.fullName': { value: 'Budi', displayValue: 'Budi' },
      'contract.contractNo': { value: 'X', displayValue: 'X' },
    }, 'EN')
    expect(map).toEqual({
      'employee.gender': 'Male',
      'employee.fullName': 'Budi',
      'contract.contractNo': 'X',
    })
  })
})

describe('formatCell', () => {
  it('currency dari angka mentah', () => {
    expect(formatCell('4500000', 'currency')).toContain('4.500.000')
  })

  it('currency dari string berformat rupiah', () => {
    expect(formatCell('Rp 4.500.000', 'currency')).toContain('4.500.000')
  })

  it('number', () => {
    expect(formatCell('1234567', 'number')).toBe('1.234.567')
  })

  it('text dibiarkan apa adanya', () => {
    expect(formatCell('Upah Pokok', 'text')).toBe('Upah Pokok')
    expect(formatCell('Tanpa format', undefined)).toBe('Tanpa format')
  })

  it('nilai non-numerik dengan format currency dibiarkan', () => {
    expect(formatCell('Belum ada', 'currency')).toBe('Belum ada')
  })
})

describe('listPrefix — sub-butir sample MITRA', () => {
  it('numbered', () => {
    expect(listPrefix('numbered', 0)).toBe('1.')
    expect(listPrefix('numbered', 2)).toBe('3.')
  })

  it('alphabetic (a, b, c)', () => {
    expect(listPrefix('alphabetic', 0)).toBe('a.')
    expect(listPrefix('alphabetic', 1)).toBe('b.')
    expect(listPrefix('alphabetic', 2)).toBe('c.')
  })

  it('bullet default', () => {
    expect(listPrefix('bullet', 0)).toBe('•')
    expect(listPrefix('unknown', 5)).toBe('•')
  })
})
