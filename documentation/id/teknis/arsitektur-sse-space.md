# Arsitektur SSE Space

Modul Space memanfaatkan **Server-Sent Events (SSE)** untuk mengirim pembaruan **real-time** kepada seluruh member Space. Setiap perubahan (kartu, kolom, komentar, checklist, attachment, member, pengumuman) di-broadcast ke semua client yang sedang membuka Space yang sama.

## Alur Data

```
Client A  ──EventSource──►  /api/spaces/:spaceId/stream (SSE GET)
Client B  ──EventSource──►  /api/spaces/:spaceId/stream
                               │
Kartu diubah (Client A)        ▼
  │                        SpaceCardsService/ColumnsService/...
  │ (melakukan mutasi DB +    │
  │  panggil broadcast)       ▼
  └──────────────────►  SpaceSseService.broadcastToSpace(spaceId, event)
                              │
                              ├─ Event A  ◀── Client A menerima
                              ├─ Event B  ◀── Client B menerima
                              └─ (tanpa refresh)
```

## Komponen Kunci

### Backend — `backend/src/spaces/space-sse.service.ts`

`SpaceSseService` mengelola satu **"room" (ruang)** per Space berisi daftar `Subject` (satu per koneksi client):

| Method | Deskripsi |
|--------|-----------|
| `subscribeToSpace(spaceId)` | Menambahkan `Subject` client ke room Space; mengembalikan `Observable` yang dipakai oleh kontroller SSE. Saat koneksi ditutup (`finalize`), `Subject` dibuang; room dihapus jika kosong. |
| `broadcastToSpace(spaceId, event)` | Mengirim `event` (serialisasi JSON) ke **semua** `Subject` yang terdaftar pada Space. Jika tidak ada client, tidak melakukan apa-apa. |
| `getRoomSize(spaceId)` | Jumlah client yang sedang terhubung ke satu Space (untuk debugging/opsional). |

Struktur internal:

```
rooms: Map<spaceId, Set<Subject<MessageEvent>>>
   │
   ├─ spaceId=1 ─► [ SubjectA, SubjectB ]
   ├─ spaceId=2 ─► [ SubjectC ]
   └─ spaceId=3 ─► [ ] (dihapus saat kosong)
```

### Endpoint SSE

Backend mengekspos SSE di:

```
GET /api/spaces/:spaceId/stream   (Backend @Sse('stream'), guard AuthGuard('jwt-cookie'))
```

Nitro proxy mengekspos frontend di:

```
GET /api/spaces/:id/stream   (server/api/spaces/[id]/stream.get.ts)
```

Karena SSE harus membaca cookie (bukan header `Authorization`), endpoint SSE memakai guard khusus **`jwt-cookie`** (berbeda dengan guard `jwt` biasa yang membaca header).

### Frontend — `app/composables/useSpaceSSE.ts` (atau integrasi di halaman Space)

Browser membuka koneksi `EventSource` ke `/api/spaces/:id/stream`. Saat event diterima:

```ts
const source = new EventSource(`/api/spaces/${spaceId}/stream`)
source.onmessage = (e) => {
  const event: SpaceEvent = JSON.parse(e.data)
  // update state board/kanban via event.type
}
```

## Format Event

Setiap pesan berbentuk `SpaceEvent`:

```ts
interface SpaceEvent {
  type: SpaceEventType
  payload: any      // data terkait (kartu, kolom, komentar, dll)
  actorId: number   // ID user penyebab perubahan
  actorName: string // nama user penyebab perubahan
}
```

### Jenis Event

| Kategori | Event |
|----------|-------|
| Card | `CARD_CREATED`, `CARD_UPDATED`, `CARD_DELETED`, `CARD_MOVED` |
| Column | `COLUMN_CREATED`, `COLUMN_UPDATED`, `COLUMN_DELETED`, `COLUMNS_REORDERED` |
| Comment | `COMMENT_ADDED`, `COMMENT_UPDATED`, `COMMENT_DELETED` |
| Checklist | `CHECKLIST_TOGGLED` |
| Attachment | `ATTACHMENT_ADDED`, `ATTACHMENT_DELETED` |
| Member | `MEMBER_ADDED`, `MEMBER_REMOVED` |
| Announcement | `ANNOUNCEMENT_CREATED`, `ANNOUNCEMENT_UPDATED`, `ANNOUNCEMENT_DELETED` |

## Validasi Akses

Sebelum `broadcastToSpace` dipanggil, setiap service (cards, columns, announcements, docs) memanggil **`findOne` (access check)** dan `checkAccess` untuk memastikan hanya **member Space** yang dapat bermutasi. Koneksi SSE itu sendiri bersifat pasif — hanya menerima event dari Space yang dibuka.

## Catatan Implementasi

- **Beban rendah**: broadcast hanya mengirim ke room Space yang aktif (tidak ke semua pengguna aplikasi).
- **Garbage collection**: room dihapus otomatis saat tidak ada client (`room.size === 0 → rooms.delete`).
- **Tidak autentikasi ulang per event**: koneksi SSE sudah diverifikasi saat koneksi.

## Contoh Flow End-to-End

1. Client A membuka Space → `EventSource` terhubung ke `/api/spaces/5/stream`.
2. Client B menambah kartu via `POST /api/spaces/5/columns/3/cards`.
3. `SpaceCardsService.create()` validasi akses → buat DB → panggil `broadcastToSpace(5, { type: 'CARD_CREATED', ... })`.
4. `SpaceSseService` mengirim event JSON ke subject Client A (dan B).
5. Client A menerima event → KanbanBoard merender kartu baru **tanpa refresh**.