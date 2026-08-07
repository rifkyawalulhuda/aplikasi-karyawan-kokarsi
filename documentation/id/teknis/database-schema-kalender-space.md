# Database Schema: Kalender & Space

Berikut detail tabel yang mendukung modul **Kalender** dan **Space**, ditambah relasi antar tabel.

## Tabel Kalender

### `calendar_events`
Agenda kalender. Satu baris = satu agenda (`title`, tanggal/jam, warna, penerima notifikasi).

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `title` | VARCHAR(255) | Judul agenda |
| `description` | TEXT? | Deskripsi |
| `location` | VARCHAR(255)? | Lokasi |
| `startDate` | DATE | Tanggal mulai |
| `endDate` | DATE | Tanggal selesai |
| `startTime` | VARCHAR(5) | Jam mulai (wajib, format `HH:mm`) |
| `endTime` | VARCHAR(5)? | Jam selesai |
| `color` | VARCHAR(20) | Label warna (blue/sky/teal/green/.../slate) |
| `createdByName` | VARCHAR(255) | Nama pembuat agenda |
| `assignedUserIds` | INT[] | Array ID user penerima notifikasi |
| `notifyMorningSent` | BOOLEAN | Flag notifikasi pagi H-0 sudah terkirim |
| `notifyBeforeSent` | BOOLEAN | Flag notifikasi 5 menit sebelum mulai sudah terkirim |
| `createdAt` | DATETIME | Waktu dibuat |
| `updatedAt` | DATETIME | Waktu diperbarui |

**Index:** `(startDate, endDate)`

> Integrasi kalender menampilkan data **read-only** dari kontrak/vendor/legal/sertifikasi; tabel-tabel itu tidak disimpan di kalender, melainkan di-*query* berdasarkan rentang tanggal.

## Tabel Space (Kanban)

### `spaces`
Ruang kerja kolaboratif.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `name` | VARCHAR(255) | Nama Space |
| `description` | TEXT? | Deskripsi |
| `icon` | VARCHAR(50)? | Ikon/emoji |
| `color` | VARCHAR(20) | Warna identitas (default blue) |
| `createdById` | INT | ID pembuat |
| `createdByType` | VARCHAR(20) | Tipe pembuat (user/dll) |
| `memberIds` | INT[] | Array ID member |
| `memberTypes` | VARCHAR(20)[] | Array tipe member (paralel dengan memberIds) |
| `createdAt` / `updatedAt` | DATETIME | Timestamp |

Relasi: 1 → banyak `SpaceColumn`, `SpaceAnnouncement`, `SpaceDocument`.

### `space_columns`
Kolom dalam board.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `spaceId` | INT | FK ke `spaces` (onDelete: Cascade) |
| `name` | VARCHAR(100) | Nama kolom |
| `color` | VARCHAR(20) | Warna kolom (default gray) |
| `position` | INT | Urutan kolom |
| `createdAt` / `updatedAt` | DATETIME | Timestamp |

**Index:** `(spaceId, position)`
Relasi: **1 → N** `SpaceCard`

### `space_cards`
Satu kartu di dalam kolom.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `columnId` | INT | FK ke `space_columns` (Cascade) |
| `title` | VARCHAR(255) | Judul kartu |
| `description` | TEXT? | Deskripsi |
| `position` | INT | Urutan dalam kolom |
| `priority` | ENUM | NONE/LOW/MEDIUM/HIGH/URGENT |
| `dueDate` | DATE? | Tenggat |
| `assigneeIds` | INT[] | Array ID assignee |
| `labels` | VARCHAR[] | Array label |
| `coverColor` | VARCHAR(20)? | Warna cover |
| `createdById` | INT | ID pembuat |
| `createdByType` | VARCHAR(20) | Type pembuat |
| `createdAt` / `updatedAt` | DATETIME | Timestamp |

**Index:** `(columnId, position)`
Relasi — 1 → `SpaceCardChecklist`, `SpaceCardAttachment`, `SpaceCardComment`

### `space_card_checklists`
Item checklist dalam kartu.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `cardId` | INT | FK ke `space_cards` (Cascade) |
| `title` | VARCHAR(255) | Teks item |
| `checked` | BOOLEAN | Status centang |
| `position` | INT | Urutan item |

**Index:** `(cardId, position)`

### `space_card_attachments`
Attachment kartu — bisa **FILE** (upload) atau **LINK** (URL).

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `cardId` | INT | FK ke `space_cards` (Cascade) |
| `type` | ENUM | FILE / LINK |
| `name` | VARCHAR(255) | Nama file / judul link |
| `url` | VARCHAR(500) | Path file (mis. `uploads/spaces/xxx.png`) atau URL link |
| `mimeType` | VARCHAR(100)? | MIME type (untuk FILE) |
| `size` | INT? | Ukuran byte (untuk FILE) |
| `createdAt` | DATETIME | Timestamp |

**Index:** `(cardId)`

### `space_card_comments`
Komentar kartu.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `cardId` | INT | FK ke `space_cards` (Cascade) |
| `content` | TEXT | Isi komentar |
| `authorId` | INT | ID penulis |
| `authorType` | VARCHAR(20) | Type penulis |
| `authorName` | VARCHAR(255) | Nama penulis |
| `createdAt` / `updatedAt` | DATETIME | Timestamp |

**Index:** `(cardId)`

### `space_announcements`
Pengumuman / pinned notes.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `spaceId` | INT | FK ke `spaces` (Cascade) |
| `content` | TEXT | Isi pengumuman |
| `isPinned` | BOOLEAN | Status pin |
| `createdById` | INT | ID pembuat |
| `createdByName` | VARCHAR(255) | Nama pembuat |
| `createdAt` / `updatedAt` | DATETIME | Timestamp |

**Index:** `(spaceId)`

### `space_documents`
Dokumen kolaboratif (editor Tiptap).

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `spaceId` | INT | FK ke `spaces` (Cascade) |
| `title` | VARCHAR(255) | Judul |
| `content` | TEXT | Konten ProseMirror JSON |
| `emoji` | VARCHAR(10)? | Emoji ikon |
| `createdById` | INT | ID pembuat |
| `createdByName` | VARCHAR(255) | Nama pembuat |
| `createdAt` / `updatedAt` | DATETIME | Timestamp |

**Index:** `(spaceId)`

## Enum

| Enum | Nilai |
|------|-------|
| `CardPriority` | `NONE`, `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `AttachmentType` | `FILE`, `LINK` |

## Diagram Relasi Space

```
spaces ─┬─► space_columns ──► space_cards
        │                        │  ├─► space_card_checklists
        │                        │  ├─► space_card_attachments
        │                        │  └─► space_card_comments
        ├─► space_announcements
        └─► space_documents
```

Semua relasi child menggunakan `onDelete: Cascade` — menghapus Space akan menghapus seluruh kolom, kartu, checklist, attachment, komentar, pengumuman, dan dokumen di dalamnya.