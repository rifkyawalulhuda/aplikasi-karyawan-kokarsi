import {
  numberToIndonesianWords,
  deriveTermRange,
  deriveDuration,
  deriveHariTanggal,
  formatIndonesianDate,
  resolvePlaceholderValue,
  resolvePlaceholders,
} from './template-value-resolver.helpers'

function d(iso: string): Date {
  // parse 'YYYY-MM-DD' sebagai local midnight agar deterministik
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day)
}

describe('numberToIndonesianWords', () => {
  it('angka dasar', () => {
    expect(numberToIndonesianWords(1)).toBe('satu')
    expect(numberToIndonesianWords(7)).toBe('tujuh')
    expect(numberToIndonesianWords(11)).toBe('sebelas')
  })
  it('belasan dan puluhan', () => {
    expect(numberToIndonesianWords(12)).toBe('dua belas')
    expect(numberToIndonesianWords(20)).toBe('dua puluh')
    expect(numberToIndonesianWords(25)).toBe('dua puluh lima')
  })
  it('ratusan', () => {
    expect(numberToIndonesianWords(100)).toBe('seratus')
    expect(numberToIndonesianWords(105)).toBe('seratus lima')
  })
})

describe('deriveTermRange', () => {
  it('format dd MMMM yyyy - dd MMMM yyyy', () => {
    expect(deriveTermRange(d('2026-09-01'), d('2027-03-31'))).toBe(
      '01 September 2026 - 31 Maret 2027',
    )
  })
})

describe('deriveDuration — konsistensi vs termRange', () => {
  it('1 Sep 2026 → 31 Mar 2027 = 7 bulan (bukan 6)', () => {
    const result = deriveDuration(d('2026-09-01'), d('2027-03-31'))
    expect(result).toBe('7 (tujuh) bulan')
  })
  it('1 Jan → 31 Jan = 1 bulan (akhir bulan)', () => {
    expect(deriveDuration(d('2026-01-01'), d('2026-01-31'))).toBe('1 (satu) bulan')
  })
  it('1 Jan → 15 Feb = 2 bulan (15 hari sisa diabaikan untuk bulan penuh)', () => {
    // 1 bulan penuh + 14 hari → hitungan = 1 bulan
    expect(deriveDuration(d('2026-01-01'), d('2026-02-15'))).toBe('1 (satu) bulan')
  })
  it('kurang dari satu bulan → hari', () => {
    expect(deriveDuration(d('2026-01-01'), d('2026-01-20'))).toBe('19 (sembilan belas) hari')
  })
  it('durasi harus konsisten dengan jumlah bulan termRange', () => {
    // Guard regresi untuk bug sample: teks "6 bulan" padahal rentang 7 bulan
    const cases: Array<[string, string, number]> = [
      ['2026-09-01', '2027-03-31', 7],
      ['2026-01-01', '2026-12-31', 12],
      ['2026-06-15', '2026-09-14', 3],
    ]
    for (const [s, e, expectedMonths] of cases) {
      const duration = deriveDuration(d(s), d(e))
      expect(duration).toContain(`${expectedMonths} (`)
    }
  })
})

describe('deriveHariTanggal', () => {
  it('format sample MITRA', () => {
    // 31 Agustus 2026 adalah Senin
    expect(deriveHariTanggal(d('2026-08-31'))).toBe(
      'hari Senin tanggal 31 bulan Agustus tahun 2026',
    )
  })
})

describe('resolvePlaceholderValue', () => {
  const baseCtx = {
    contract: {
      contractNo: '001/KK/KUKP/SII/VIII/2026',
      startDate: d('2026-09-01'),
      endDate: d('2027-03-31'),
      signedDate: d('2026-08-31'),
      baseCompensation: 4500000,
    },
    employee: {
      fullName: 'Budi Santoso',
      jobRole: { name: 'Driver' },
      birthDate: d('1991-03-16'),
    },
    templateData: { ktp_issued_date: d('2024-08-08') },
    settings: { cooperativeChairmanName: 'Hari Suhono' },
  }

  it('contract.contractNo', () => {
    const r = resolvePlaceholderValue('contract.contractNo', baseCtx as any)!
    expect(r.displayValue).toBe('001/KK/KUKP/SII/VIII/2026')
  })
  it('contract.termRange auto-derive', () => {
    const r = resolvePlaceholderValue('contract.termRange', baseCtx as any)!
    expect(r.displayValue).toBe('01 September 2026 - 31 Maret 2027')
  })
  it('contract.duration auto-derive', () => {
    const r = resolvePlaceholderValue('contract.duration', baseCtx as any)!
    expect(r.displayValue).toBe('7 (tujuh) bulan')
  })
  it('doc.hariTanggal pakai signedDate', () => {
    const r = resolvePlaceholderValue('doc.hariTanggal', baseCtx as any)!
    expect(r.displayValue).toContain('Senin')
  })
  it('doc.docDate fallback ke startDate bila signedDate kosong', () => {
    const ctx = { ...baseCtx, contract: { ...baseCtx.contract, signedDate: null } }
    const r = resolvePlaceholderValue('doc.docDate', ctx as any)!
    expect(r.displayValue).toBe('1 September 2026')
  })
  it('employee relasi nested', () => {
    const r = resolvePlaceholderValue('employee.jobRole.name', baseCtx as any)!
    expect(r.displayValue).toBe('Driver')
  })
  it('employee date formatted', () => {
    const r = resolvePlaceholderValue('employee.birthDate', baseCtx as any)!
    expect(r.displayValue).toBe('16 Maret 1991')
  })
  it('custom field dari templateData', () => {
    const r = resolvePlaceholderValue('custom.ktp_issued_date', baseCtx as any)!
    expect(r.displayValue).toBe('8 Agustus 2024')
  })
  it('custom field yang belum diisi → undefined', () => {
    expect(resolvePlaceholderValue('custom.belum_ada', baseCtx as any)).toBeUndefined()
  })
  it('settings.cooperativeChairmanName', () => {
    const r = resolvePlaceholderValue('settings.cooperativeChairmanName', baseCtx as any)!
    expect(r.displayValue).toBe('Hari Suhono')
  })
  it('key tidak dikenal → undefined', () => {
    expect(resolvePlaceholderValue('hack.dropTable', baseCtx as any)).toBeUndefined()
  })
})

describe('resolvePlaceholders', () => {
  it('memisahkan resolved dan unknown', () => {
    const ctx = {
      contract: {
        contractNo: 'X',
        startDate: d('2026-01-01'),
        endDate: d('2026-12-31'),
      },
    }
    const { resolved, unknown } = resolvePlaceholders(
      ['contract.contractNo', 'contract.duration', 'unknown.thing'],
      ctx as any,
    )
    expect(Object.keys(resolved)).toHaveLength(2)
    expect(unknown).toEqual(['unknown.thing'])
  })
})

describe('formatIndonesianDate', () => {
  it('single digit day tanpa leading zero', () => {
    expect(formatIndonesianDate(d('2026-03-05'))).toBe('5 Maret 2026')
  })
})
