import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Employee, WarningLetter } from '~/types'

export function useExport() {
  function employmentStatusLabel(status: string) {
    return status === 'AKTIF'
      ? 'Aktif'
      : status === 'KONTRAK_EXPIRED'
        ? 'Kontrak Expired'
        : status === 'RESIGN'
          ? 'Resign'
          : status === 'PHK'
            ? 'PHK'
            : status
  }

  function fmt(val: string | undefined) {
    if (!val) return '-'
    return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function genderLabel(g: string) {
    return g === 'MALE' ? 'Laki-laki' : g === 'FEMALE' ? 'Perempuan' : g
  }

  function statusLabel(s: string) {
    return s === 'AKTIF' ? 'Aktif' : s === 'AKAN_HABIS' ? 'Akan Habis' : s === 'EXPIRED' ? 'Expired' : s === 'SELESAI' ? 'Selesai' : s === 'DIBATALKAN' ? 'Dibatalkan' : s
  }

  function normalizeDate(val?: string | Date | null) {
    if (!val) return null
    const d = new Date(val)
    return Number.isNaN(d.getTime()) ? null : d
  }

  function resolveContractStatus(contract: any) {
    return contract?.status ?? ''
  }

  function resolveActiveContract(employee: any) {
    const contracts = Array.isArray(employee?.contracts) ? [...employee.contracts] : []
    if (!contracts.length) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activeByDate = contracts.find((contract: any) => {
      const start = normalizeDate(contract?.startDate)
      const end = normalizeDate(contract?.endDate)
      if (!start || !end) return false
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      return start <= today && end >= today && contract?.status !== 'DIBATALKAN'
    })

    if (activeByDate) return activeByDate

    return contracts.find((contract: any) => contract?.status === 'AKTIF')
      ?? contracts.find((contract: any) => contract?.status !== 'DIBATALKAN')
      ?? contracts[0]
  }

  function toRows(employees: Employee[], includeDepartment = false) {
    return employees.map((e: any, i: number) => ({
      'No': i + 1,
      'No. Induk Karyawan': e.employeeNo ?? '-',
      'Nama Lengkap': e.fullName ?? '-',
      'NIK': e.nik ?? '-',
      'Status Kepegawaian': employmentStatusLabel(e.employmentStatus ?? '-'),
      'Jenis Kelamin': genderLabel(e.gender ?? ''),
      'Tempat Lahir': e.birthPlace ?? '-',
      'Tanggal Lahir': fmt(e.birthDate),
      'Alamat': e.address ?? '-',
      'Tanggal Bergabung': fmt(e.joinDate),
      'Email': e.email ?? '-',
      'No. HP': e.phoneNumber ?? '-',
      'Pendidikan': e.educationLevel ?? '-',
      'Site': e.workLocation?.name ?? '-',
      'Pekerjaan': e.jobRole?.name ?? '-',
      'Level Jabatan': e.jobLevel?.name ?? '-',
      ...(includeDepartment ? { 'Departement': e.department?.name ?? '-' } : {}),
      'Status Pajak': e.taxStatus?.name ?? '-',
      ...(() => {
        const c = resolveActiveContract(e)
        return {
          'No. Kontrak Aktif': c?.contractNo ?? '-',
          'Tgl. Mulai Kontrak': fmt(c?.startDate),
          'Tgl. Selesai Kontrak': fmt(c?.endDate),
          'Status Kontrak': statusLabel(resolveContractStatus(c) ?? ''),
        }
      })(),
      'Dibuat': fmt(e.createdAt),
      'Diperbarui': fmt(e.updatedAt),
    }))
  }

  function toPDFRows(employees: Employee[]) {
    return employees.map((e: any, i: number) => {
      const c = resolveActiveContract(e)
      return {
        'No': i + 1,
        'No. Induk': e.employeeNo ?? '-',
        'Nama': e.fullName ?? '-',
        'Status': employmentStatusLabel(e.employmentStatus ?? '-'),
        'Gender': genderLabel(e.gender ?? ''),
        'Tgl Lahir': [e.birthPlace, fmt(e.birthDate)].filter(Boolean).join(', ') || '-',
        'Alamat': e.address ?? '-',
        'Email': e.email ?? '-',
        'No. HP': e.phoneNumber ?? '-',
        'Site': e.workLocation?.name ?? '-',
        'Dept': e.department?.name ?? '-',
        'Pekerjaan': e.jobRole?.name ?? '-',
        'Tgl Gabung': fmt(e.joinDate),
        'Tgl Kontrak': fmt(c?.startDate),
        'Sls Kontrak': fmt(c?.endDate),
        'Status Kontrak': statusLabel(resolveContractStatus(c) ?? ''),
      }
    })
  }

  async function fetchAllEmployees(): Promise<Employee[]> {
    const res = await $fetch<{ data: Employee[]; total: number }>('/api/employees/export')
    return res?.data ?? []
  }

  async function exportExcel(filename = 'data-karyawan') {
    const employees = await fetchAllEmployees()
    const rows = toRows(employees, true)
    const ws = XLSX.utils.json_to_sheet(rows)

    // Manual column width (capped — mencegah kolom Alamat/Email terlalu lebar)
    ws['!cols'] = [
      { wch: 5 },  // No
      { wch: 18 }, // No. Induk Karyawan
      { wch: 30 }, // Nama Lengkap
      { wch: 20 }, // NIK
      { wch: 18 }, // Status Kepegawaian
      { wch: 14 }, // Jenis Kelamin
      { wch: 18 }, // Tempat Lahir
      { wch: 14 }, // Tanggal Lahir
      { wch: 36 }, // Alamat
      { wch: 16 }, // Tanggal Bergabung
      { wch: 30 }, // Email
      { wch: 16 }, // No. HP
      { wch: 14 }, // Pendidikan
      { wch: 16 }, // Site
      { wch: 24 }, // Pekerjaan
      { wch: 16 }, // Level Jabatan
      { wch: 20 }, // Departement
      { wch: 18 }, // Status Pajak
      { wch: 22 }, // No. Kontrak Aktif
      { wch: 18 }, // Tgl. Mulai Kontrak
      { wch: 18 }, // Tgl. Selesai Kontrak
      { wch: 16 }, // Status Kontrak
      { wch: 14 }, // Dibuat
      { wch: 14 }, // Diperbarui
    ]

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    const wb = XLSX.utils.book_new()
    const sheetName = `Karyawan ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  async function exportPDF(filename = 'data-karyawan') {
    const employees = await fetchAllEmployees()
    const rows = toPDFRows(employees)

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Title
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text('Data Karyawan Kokarsi PT. Sankyu', 14, 15)

    // Subtitle
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(
      `Total: ${employees.length} karyawan  |  Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      14,
      21,
    )

    const headers = Object.keys(rows[0] ?? {})
    const body = rows.map(r => headers.map(h => String((r as any)[h] ?? '-')))

    autoTable(doc, {
      head: [headers],
      body,
      startY: 26,
      theme: 'grid',
      tableWidth: 'auto',
      styles: {
        fontSize: 6.5,
        cellPadding: 1,
        overflow: 'ellipsize',
        lineColor: [210, 210, 210],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        valign: 'top',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 7 },   // No
        1: { cellWidth: 16 },  // No. Induk
        2: { cellWidth: 30 },  // Nama
        3: { cellWidth: 13 },  // Status
        4: { cellWidth: 11 },  // Gender
        5: { cellWidth: 17 },  // Tgl Lahir
        6: { cellWidth: 35 },  // Alamat
        7: { cellWidth: 29 },  // Email
        8: { cellWidth: 15 },  // No. HP
        9: { cellWidth: 15 },  // Site
        10: { cellWidth: 15 }, // Dept
        11: { cellWidth: 17 }, // Pekerjaan
        12: { cellWidth: 16 }, // Tgl Gabung
        13: { cellWidth: 16 }, // Tgl Kontrak
        14: { cellWidth: 16 }, // Sls Kontrak
        15: { cellWidth: 13 }, // Status Kontrak
      },
      margin: { left: 8, right: 8, bottom: 12 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages()
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(
          `Halaman ${data.pageNumber} dari ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 5,
          { align: 'center' },
        )
      },
    })

    doc.save(`${filename}.pdf`)
  }

  function toWarningLetterRows(letters: WarningLetter[]) {
    return letters.map((l, i) => ({
      'No': i + 1,
      'Nomor Surat': l.letterNumber ?? '-',
      'Nama Karyawan': l.employee?.fullName ?? '-',
      'No. Induk Karyawan': l.employee?.employeeNo ?? '-',
      'Pekerjaan': l.employee?.jobRole?.name ?? '-',
      'Level SP': `SP ${l.warningLevel}`,
      'Jenis Pelanggaran': Array.isArray(l.violationType) ? l.violationType.join(', ') : '-',
      'Tanggal Surat': fmt(l.letterDate),
      'Berlaku Sampai': fmt(l.validUntil),
      'Pengurus Koperasi': l.processedByName ?? '-',
      'Dibuat': fmt(l.createdAt),
    }))
  }

  function exportWarningLettersExcel(letters: WarningLetter[], year?: number, filename = 'surat-peringatan') {
    const filtered = year
      ? letters.filter(l => new Date(l.letterDate).getFullYear() === year)
      : letters
    if (!filtered.length) return false
    const rows = toWarningLetterRows(filtered)
    const ws = XLSX.utils.json_to_sheet(rows)
    const colWidths = [
      { wch: 5 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 22 },
      { wch: 8 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 16 },
    ]
    ws['!cols'] = colWidths
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Surat Peringatan')
    const suffix = year ? `-${year}` : '-semua'
    XLSX.writeFile(wb, `${filename}${suffix}.xlsx`)
    return true
  }

  function toEmployeeDocumentRows(docs: any[]) {
    return docs.map((d, i) => ({
      'No': i + 1,
      'Nama Dokumen': d.documentType?.name ?? '-',
      'Jenis': d.documentType?.documentType ?? '-',
      'Penerbit': d.documentType?.issuer ?? '-',
      'No. Dokumen': d.documentNumber ?? '-',
      'Nama Karyawan': d.employee?.fullName ?? '-',
      'No. Induk': d.employee?.employeeNo ?? '-',
      'Tgl. Berlaku Sampai': fmt(d.expiryDate),
      'Status': d.status === 'AKTIF' ? 'Aktif' : d.status === 'AKAN_EXPIRED' ? 'Akan Expired' : 'Expired',
      'Catatan': d.notes ?? '-',
      'Dibuat': fmt(d.createdAt),
    }))
  }

  function exportEmployeeDocumentsExcel(docs: any[], filename = 'sertifikasi-ijin') {
    if (!docs.length) return false
    const rows = toEmployeeDocumentRows(docs)
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 14 }, { wch: 24 }, { wch: 22 },
      { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 40 }, { wch: 16 },
    ]
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sertifikasi & Ijin')
    XLSX.writeFile(wb, `${filename}.xlsx`)
    return true
  }

  return { exportExcel, exportPDF, exportWarningLettersExcel, exportEmployeeDocumentsExcel, exportVendorContractsExcel, exportLegalKoperasiExcel, exportAkteDokumenExcel }

  function toAkteDokumenRows(docs: any[]) {
    return docs.map((d, i) => ({
      'No': i + 1,
      'Judul Akte': d.judulAkte ?? '-',
      'Nomor Akte': d.nomorAkte ?? '-',
      'Notaris': d.notaris ?? '-',
      'Tanggal': fmt(d.tanggal),
      'No. SK': d.nomorSk ?? '-',
      'Tanggal SK': fmt(d.tanggalSk),
      'Keterangan': d.keterangan ?? '-',
    }))
  }

  function exportAkteDokumenExcel(docs: any[], filename = 'akte-dokumen') {
    if (!docs.length) return false
    const rows = toAkteDokumenRows(docs)
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 32 }, { wch: 20 }, { wch: 24 },
      { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 40 },
    ]
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Akte Dokumen')
    XLSX.writeFile(wb, `${filename}.xlsx`)
    return true
  }

  function toLegalKoperasiRows(docs: any[]) {
    const categoryLabel: Record<string, string> = {
      IZIN: 'Izin',
      SERTIFIKAT: 'Sertifikat',
      KEBIJAKAN: 'Kebijakan',
      DOKUMEN_INTERNAL: 'Dok. Internal',
      DOKUMEN_B3: 'Dok. B3',
      LAIN_LAIN: 'Lain-lain',
    }
    const statusLabel = (doc: any): string => {
      if (doc.renewedTo) return 'Sudah Diperpanjang'
      switch (doc.status) {
        case 'AKTIF': return 'Aktif'
        case 'AKAN_BERAKHIR': return 'Akan Berakhir'
        case 'EXPIRED': return 'Expired'
        case 'TIDAK_AKTIF': return 'Tidak Aktif'
        default: return doc.status ?? '-'
      }
    }
    return docs.map((d, i) => ({
      'No': i + 1,
      'Kategori': categoryLabel[d.category] ?? d.category ?? '-',
      'Nama Dokumen': d.documentName ?? '-',
      'No. Dokumen': d.documentNumber ?? '-',
      'Penerbit': d.publisher ?? '-',
      'Tanggal Dokumen': fmt(d.documentDate),
      'Perlu Perpanjangan': d.needsRenewal ? 'Ya' : 'Tidak',
      'Tanggal Mulai': fmt(d.startDate),
      'Tanggal Berakhir': fmt(d.endDate),
      'Status': statusLabel(d),
      'Lokasi': d.location ?? '-',
      'Catatan': d.notes ?? '-',
    }))
  }

  function exportLegalKoperasiExcel(docs: any[], year?: number, filename = 'legal-koperasi') {
    const filtered = year
      ? docs.filter(d => new Date(d.documentDate).getFullYear() === year)
      : docs
    if (!filtered.length) return false
    const rows = toLegalKoperasiRows(filtered)
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 20 }, { wch: 36 },
    ]
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Legal Koperasi')
    const suffix = year ? `-${year}` : '-semua'
    XLSX.writeFile(wb, `${filename}${suffix}.xlsx`)
    return true
  }

  function toVendorContractRows(contracts: any[]) {
    const docTypeLabel: Record<string, string> = {
      DOKUMEN_KONTRAK: 'Kontrak',
      DOKUMEN_PERJANJIAN: 'Perjanjian',
      SURAT_PENAWARAN: 'Penawaran',
      ADDENDUM: 'Addendum',
      AMENDMENT: 'Amendment',
      SURAT: 'Surat',
    }
    const statusLabel = (doc: any): string => {
      if (doc.renewedTo) return 'Sudah Diperpanjang'
      switch (doc.status) {
        case 'AKTIF': return 'Aktif'
        case 'AKAN_BERAKHIR': return 'Akan Berakhir'
        case 'EXPIRED': return 'Expired'
        case 'TIDAK_AKTIF': return 'Tidak Aktif'
        default: return doc.status ?? '-'
      }
    }
    return contracts.map((c, i) => ({
      'No': i + 1,
      'Kategori': c.category === 'CUSTOMER' ? 'Customer' : c.category === 'VENDOR' ? 'Vendor' : (c.category ?? '-'),
      'Perusahaan': c.company?.name ?? '-',
      'Nama Dokumen': c.documentName ?? '-',
      'No. Dokumen': c.documentNumber ?? '-',
      'Jenis': docTypeLabel[c.documentType] ?? c.documentType ?? '-',
      'Tanggal Dibuat': fmt(c.createdDate),
      'Perlu Perpanjangan': c.needsRenewal ? 'Ya' : 'Tidak',
      'Tanggal Mulai': fmt(c.startDate),
      'Tanggal Berakhir': fmt(c.endDate),
      'Status': statusLabel(c),
      'Lokasi': c.location ?? '-',
      'Catatan': c.notes ?? '-',
      'Mother Agreement': c.motherAgreement?.documentName ?? '-',
    }))
  }

  function exportVendorContractsExcel(contracts: any[], year?: number, filename = 'kontrak-vendor') {
    const filtered = year
      ? contracts.filter(c => new Date(c.createdDate).getFullYear() === year)
      : contracts
    if (!filtered.length) return false
    const rows = toVendorContractRows(filtered)
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 10 }, { wch: 24 }, { wch: 30 }, { wch: 20 },
      { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 20 }, { wch: 36 }, { wch: 30 },
    ]
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kontrak Vendor')
    const suffix = year ? `-${year}` : '-semua'
    XLSX.writeFile(wb, `${filename}${suffix}.xlsx`)
    return true
  }
}
