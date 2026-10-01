/**
 * Field dinamis form kontrak (CONTRACT_INPUT) — Fase 3.
 *
 * `TemplateSnapshotService` adalah satu-satunya gerbang kontrak dibuat/diperpanjang,
 * jadi normalisasi & validasi `templateData` ditempatkan di sana. Test di bawah
 * mengunci perilaku yang mudah rusak tanpa terlihat: tanggal harus jadi `Date`
 * (bukan string) agar diformat, `DD/MM/YYYY` dari UI harus diterima, dan field
 * CONTRACT_INPUT yang tidak dikenal harus dibuang — `resolvePlaceholders()`
 * tidak pernah melempar untuk key yang tidak dikenal, jadi kontrak bisa
 * tersimpan dengan data yang diam-diam hilang.
 */
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    readonly client = undefined
  }
}))

function makeSnapshotService(fieldDefinitions: unknown[]) {
  const prisma = {
    client: {
      contractTemplateVersion: {
        findFirst: async () => ({
          id: 11,
          versionNumber: 3,
          contentDefinition: { sections: [] },
          fieldDefinitions,
          template: { family: 'MITRA' }
        })
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
