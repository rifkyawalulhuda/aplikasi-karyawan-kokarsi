/**
 * Field dinamis form kontrak (CONTRACT_INPUT) â€” Fase 3.
 *
 * `TemplateSnapshotService` adalah satu-satunya gerbang kontrak dibuat/diperpanjang,
 * jadi normalisasi & validasi `templateData` ditempatkan di sana. Test di bawah
 * mengunci perilaku yang mudah rusak tanpa terlihat: tanggal harus jadi `Date`
 * (bukan string) agar diformat, `DD/MM/YYYY` dari UI harus diterima, dan field
 * CONTRACT_INPUT yang tidak dikenal harus dibuang â€” `resolvePlaceholders()`
 * tidak pernah melempar untuk key yang tidak dikenal, jadi kontrak bisa
 * tersimpan dengan data yang diam-diam hilang.
 */
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    readonly client = undefined
  }
}))

const DEFAULT_CATALOG = [
  // Katalog: `employee.fullName` SYSTEM (dapat di-resolve dari data).
  { key: 'employee.fullName', label: 'Nama Lengkap Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM', sourceConfig: null, options: null },
]

function makeSnapshotService(
  fieldDefinitions: unknown[],
  contentDefinition: unknown = { languages: { id: [{ id: 'p', type: 'paragraph', text: 'tanpa placeholder' }] } },
  catalog: unknown[] = DEFAULT_CATALOG,
) {
  const prisma = {
    client: {
      contractTemplateVersion: {
        findFirst: async () => ({
          id: 11,
          versionNumber: 3,
          contentDefinition,
          fieldDefinitions,
          template: { family: 'MITRA' }
        })
      },
      templateFieldDefinition: {
        findMany: async () => catalog
      }
    },
    appSetting: { findMany: async () => [] }
  }
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { TemplateSnapshotService } = require('./template-snapshot.service')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return new TemplateSnapshotService(prisma as never) as {
    buildSnapshot: (input: Record<string, unknown>) => Promise<Record<string, any> | null>
    normalizeContractInputValues: (defs: unknown[], data: unknown) => Record<string, any> | undefined
  }
}

function contractInput(key: string, dataType: string, extra: Record<string, unknown> = {}) {
  return { key, label: key, dataType, sourceType: 'CONTRACT_INPUT', required: true, ...extra }
}

const baseInput = {
  templateId: 5,
  contract: {
    contractNo: '001/MITRA/2026',
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 11, 31)
  }
}

describe('TemplateSnapshotService.buildSnapshot (normalisasi templateData)', () => {
  it('memformat tanggal dari input <input type="date"> menjadi tanggal Indonesia', async () => {
    const service = makeSnapshotService([contractInput('ktp_issued_date', 'DATE')])

    const result = await service.buildSnapshot({ ...baseInput, templateData: { ktp_issued_date: '2026-03-12' } })

    // Kalau nilai tersimpan sebagai string, resolver mencetaknya mentah
    // ("2026-03-12") alih-alih format dokumen.
    expect(result?.resolvedTemplateData['custom.ktp_issued_date'].displayValue).toBe('12 Maret 2026')
    // `value` sengaja ISO string (dipakai renderer/API), `displayValue` yang diformat.
    expect(result?.resolvedTemplateData['custom.ktp_issued_date'].value).toBe('2026-03-12T00:00:00.000Z')
  })

  it('menerima tanggal format tampilan DD/MM/YYYY dari UI', async () => {
    const service = makeSnapshotService([contractInput('ktp_issued_date', 'DATE')])

    const result = await service.buildSnapshot({ ...baseInput, templateData: { ktp_issued_date: '12/03/2026' } })

    expect(result?.resolvedTemplateData['custom.ktp_issued_date'].displayValue).toBe('12 Maret 2026')
  })

  it('menolak tanggal yang tidak bisa di-parse alih-alih mencetak Invalid Date', async () => {
    const service = makeSnapshotService([contractInput('ktp_issued_date', 'DATE')])

    await expect(service.buildSnapshot({ ...baseInput, templateData: { ktp_issued_date: 'besok' } }))
      .rejects.toThrow(/bukan tanggal yang valid/)
  })

  it('mengubah angka berbentuk string menjadi number', async () => {
    const service = makeSnapshotService([contractInput('durasi_hari', 'NUMBER')])

    const result = await service.buildSnapshot({ ...baseInput, templateData: { durasi_hari: '30' } })

    expect(result?.resolvedTemplateData['custom.durasi_hari'].value).toBe(30)
  })

  it('menolak nilai NON-numerik untuk field NUMBER', async () => {
    const service = makeSnapshotService([contractInput('durasi_hari', 'NUMBER')])

    await expect(service.buildSnapshot({ ...baseInput, templateData: { durasi_hari: 'tiga puluh' } }))
      .rejects.toThrow(/harus berupa angka/)
  })

  it('menolak nilai DROPDOWN di luar daftar opsi', async () => {
    const service = makeSnapshotService([contractInput('shift', 'DROPDOWN', { options: ['PAGI', 'SIANG'] })])

    await expect(service.buildSnapshot({ ...baseInput, templateData: { shift: 'MALAM' } }))
      .rejects.toThrow(/harus salah satu dari/)
  })

  it('menerima nilai DROPDOWN yang ada di daftar opsi', async () => {
    const service = makeSnapshotService([contractInput('shift', 'DROPDOWN', { options: ['PAGI', 'SIANG'] })])

    const result = await service.buildSnapshot({ ...baseInput, templateData: { shift: 'SIANG' } })

    expect(result?.resolvedTemplateData['custom.shift'].displayValue).toBe('SIANG')
  })

  it('menerima DROPDOWN yang opsinya berbentuk { label, value } seperti di editor template', async () => {
    // Editor template menyimpan opsi sebagai objek; UI form hanya mengirim
    // `value`-nya. Kalau backend membandingkan objek mentah, semua pilihan
    // petugas akan ditolak.
    const service = makeSnapshotService([contractInput('shift', 'DROPDOWN', {
      options: [{ label: 'Pagi', value: 'PAGI' }, { label: 'Siang', value: 'SIANG' }]
    })])

    const result = await service.buildSnapshot({ ...baseInput, templateData: { shift: 'PAGI' } })

    expect(result?.resolvedTemplateData['custom.shift'].displayValue).toBe('PAGI')
  })

  it('tetap menolak kontrak bila field wajib belum diisi', async () => {
    const service = makeSnapshotService([contractInput('ktp_issued_date', 'DATE')])

    await expect(service.buildSnapshot({ ...baseInput, templateData: {} }))
      .rejects.toThrow(/belum diisi/)
  })
})

