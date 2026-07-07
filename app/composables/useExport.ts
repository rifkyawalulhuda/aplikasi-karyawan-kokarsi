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
      'Lokasi Kerja': e.workLocation?.name ?? '-',
      'Jabatan': e.jobRole?.name ?? '-',
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
      'Foto': e.fotoKaryawan || '-',
      'Dibuat': fmt(e.createdAt),
      'Diperbarui': fmt(e.updatedAt),
    }))
  }

  async function fetchAllEmployees(): Promise<Employee[]> {
    const res = await $fetch<{ data: Employee[]; total: number }>('/api/employees/export')
    return res?.data ?? []
  }

  async function exportExcel(filename = 'data-karyawan') {
    const employees = await fetchAllEmployees()
    const rows = toRows(employees, true)
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Karyawan')

    // Auto column width
    const cols = Object.keys(rows[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] ?? '').length)) + 2
    }))
    ws['!cols'] = cols

    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  async function exportPDF(filename = 'data-karyawan') {
    const employees = await fetchAllEmployees()
    const rows = toRows(employees)

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFontSize(14)
    doc.text('Data Karyawan Kokarsi PT. Sankyu', 14, 15)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`Total: ${employees.length} karyawan  |  Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 21)

    const headers = Object.keys(rows[0] ?? {})
    const body = rows.map(r => headers.map(h => String((r as any)[h] ?? '-')))

    autoTable(doc, {
      head: [headers],
      body,
      startY: 26,
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 10, right: 10 },
      tableWidth: 'auto',
    })

    doc.save(`${filename}.pdf`)
  }

  function toWarningLetterRows(letters: WarningLetter[]) {
    return letters.map((l, i) => ({
      'No': i + 1,
      'Nomor Surat': l.letterNumber ?? '-',
      'Nama Karyawan': l.employee?.fullName ?? '-',
      'No. Induk Karyawan': l.employee?.employeeNo ?? '-',
      'Jabatan': l.employee?.jobRole?.name ?? '-',
      'Level SP': `SP ${l.warningLevel}`,
      'Jenis Pelanggaran': Array.isArray(l.violationType) ? l.violationType.join(', ') : '-',
      'Tanggal Surat': fmt(l.letterDate),
      'Berlaku Sampai': fmt(l.validUntil),
      'Pengurus Koperasi': l.processedByName ?? '-',
      'Dibuat': fmt(l.createdAt),
    }))
  }

  function exportWarningLettersExcel(letters: WarningLetter[], filename = 'surat-peringatan') {
    if (!letters.length) return
    const rows = toWarningLetterRows(letters)
    const ws = XLSX.utils.json_to_sheet(rows)
    const colWidths = [
      { wch: 5 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 22 },
      { wch: 8 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 16 },
    ]
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Surat Peringatan')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  return { exportExcel, exportPDF, exportWarningLettersExcel }
}
