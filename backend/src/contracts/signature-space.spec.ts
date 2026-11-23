import {
  MAX_SIGNATURE_SPACE_MM,
  MITRA_DEFAULT_SIGNATURE_SPACE_PT,
  PKWT_DEFAULT_SIGNATURE_SPACE_MM,
  PT_PER_MM,
  normalizeSignatureSpaceMm,
  signatureSpaceDefaultMm,
  signatureSpacePt,
  signatureSpacePtFromBlocks,
} from './signature-space'

describe('signature-space', () => {
  describe('normalizeSignatureSpaceMm', () => {
    it('menerima rentang 0–100 mm', () => {
      expect(normalizeSignatureSpaceMm(0)).toBe(0)
      expect(normalizeSignatureSpaceMm(28.95)).toBe(28.95)
      expect(normalizeSignatureSpaceMm(MAX_SIGNATURE_SPACE_MM)).toBe(100)
    })

    it('membulatkan ke 2 desimal', () => {
      expect(normalizeSignatureSpaceMm(1.234)).toBe(1.23)
    })

    it('menolak nilai di luar rentang dan tipe salah', () => {
      expect(normalizeSignatureSpaceMm(-1)).toBeUndefined()
      expect(normalizeSignatureSpaceMm(101)).toBeUndefined()
      expect(normalizeSignatureSpaceMm('30')).toBeUndefined()
      expect(normalizeSignatureSpaceMm(Number.NaN)).toBeUndefined()
      expect(normalizeSignatureSpaceMm(Number.POSITIVE_INFINITY)).toBeUndefined()
      expect(normalizeSignatureSpaceMm(undefined)).toBeUndefined()
    })
  })

  describe('signatureSpacePt', () => {
    it('tanpa nilai → default MITRA 88 pt (persis, bukan hasil konversi)', () => {
      expect(signatureSpacePt(undefined, 'MITRA')).toBe(MITRA_DEFAULT_SIGNATURE_SPACE_PT)
    })

    it('tanpa nilai → default PKWT 28,95 mm', () => {
      expect(signatureSpacePt(undefined, 'PKWT')).toBeCloseTo(28.95 * PT_PER_MM, 6)
    })

    it('mengonversi mm ke pt', () => {
      expect(signatureSpacePt(40, 'PKWT')).toBeCloseTo(113.39, 2)
      expect(signatureSpacePt(40, 'MITRA')).toBeCloseTo(113.39, 2)
    })

    it('nilai tidak sah diperlakukan seperti kosong', () => {
      expect(signatureSpacePt(-5, 'MITRA')).toBe(MITRA_DEFAULT_SIGNATURE_SPACE_PT)
      expect(signatureSpacePt(500, 'PKWT')).toBeCloseTo(PKWT_DEFAULT_SIGNATURE_SPACE_MM * PT_PER_MM, 6)
    })
  })

  describe('signatureSpaceDefaultMm', () => {
    it('default per keluarga dapat ditampilkan di editor', () => {
      expect(signatureSpaceDefaultMm('PKWT')).toBe(28.95)
      expect(signatureSpaceDefaultMm('MITRA')).toBeCloseTo(31.04, 2)
    })
  })

  describe('signatureSpacePtFromBlocks', () => {
    const sig = (extra: Record<string, unknown> = {}) => ({ type: 'signature', ...extra })

    it('membaca nilai dari blok tanda tangan', () => {
      expect(signatureSpacePtFromBlocks([sig({ signatureSpaceMm: 40 })], [], 'PKWT'))
        .toBeCloseTo(40 * PT_PER_MM, 6)
    })

    it('blok ID menang atas blok EN (tabel tanda tangan cuma satu)', () => {
      expect(signatureSpacePtFromBlocks(
        [sig({ signatureSpaceMm: 40 })],
        [sig({ signatureSpaceMm: 20 })],
        'PKWT',
      )).toBeCloseTo(40 * PT_PER_MM, 6)
    })

    it('jatuh ke blok EN bila blok ID tidak punya nilainya', () => {
      expect(signatureSpacePtFromBlocks([sig()], [sig({ signatureSpaceMm: 20 })], 'PKWT'))
        .toBeCloseTo(20 * PT_PER_MM, 6)
    })

    it('tanpa blok tanda tangan sama sekali → default keluarga', () => {
      expect(signatureSpacePtFromBlocks([{ type: 'paragraph', text: 'x' }], undefined, 'MITRA'))
        .toBe(MITRA_DEFAULT_SIGNATURE_SPACE_PT)
      expect(signatureSpacePtFromBlocks(undefined, undefined, 'PKWT'))
        .toBeCloseTo(PKWT_DEFAULT_SIGNATURE_SPACE_MM * PT_PER_MM, 6)
    })
  })
})
