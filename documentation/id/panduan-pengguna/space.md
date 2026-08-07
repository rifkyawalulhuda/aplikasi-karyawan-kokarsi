# Space

Modul **Space** menyediakan ruang kerja kolaboratif untuk tim/sub-unit. Setiap Space berisi **Kanban Board**, **List View**, dan **Dokumen** yang bisa dibagikan bersama antar member, dengan pembaruan **real-time (SSE)** tanpa perlu reload.

## Membuat Space

1. Klik halaman Space di sidebar → daftar Space.
2. Klik **Buat Space**.
3. Isi:
   - **Nama** (wajib)
   - **Deskripsi** (opsional)
   - **Ikon & Warna** sebagai identitas visual
   - **Template Kolom** — Simple / Dev / Bug / HR / Custom
4. Klik **Simpan**.

## Kelola Member

Di dalam Space, buka menu **Kelola Member** untuk menambah atau menghapus user sebagai member. Hanya member Space yang dapat mengakses dan berkolaborasi di dalamnya.

## Pilihan Tampilan

Toggle di header Space menyediakan tiga mode:

| View | Deskripsi |
|------|-----------|
| **Board** | Kanban dengan kolom dan kartu, drag & drop antar kolom |
| **List** | Tabel semua data dengan sort / filter / grouping |
| **Docs** | Dokumen kolaboratif dengan editor rich-text |

## Kanban Board

### Kolomkan
- Space memiliki beberapa kolom sesuai template yang dipilih.
- Bisa menambah kolom baru, mengubah nama, mengurutkan ulang, atau menghapus kolom.
- Setiap kolom punya label dan warna tersendiri.

### Kartu
Buat kartu di kolom dengan mengisi judul, lalu klik kartu untuk membuka detail:

| Fitur | Keterangan |
|-------|-----------|
| **Deskripsi** | Rincian/penjelasan pekerjaan |
| **Prioritas** | NONE / LOW / MEDIUM / HIGH / URGENT (pill berwarna) |
| **Tenggat (Due Date)** | Waktu jatuh tempo; kartu terlambat ada indikator berdenyut |
| **Assignee** | Tugaskan ke member |
| **Label** | Tag kustom |
| **Warna Cover** | Warna pembeda kartu |
| **Checklist** | Daftar pekerjaan dengan progress bar dan centang |
| **Attachment** | Unggah file (maks 20MB) atau tempel link |
| **Komentar** | Diskusi + @mention member |
| **Pindah Kolom** | Drag kartu ke kolom lain, atau lewat menu |

## List View

Seluruh data dalam bentuk tabel dengan dukungan:
- **Sorting** — berdasar judul, prioritas, tanggal, waktu buat/perbarui
- **Filter** — per kolom/status
- **Grouping** — dikelompokkan per column atau datar

## Dokumen (Docs View)

### Membuat Dokumen
Klik **Dokumen Baru** → beri judul, pilih emoji, lalu simpan. Dokumen akan terbuka di **modal editor** inline.

### Editor Rich-Text (Notion-style)
Mendukung: bold, italic, strikethrough, heading 2/3, list berpoin & bernomor, blockquote, kode inline & blok kode, undo/redo.

**Menyisipkan gambar** tersedia beberapa cara:
- **Tombol toolbar** (ikon gambar) → pilih **Upload File** atau **URL Gambar**
- **Drag & drop** gambar langsung ke area editor
- **Paste (Ctrl+V)** dari clipboard
- Maksimal **5MB**, mendukung semua format gambar; ada kolom alt text.

### Menyimpan Dokumen
- **Auto-save** secara debounce 1,5 detik setelah berhenti mengetik.
- Tombol **Simpan** (modal: di footer, halaman penuh: di navbar) aktif hanya saat ada perubahan belum tersimpan.
- Status cerdas: *Perubahan belum disimpan* → *Menyimpan…* → *Tersimpan • jam*.
- **Ctrl/Cmd+S** untuk menyimpan manual.
- Tampilan **word count** dan **character count** di bawah editor.
- Saat ada perubahan belum disimpan lalu menutup → muncul konfirmasi **Buang Perubahan**.

### Halaman Penuh
Klik ikon **expand/maximize** di header modal untuk berpindah ke **halaman full-page** yang lebih lebar. Di halaman penuh tersedia status simpan + tombol **Simpan** di navbar, serta konfirmasi saat meninggalkan halaman (termasuk refresh / tutup tab).

## Pengumuman & Pinned

Bagian atas Space menyediakan **area announcement/pinned notes** yang bisa di-*pin/unpin* dan diedit inline. Berguna untuk informasi penting di atas board.

## Real-time (SSE)

Perubahan apa pun (buat/pindah kartu, checklist, komentar, dokumen) di-broadcast ke member Space yang sedang membuka Space yang sama, setiap **tanpa perlu refresh**.

## Notifikasi Space

Beberapa aktivitas memicu notifikasi di bell:
- Kartu di-assign ke kamu
- **@mention** di komentar
- **Due date H-1**
- Kartu dipindah antar kolom

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Upload gambar editor 404 "upload-image" | Pastikan endpoint Nitro `server/api/spaces/[id]/documents/upload-image.post.ts` ada dan server di-restart |
| Gambar card rusak saat upload | Proxy upload harus memakai `proxyRequest` (stream mentah), bukan `readBodyAs`+`$fetch.raw` yang mendecode binary |
| Gambar card lama tetap rusak | File corrupt di `backend/uploads/spaces/` dan record `space_card_attachments` harus dihapus, lalu upload ulang |