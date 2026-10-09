import {
  numberToIndonesianWords,
  deriveTermRange,
  deriveTermRangeEn,
  deriveDuration,
  deriveHariTanggal,
  deriveHariTanggalEn,
  formatIndonesianDate,
  formatEnglishDate,
  genderLabel,
  resolvePlaceholderValue,
  resolvePlaceholders,
} from './template-value-resolver.helpers'

function d(iso: string): Date {
  // parse 'YYYY-MM-DD' sebagai local midnight agar deterministik
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day)
}

describe('genderLabel', () => {
  it('menerjemahkan enum Gender ke label per bahasa', () => {
    expect(genderLabel('MALE', 'ID')).toBe('Laki-laki')
    expect(genderLabel('FEMALE', 'ID')).toBe('Perempuan')
    expect(genderLabel('MALE', 'EN')).toBe('Male')
    expect(genderLabel('FEMALE', 'EN')).toBe('Female')
  })
  it('default bahasa adalah Indonesia (mayoritas dokumen satu kolom)', () => {
    expect(genderLabel('MALE')).toBe('Laki-laki')
  })
  it('nilai di luar enum dikembalikan apa adanya, bukan dilempar', () => {
    expect(genderLabel('OTHER', 'ID')).toBe('OTHER')
    expect(genderLabel('OTHER', 'EN')).toBe('OTHER')
  })
  it('null/undefined/string kosong → undefined', () => {
    expect(genderLabel(null)).toBeUndefined()
    expect(genderLabel(undefined)).toBeUndefined()
    expect(genderLabel('')).toBeUndefined()
  })
})

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

describe('deriveTermRangeEn', () => {
  /**
   * `{{contract.termRange}}` juga dipakai kolom EN (Pasal 2 ayat 1 versi
   * Inggris). Tanpa varian ini, bulan Indonesia bocor ke naskah Inggris.
   */
  it('memakai nama bulan Inggris, tanpa leading zero day', () => {
    expect(deriveTermRangeEn(d('2026-09-01'), d('2027-03-31'))).toBe(
      '01 September 2026 - 31 March 2027',
    )
  })
  it('mempertahankan leading zero pada tanggal (seperti versi Indonesia)', () => {
    expect(deriveTermRangeEn(d('2026-07-02'), d('2027-07-01'))).toBe(
      '02 July 2026 - 01 July 2027',
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

describe('deriveHariTanggalEn', () => {
  it('nama hari & bulan Inggris, dipisah koma', () => {
    // 31 Agustus 2026 adalah Senin → Monday
    expect(deriveHariTanggalEn(d('2026-08-31'))).toBe('Monday, 31 August 2026')
  })
  it('tanpa kata Indonesia (hari/tanggal/bulan) dan tanpa bulan Indonesia', () => {
    const out = deriveHariTanggalEn(d('2026-07-02'))
    expect(out).toBe('Thursday, 2 July 2026')
    expect(out).not.toMatch(/hari|tanggal|bulan|Juli/)
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
      gender: 'MALE',
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
  it('doc.hariTanggal punya varian Inggris untuk kolom EN PKWT', () => {
    // signedDate = 31 Agustus 2026 (Senin). Tanpa displayValueEn, kolom Inggris
    // ikut mencetak "hari Senin tanggal 31 bulan Agustus tahun 2026".
    const r = resolvePlaceholderValue('doc.hariTanggal', baseCtx as any)!
    expect(r.displayValueEn).toBe('Monday, 31 August 2026')
    expect(r.displayValueEn).not.toMatch(/hari|tanggal|bulan|Agustus/)
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
  it('employee.gender memakai label per bahasa, bukan enum mentah', () => {
    // Regresi: blok identitas PIHAK KEDUA PKWT memakai {{employee.gender}} di
    // KEDUA kolom. Tanpa cabang eksplisit, jalur generik `employee.*` mencetak
    // `MALE`; tanpa `displayValueEn`, kolom Inggris ikut mencetak "Laki-laki".
    const male = resolvePlaceholderValue('employee.gender', baseCtx as any)!
    expect(male.displayValue).toBe('Laki-laki')
    expect(male.displayValueEn).toBe('Male')

    const female = resolvePlaceholderValue('employee.gender', {
      ...baseCtx,
      employee: { ...baseCtx.employee, gender: 'FEMALE' },
    } as any)!
    expect(female.displayValue).toBe('Perempuan')
    expect(female.displayValueEn).toBe('Female')
  })
  it('field selain gender tidak punya varian Inggris (satu nilai untuk dua kolom)', () => {
    // Menjaga agar `displayValueEn` tetap opt-in: kalau suatu saat ada yang
    // mengisinya untuk SEMUA field, kolom EN diam-diam berubah untuk field yang
    // teksnya tidak bergantung bahasa.
    expect(resolvePlaceholderValue('employee.fullName', baseCtx as any)!.displayValueEn).toBeUndefined()
    expect(resolvePlaceholderValue('contract.contractNo', baseCtx as any)!.displayValueEn).toBeUndefined()
  })
  it('tanggal memakai varian Inggris di displayValueEn, Indonesia tetap di displayValue', () => {
    // Blok identitas PIHAK KEDUA ada di KEDUA kolom, jadi `employee.birthDate`
    // juga tercetak di kolom Inggris. Tanpa varian ini muncul "16 Maret 1991"
    // di tengah naskah Inggris.
    const birth = resolvePlaceholderValue('employee.birthDate', baseCtx as any)!
    expect(birth.displayValue).toBe('16 Maret 1991')
    expect(birth.displayValueEn).toBe('16 March 1991')
  })
  it('rentang periode punya varian Inggris (dipakai Pasal 2 versi Inggris)', () => {
    const term = resolvePlaceholderValue('contract.termRange', baseCtx as any)!
    expect(term.displayValue).toContain('Maret')
    expect(term.displayValueEn).toContain('March')
    expect(term.displayValueEn).not.toContain('Maret')
  })
  it('employee.gender kosong → undefined (bukan "undefined" tercetak)', () => {
    expect(resolvePlaceholderValue('employee.gender', {
      ...baseCtx,
      employee: { ...baseCtx.employee, gender: null },
    } as any)).toBeUndefined()
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

describe('formatEnglishDate', () => {
  it('single digit day tanpa leading zero, bulan Inggris', () => {
    expect(formatEnglishDate(d('2026-03-05'))).toBe('5 March 2026')
  })
  it('mencakup bulan Juli (bukan "Juli" yang lolos dari peta ID)', () => {
    expect(formatEnglishDate(d('1996-07-02'))).toBe('2 July 1996')
  })
})
