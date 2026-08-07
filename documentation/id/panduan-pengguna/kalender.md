# Kalender

Modul Kalender menampilkan agenda internal secara **terpadu**: agenda buatan pengguna digabung dengan data kadaluarsa dari kontrak karyawan, kontrak vendor, legal koperasi, dan sertifikasi/ijin.

## Membuka Kalender

Klik **Kalender** di sidebar. Tersedia tiga mode tampilan yang bisa diganti via toggle di header:

| Tampilan | Deskripsi |
|----------|-----------|
| **Bulan (Month)** | Grid 1 bulan penuh, tampilan ringkas agenda |
| **Minggu (Week)** | Grid jam 00–23, strip all-day, blok agenda berbasis waktu |
| **Hari (Day)** | Grid jam 24 jam, blok agenda penuh, info pembuat langsung |

## Navigasi Waktu

- Tombol **◀ (Prev)** / **▶ (Next)** untuk berpindah periode
- Tombol **Today** kembali ke tanggal hari ini
- **Double-klik tanggal** di Month View → langsung berpindah ke Day View untuk tanggal tersebut

## Membuat Agenda

1. Klik tombol **Tambah Agenda** di header (atau pilih tanggal tertentu).
2. Isi form:
   - **Judul** (wajib)
   - **Tanggal** (wajib)
   - **Jam Mulai** (`startTime`, wajib) — berlaku untuk agenda berbasis waktu
   - **Jam Selesai** (opsional)
   - **Lokasi**, **Deskripsi** (opsional)
   - **Label Warna** — 12 pilihan (blue, sky, teal, green, yellow, orange, red, pink, purple, indigo, gray, slate)
   - **Penerima Notifikasi** — multi-select user + pintasan "Semua User"

3. Klik **Simpan**.

## Mengedit / Menghapus Agenda

- Klik item agenda aktif di **Week/Day View** → muncul tooltip berisi informasi lengkap (judul, waktu, lokasi, deskripsi, pembuat) dengan tombol **Edit** dan **Hapus**.
- **Edit** → form terisi data lama, lalu simpan.
- **Hapus** → konfirmasi toast sebelum agenda dihapus.

## Notifikasi Agenda

Agenda yang dibuat bisa otomatis memicu notifikasi ke user yang dipilih:

- **Notifikasi pagi H-0** pada jam yang dikonfigurasi di **Pengaturan > Umum** (`agendaNotificationMorningHour`, default jam 7)
- **Notifikasi 5 menit sebelum** agenda dimulai
- Agenda yang sudah lewat otomatis ditandai resolved

## Data Otomatis (read-only)

Selain agenda buatan pengguna, kalender juga menampilkan data berbasis tanggal dari:

| Sumber | Keterangan |
|--------|-----------|
| Kontrak karyawan | Tanggal berakhir kontrak |
| Kontrak vendor/customer | Tanggal berakhir kontrak |
| Legal koperasi | Tanggal berakhir dokumen |
| Sertifikasi & Ijin | Tanggal expired dokumen karyawan |

Item-item ini ditampilkan read-only (tidak bisa diedit dari kalender), sumber aslinya tetap dikelola di modul masing-masing.

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Kalender 401 saat reload | `useRequestFetch()` dipakai untuk meneruskan cookie saat SSR |
| Form Tambah/Edit tertutup modal detail | Buka ulang form; form akan memulai dengan tanggal baru |
| Baris terakhir bulan terpotong | Formula `rangeEnd` sudah diperbaiki agar baris akhir selalu tampil penuh |
| Jam notifikasi selalu balik ke 7 | Pastikan backend di-restart setelah update DTO `agendaNotificationMorningHour` |