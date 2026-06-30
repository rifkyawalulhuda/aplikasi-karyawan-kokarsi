import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Employee } from '~/types'

export function useExport() {
  function fmt(val: string | undefined) {
    if (!val) return '-'
    return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function genderLabel(g: string) {
    return g === 'MALE' ? 'Laki-laki' : g === 'FEMALE' ? 'Perempuan' : g
  }

  function statusLabel(s: string) {
    return s === 'AKTIF' ? 'Aktif' : s === 'AKAN_HABIS' ? 'Akan Habis' : s === 'EXPIRED' ? 'Expired' : s === 'DIBATALKAN' ? 'Dibatalkan' : s
  }

  function toRows(employees: Employee[]) {
    return employees.map((e: any, i: number) => ({
      'No': i + 1,
      'No. Induk Karyawan': e.employeeNo ?? '-',
      'Nama Lengkap': e.fullName ?? '-',
      'Status Kepegawaian': e.employmentStatus ?? '-',
      'Jenis Kelamin': genderLabel(e.gender ?? ''),
      'Tanggal Lahir': fmt(e.birthDate),
      'Tanggal Bergabung': fmt(e.joinDate),
      'Email': e.email ?? '-',
      'No. HP': e.phoneNumber ?? '-',
      'Pendidikan': e.educationLevel ?? '-',
      'Lokasi Kerja': e.workLocation?.name ?? '-',
      'Jabatan': e.jobRole?.name ?? '-',
      'Level Jabatan': e.jobLevel?.name ?? '-',
      'Status Pajak': e.taxStatus?.name ?? '-',
      'No. Kontrak Aktif': e.contracts?.find((c: any) => c.status === 'AKTIF')?.contractNo ?? '-',
      'Tgl. Mulai Kontrak': fmt(e.contracts?.find((c: any) => c.status === 'AKTIF')?.startDate),
      'Tgl. Selesai Kontrak': fmt(e.contracts?.find((c: any) => c.status === 'AKTIF')?.endDate),
      'Status Kontrak': statusLabel(e.contracts?.find((c: any) => c.status === 'AKTIF')?.status ?? ''),
      'Foto': e.fotoKaryawan ? `http://localhost:3001${e.fotoKaryawan}` : '-',
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
    const rows = toRows(employees)
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

  return { exportExcel, exportPDF }
}