describe('TemplateSnapshotService.normalizeContractInputValues', () => {
  it('tidak membuat placeholder untuk field yang tidak ada di versi PUBLISHED', async () => {
    const service = makeSnapshotService([contractInput('ktp_issued_date', 'DATE')])

    const result = await service.buildSnapshot({
      ...baseInput,
      templateData: { ktp_issued_date: '2026-03-12', field_hantu: 'nilai dari versi lama' }
    })

    // Key tak dikenal tidak punya placeholder di contentDefinition, jadi nilainya
    // tidak pernah tercetak. Yang penting: tidak melempar dan tidak "sukses
    // diam-diam" seolah nilai itu terpakai.
    expect(result?.resolvedTemplateData['custom.field_hantu']).toBeUndefined()
    expect(result?.resolvedTemplateData['custom.ktp_issued_date'].displayValue).toBe('12 Maret 2026')
  })

  it('mempertahankan key di luar field CONTRACT_INPUT agar data lama tidak hilang', async () => {
    const service = makeSnapshotService([])

    const normalized = service.normalizeContractInputValues(
      [contractInput('ktp_issued_date', 'DATE'), { key: 'employee.nik', sourceType: 'SYSTEM', dataType: 'TEXT' }],
      { employee_note: 'catatan lama', ktp_issued_date: '2026-03-12' }
    )

    // `templateData` di-echo apa adanya oleh API; normalisasi hanya mengubah
    // key yang benar-benar dikenali versi PUBLISHED.
    expect(normalized?.employee_note).toBe('catatan lama')
    expect(normalized?.ktp_issued_date).toBeInstanceOf(Date)
  })

  it('menormalkan key field definitions berprefix custom. saat mencocokkan nilai', async () => {
    const service = makeSnapshotService([])

    const normalized = service.normalizeContractInputValues(
      [{ key: 'custom.ktp_issued_date', label: 'KTP', dataType: 'DATE', sourceType: 'CONTRACT_INPUT' }],
      { ktp_issued_date: '2026-03-12' }
    )

    expect(normalized?.ktp_issued_date).toBeInstanceOf(Date)
  })

  it('mengembalikan undefined untuk templateData kosong', async () => {
    const service = makeSnapshotService([])

    expect(service.normalizeContractInputValues([], null)).toBeUndefined()
    expect(service.normalizeContractInputValues([], undefined)).toBeUndefined()
  })
})

/**
 * Regresi bug nyata: placeholder SYSTEM yang dipakai konten TAPI tidak terdaftar
 * di `fieldDefinitions` versi tidak pernah di-resolve, sehingga tercetak
 * `...............` di PDF — padahal pratinjau (memakai data contoh) lengkap.
 */
