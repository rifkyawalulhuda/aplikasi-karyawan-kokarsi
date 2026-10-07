import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { bestScore } from './search-ranking'

/**
 * Pencarian global terpadu.
 *
 * Satu endpoint menggantikan fan-out 9 request di klien: query dijalankan
 * paralel ke Prisma, lalu **di-ranking** (persis > awalan > batas kata >
 * substring) dan dipotong per kategori. Setiap kategori mengembalikan
 * `hasMore` agar UI dapat "muat lebih banyak" tanpa menghitung total mahal.
 *
 * Bentuk `SearchHit` sengaja netral (tanpa URL): pemetaan ke rute milik
 * frontend (`app/utils/global-search.ts`), sehingga deep-link tidak bocor ke
 * lapisan data.
 */
export interface SearchHit {
  id: number
  type: string
  title: string
  subtitle?: string
  meta?: string[]
  /** Nomor/kode yang bisa disalin cepat (NIK, no. kontrak, no. dokumen). */
  code?: string
  email?: string
  phone?: string
  employeeId?: number
  employeeName?: string
  contractNo?: string
}

export interface SearchCategoryResult {
  items: SearchHit[]
  hasMore: boolean
}

export interface SearchResponse {
  q: string
  limit: number
  categories: Record<string, SearchCategoryResult>
}

const CATEGORY_KEYS = [
  'employees',
  'contracts',
  'warningLetters',
  'certifications',
  'dokKaryawan',
  'vendorContracts',
  'legalKoperasi',
  'akteDokumen',
  'generalArchives',
] as const

export type SearchCategoryKey = typeof CATEGORY_KEYS[number]

function emptyCategories(): Record<string, SearchCategoryResult> {
  return Object.fromEntries(CATEGORY_KEYS.map(key => [key, { items: [], hasMore: false }]))
}

/** Format tanggal ringkas `dd MMM yyyy` untuk label hasil. */
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
function formatDate(value: Date | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
}

