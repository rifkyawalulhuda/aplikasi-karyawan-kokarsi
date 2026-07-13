import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'

/**
 * Hapus file fisik dari disk berdasarkan fileUrl yang disimpan di DB.
 * Non-fatal: jika file tidak ditemukan atau gagal dihapus, tidak akan melempar error.
 */
export function deleteUploadedFile(fileUrl: string | null | undefined): void {
  if (!fileUrl) return
  try {
    // fileUrl = '/uploads/contracts/35/PKWT.pdf' → path relatif tanpa leading slash
    const relativePath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl
    const absolutePath = join(process.cwd(), relativePath)
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath)
    }
  } catch {
    // Non-fatal: log tidak diperlukan agar tidak spam console production
  }
}

/**
 * Hapus beberapa file sekaligus. Cocok untuk bulk delete (misal hapus karyawan + semua dokumennya).
 */
export function deleteUploadedFiles(fileUrls: (string | null | undefined)[]): void {
  for (const url of fileUrls) {
    deleteUploadedFile(url)
  }
}