describe('TemplateSnapshotService.buildSnapshot — placeholder SYSTEM yang belum terdaftar', () => {
  it('menambahkan field SYSTEM yang dirujuk konten walau tidak ada di fieldDefinitions', async () => {
    const service = makeSnapshotService(
      [], // fieldDefinitions kosong
      { languages: { id: [{ id: 'p', type: 'paragraph', text: 'Nama: {{employee.fullName}}' }] } },
    )

    const result = await service.buildSnapshot({
      templateId: 1,
      employee: { fullName: 'Budi Santoso' },
      contract: { contractNo: 'X/1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      templateData: {},
    } as never)

    // Tanpa perbaikan, `employee.fullName` tidak ada di resolvedTemplateData
    // sehingga renderer mencetak `...............`.
    expect(result?.resolvedTemplateData['employee.fullName']?.displayValue).toBe('Budi Santoso')
    const defs = (result?.templateSnapshot as any)?.fieldDefinitions ?? []
    expect(defs.some((d: any) => d.key === 'employee.fullName')).toBe(true)
  })

  it('TIDAK menambahkan field CONTRACT_INPUT yang tidak ter-bind (harus eksplisit)', async () => {
    const service = makeSnapshotService(
      [],
      { languages: { id: [{ id: 'p', type: 'paragraph', text: '{{custom.shift_code}}' }] } },
    )

    const result = await service.buildSnapshot({
      templateId: 1,
      employee: { fullName: 'Budi' },
      contract: { contractNo: 'X/1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      templateData: {},
    } as never)

    expect(result?.resolvedTemplateData['custom.shift_code']).toBeUndefined()
  })

  /**
   * Regresi bug LAPANGAN: template MITRA-111 menyisipkan sederet placeholder
   * SYSTEM pada blok "Para Pihak" (blok ke-5) TANPA menambahkannya ke
   * `fieldDefinitions` versi. Akibatnya blok itu tercetak `...............`
   * walaupun data karyawan lengkap dan pratinjau tampak benar.
   *
   * Test ini memakai key yang SAMA dengan konten nyata template tersebut.
   */
  it('mengisi semua placeholder blok "Para Pihak" MITRA yang hilang dari fieldDefinitions', async () => {
    const catalog = [
      { key: 'contract.contractNo', label: 'Nomor Kontrak', dataType: 'TEXT', sourceType: 'SYSTEM' },
      { key: 'contract.startDate', label: 'Tanggal Mulai', dataType: 'DATE', sourceType: 'SYSTEM' },
      { key: 'employee.employeeNo', label: 'Nomor Induk Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
      { key: 'employee.jobRole', label: 'Jabatan', dataType: 'TEXT', sourceType: 'SYSTEM' },
    ]
    const service = makeSnapshotService(
      [], // versi ini belum mendaftarkan satu pun field di atas
      {
        languages: {
          id: [{
            id: 'para-1-4',
            type: 'paragraph',
            text: 'Nomor {{contract.contractNo}} sejak {{contract.startDate}} oleh {{employee.employeeNo}} sebagai {{employee.jobRole}}',
          }],
        },
      },
      catalog,
    )

    const result = await service.buildSnapshot({
      templateId: 111,
      employee: { employeeNo: '1112', jobRole: { id: 1, name: 'Supervisor Gudang' } },
      contract: { contractNo: '015/KK/KUKP/SII/X/2026', startDate: new Date(2026, 9, 1), endDate: new Date(2027, 2, 31) },
      templateData: {},
    } as never)

    // Tanpa perbaikan, keempat key ini tidak ada di `resolvedTemplateData`
    // dan renderer MITRA mencetak `...............` untuk semuanya.
    const resolved = result?.resolvedTemplateData ?? {}
    expect(resolved['contract.contractNo']?.displayValue).toBe('015/KK/KUKP/SII/X/2026')
    expect(resolved['contract.startDate']?.displayValue).toBe('1 Oktober 2026')
    expect(resolved['employee.employeeNo']?.displayValue).toBe('1112')
    expect(resolved['employee.jobRole']?.displayValue).toBe('Supervisor Gudang')

    // Snapshot harus memuat key ini supaya perbaikan ikut tersimpan di kontrak.
    const defs = (result?.templateSnapshot as any)?.fieldDefinitions ?? []
    for (const key of ['contract.contractNo', 'contract.startDate', 'employee.employeeNo', 'employee.jobRole']) {
      expect(defs.some((d: any) => d.key === key)).toBe(true)
    }
  })

  /**
   * Fail-loud (keputusan produk): field SYSTEM yang ditambahkan otomatis
   * dianggap WAJIB. Bila datanya benar-benar kosong (mis. `employee.nik` null),
   * pembuatan kontrak DITOLAK dengan pesan jelas — bukan diam-diam mencetak
   * `...............`. Ini mencegah dokumen legal terbit dengan data bolong.
   */
  it('menolak generate bila field SYSTEM yang dirujuk konten tidak punya nilai', async () => {
    const service = makeSnapshotService(
      [],
      { languages: { id: [{ id: 'p', type: 'paragraph', text: 'NIK {{employee.nik}}' }] } },
      [{ key: 'employee.nik', label: 'NIK Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' }],
    )

    await expect(service.buildSnapshot({
      templateId: 111,
      employee: { fullName: 'Budi' }, // tanpa nik
      contract: { contractNo: 'X/1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      templateData: {},
    } as never)).rejects.toThrow(/NIK Karyawan/)
  })
})