const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK',
}

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
  DRAFT: 'Draft',
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(rawQuery: string, limit = 5): Promise<SearchResponse> {
    const q = String(rawQuery ?? '').trim()
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 5, 1), 50)
    if (q.length < 2) {
      return { q, limit: safeLimit, categories: emptyCategories() }
    }

    // Ambil kandidat lebih banyak dari yang ditampilkan agar ranking benar-benar
    // memilih yang terbaik, bukan sekadar urutan DB.
    const candidateTake = Math.min(Math.max(safeLimit * 4, 20), 120)

    const [
      employees,
      contracts,
      warningLetters,
      certifications,
      dokKaryawan,
      vendorContracts,
      legalKoperasi,
      akteDokumen,
      generalArchives,
    ] = await Promise.all([
      this.searchEmployees(q, candidateTake, safeLimit),
      this.searchContracts(q, candidateTake, safeLimit),
      this.searchWarningLetters(q, candidateTake, safeLimit),
      this.searchEmployeeDocuments(q, candidateTake, safeLimit, 'CERTIFICATION'),
      this.searchEmployeeDocuments(q, candidateTake, safeLimit, 'PERSONAL'),
      this.searchVendorContracts(q, candidateTake, safeLimit),
      this.searchLegalKoperasi(q, candidateTake, safeLimit),
      this.searchAkteDokumen(q, candidateTake, safeLimit),
      this.searchGeneralArchives(q, candidateTake, safeLimit),
    ])

    return {
      q,
      limit: safeLimit,
      categories: {
        employees,
        contracts,
        warningLetters,
        certifications,
        dokKaryawan,
        vendorContracts,
        legalKoperasi,
        akteDokumen,
        generalArchives,
      },
    }
  }

  /**
   * Ranking + potong. `Array.prototype.sort` stabil, dan baris dari DB sudah
   * berurut `updatedAt desc`, jadi skor sama otomatis mempertahankan recency.
   */
  private finalize<T>(
    rows: T[],
    q: string,
    limit: number,
    fieldsOf: (row: T) => unknown[],
    toHit: (row: T) => SearchHit,
  ): SearchCategoryResult {
    const scored = rows.map(row => ({ row, score: bestScore(fieldsOf(row), q) }))
    scored.sort((a, b) => b.score - a.score)
    return {
      items: scored.slice(0, limit).map(entry => toHit(entry.row)),
      hasMore: scored.length > limit,
    }
  }

  private searchEmployees(q: string, take: number, limit: number): Promise<SearchCategoryResult> {
    return this.prisma.client.employee
      .findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { employeeNo: { contains: q, mode: 'insensitive' } },
            { nik: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phoneNumber: { contains: q, mode: 'insensitive' } },
            { memberNo: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { jobRole: { select: { name: true } }, workLocation: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.fullName, row.employeeNo, row.nik, row.email, row.phoneNumber],
        row => ({
          id: row.id,
          type: 'employee',
          title: row.fullName,
          subtitle: [row.jobRole?.name, row.workLocation?.name].filter(Boolean).join(' · ') || undefined,
          meta: [EMPLOYMENT_STATUS_LABEL[row.employmentStatus] ?? row.employmentStatus],
          code: row.employeeNo,
          email: row.email ?? undefined,
          phone: row.phoneNumber ?? undefined,
        }),
      ))
  }

  private searchContracts(q: string, take: number, limit: number): Promise<SearchCategoryResult> {
    return this.prisma.client.contract
      .findMany({
        where: {
          OR: [
            { contractNo: { contains: q, mode: 'insensitive' } },
            { employee: { fullName: { contains: q, mode: 'insensitive' } } },
            { employee: { employeeNo: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { employee: { select: { id: true, fullName: true, employeeNo: true } } },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.contractNo, row.employee?.fullName, row.employee?.employeeNo],
        row => ({
          id: row.id,
          type: 'contract',
          title: row.contractNo,
          subtitle: row.employee?.fullName ?? undefined,
          meta: [CONTRACT_STATUS_LABEL[row.status] ?? row.status, `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`],
          code: row.contractNo,
          employeeId: row.employee?.id,
          employeeName: row.employee?.fullName ?? undefined,
          contractNo: row.contractNo,
        }),
      ))
  }

  private searchWarningLetters(q: string, take: number, limit: number): Promise<SearchCategoryResult> {
    return this.prisma.client.warningLetter
      .findMany({
        where: {
          OR: [
            { letterNumber: { contains: q, mode: 'insensitive' } },
            { employee: { fullName: { contains: q, mode: 'insensitive' } } },
            { employee: { employeeNo: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { employee: { select: { id: true, fullName: true, employeeNo: true } } },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.letterNumber, row.employee?.fullName, row.employee?.employeeNo],
        row => ({
          id: row.id,
          type: 'warningLetter',
          title: row.letterNumber,
          subtitle: row.employee?.fullName ?? undefined,
          meta: [`SP ${row.warningLevel}`, formatDate(row.letterDate)],
          code: row.letterNumber,
          employeeId: row.employee?.id,
          employeeName: row.employee?.fullName ?? undefined,
        }),
      ))
  }

  private searchEmployeeDocuments(
    q: string,
    take: number,
    limit: number,
    category: 'CERTIFICATION' | 'PERSONAL',
  ): Promise<SearchCategoryResult> {
    return this.prisma.client.employeeDocument
      .findMany({
        where: {
          documentType: { category },
          OR: [
            { documentNumber: { contains: q, mode: 'insensitive' } },
            { employee: { fullName: { contains: q, mode: 'insensitive' } } },
            { employee: { employeeNo: { contains: q, mode: 'insensitive' } } },
            { documentType: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: {
          employee: { select: { id: true, fullName: true, employeeNo: true } },
          documentType: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.documentNumber, row.employee?.fullName, row.employee?.employeeNo, row.documentType?.name],
        row => ({
          id: row.id,
          type: category === 'CERTIFICATION' ? 'certification' : 'dokKaryawan',
          title: row.documentType?.name ?? 'Dokumen',
          subtitle: row.employee?.fullName ?? undefined,
          meta: row.documentNumber ? [row.documentNumber] : [],
          code: row.documentNumber ?? undefined,
          employeeId: row.employee?.id,
          employeeName: row.employee?.fullName ?? undefined,
        }),
      ))
  }

  private searchVendorContracts(q: string, take: number, limit: number): Promise<SearchCategoryResult> {
    return this.prisma.client.vendorContract
      .findMany({
        where: {
          OR: [
            { documentName: { contains: q, mode: 'insensitive' } },
            { documentNumber: { contains: q, mode: 'insensitive' } },
            { company: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { company: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.documentName, row.documentNumber, row.company?.name],
        row => ({
          id: row.id,
          type: 'vendorContract',
          title: row.documentName,
          subtitle: row.company?.name ?? undefined,
          meta: [row.documentNumber],
          code: row.documentNumber,
        }),
      ))
  }

  private searchLegalKoperasi(q: string, take: number, limit: number): Promise<SearchCategoryResult> {
    return this.prisma.client.legalKoperasi
      .findMany({
        where: {
          OR: [
            { documentName: { contains: q, mode: 'insensitive' } },
            { documentNumber: { contains: q, mode: 'insensitive' } },
            { publisher: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.documentName, row.documentNumber, row.publisher],
        row => ({
          id: row.id,
          type: 'legalKoperasi',
          title: row.documentName,
          subtitle: row.publisher ?? undefined,
          meta: [row.documentNumber],
          code: row.documentNumber,
        }),
      ))
  }

  private searchAkteDokumen(q: string, take: number, limit: number): Promise<SearchCategoryResult> {
    return this.prisma.client.akteDokumen
      .findMany({
        where: {
          OR: [
            { judulAkte: { contains: q, mode: 'insensitive' } },
            { nomorAkte: { contains: q, mode: 'insensitive' } },
            { notaris: { contains: q, mode: 'insensitive' } },
            { nomorSk: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.judulAkte, row.nomorAkte, row.notaris, row.nomorSk],
        row => ({
          id: row.id,
          type: 'akteDokumen',
          title: row.judulAkte,
          subtitle: row.notaris ?? undefined,
          meta: [row.nomorAkte],
          code: row.nomorAkte,
        }),
      ))
  }

  private searchGeneralArchives(q: string, take: number, limit: number): Promise<SearchCategoryResult> {
    return this.prisma.client.generalArchive
      .findMany({
        where: {
          OR: [
            { documentName: { contains: q, mode: 'insensitive' } },
            { documentNumber: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take,
      })
      .then(rows => this.finalize(
        rows,
        q,
        limit,
        row => [row.documentName, row.documentNumber],
        row => ({
          id: row.id,
          type: 'generalArchive',
          title: row.documentName,
          subtitle: row.documentNumber ?? undefined,
          meta: [],
          code: row.documentNumber ?? undefined,
        }),
      ))
  }
}
