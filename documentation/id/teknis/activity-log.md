# Activity Log (Audit Trail)

Modul Activity Log mencatat semua operasi CUD (Create/Update/Delete) di 10 service secara **fire-and-forget** — kegagalan pencatatan tidak pernah memblokir operasi utama.

## Database Schema

Model `ActivityLog` di Prisma (`@@map("activity_logs")`):

| Field | Type | Keterangan |
|-------|------|------------|
| `id` | `Int` | Primary key, auto-increment |
| `action` | `String` | `CREATE` / `UPDATE` / `DELETE` |
| `module` | `String` | Nama modul (contoh: `Karyawan`, `Kontrak`) |
| `targetLabel` | `String` | Identitas data (contoh: `Ahmad Subarjo (KRY-001)`) |
| `performedBy` | `String` | Nama user yang melakukan aksi |
| `performedByRole` | `String` | Role user (`ADMIN` / `PENGELOLA_KOPERASI`) |
| `detail` | `String?` | Konteks tambahan, opsional |
| `timestamp` | `DateTime` | Waktu kejadian, default `now()` |

**Index**: `module`, `timestamp`, `performedBy`

## ActivityLogModule

Dideklarasikan sebagai `@Global()` di `backend/src/activity-log/activity-log.module.ts` — tidak perlu di-import manual di tiap module lain. Cukup inject `ActivityLogService` langsung di constructor.

### ActivityLogService

| Method | Keterangan |
|--------|------------|
| `log(dto)` | Fire-and-forget. Error ditangkap secara silent — tidak merusak operasi utama |
| `findAll(query)` | Filter + pagination. Max 200 record per halaman |
| `purge(beforeDate)` | Hard delete semua log sebelum tanggal tertentu |
| `getModules()` | Daftar modul yang pernah tercatat (distinct, sorted A-Z) |

### ActivityLogController

Semua endpoint hanya dapat diakses oleh **ADMIN** (role check manual via `ForbiddenException`):

| Method | Path | Keterangan |
|--------|------|------------|
| `GET` | `/activity-logs` | List log dengan filter + pagination |
| `GET` | `/activity-logs/modules` | Daftar modul distinct |
| `DELETE` | `/activity-logs/purge?before=` | Hapus log sebelum tanggal tertentu |

**Query params** untuk `GET /activity-logs`:

| Param | Type | Keterangan |
|-------|------|------------|
| `module` | string | Filter per modul (exact match) |
| `action` | string | `CREATE` / `UPDATE` / `DELETE` |
| `performedBy` | string | Substring match, case-insensitive |
| `from` | ISO date | Timestamp ≥ tanggal ini |
| `to` | ISO date | Timestamp ≤ tanggal ini (diset ke 23:59:59.999) |
| `page` | number | Halaman (default: 1) |
| `limit` | number | Jumlah per halaman (default: 50, max: 200) |

## Hook Pattern di Service

```typescript
// 1. Inject di constructor
constructor(
  private prisma: PrismaService,
  private activityLog: ActivityLogService, // tambah ini
) {}

// 2. Di controller — ambil actor dari req.user
@Post()
create(@Body() dto: CreateDto, @Request() req: any) {
  const actor = {
    name: req.user?.fullName ?? req.user?.name ?? 'System',
    role: req.user?.role ?? 'UNKNOWN',
  }
  return this.service.create(dto, actor)
}

// 3. Di service — panggil setelah operasi prisma berhasil
async create(dto: CreateDto, actor: { name: string; role: string }) {
  const result = await this.prisma.someModel.create({ data: dto })

  void this.activityLog.log({  // void = fire-and-forget
    action: 'CREATE',
    module: 'Nama Modul',
    targetLabel: `${result.name} (${result.code})`,
    performedBy: actor.name,
    performedByRole: actor.role,
    detail: `Konteks: ${result.someField}`,  // opsional
  })

  return result
}
```

**Penting**: Gunakan `void` (bukan `await`) agar kegagalan log tidak merusak response ke client.

## Menambah Hook ke Service Baru

1. Inject `ActivityLogService` di constructor service target
2. Tambah parameter `actor: { name: string; role: string }` ke method create/update/delete
3. Di controller, ambil user dari `@Request() req` dan bentuk object actor:
   ```typescript
   { name: req.user?.fullName ?? req.user?.name ?? 'System', role: req.user?.role ?? 'UNKNOWN' }
   ```
4. Panggil `void this.activityLog.log(...)` setelah setiap operasi prisma berhasil
5. Isi `detail` dengan konteks yang relevan (lihat tabel di bawah untuk referensi)

## Service yang Di-hook (10 service)

| Service | Module Label | Detail CREATE | Detail UPDATE | Detail DELETE |
|---------|-------------|--------------|--------------|--------------|
| `employees` | Karyawan | Tgl bergabung + status | `"Edit data karyawan"` | Status terakhir |
| `contracts` | Kontrak | Periode + status | Periode + status | Status terakhir |
| `warning-letters` | Surat Peringatan | Level SP + pelanggaran | Level SP + pelanggaran | Level SP |
| `employee-documents` | Sertifikasi & Ijin | No. dokumen + tgl berlaku | Status + tgl berlaku | No. dokumen |
| `vendor-contracts` | Kontrak Vendor | Kategori + jenis + perlu perpanjangan | Jenis + kategori + status/`Tidak perlu perpanjangan` | Jenis + kategori |
| `legal-koperasi` | Legal Koperasi | Kategori + penerbit + perlu perpanjangan | Kategori + status/`Tidak perlu perpanjangan` | Kategori |
| `akte-dokumen` | Akte Dokumen | Notaris + tanggal | Notaris | Tanggal |
| `lookups` (8 entity) | Master Data | `Nilai: <name>` | `Nilai baru: <name>` | `Nilai dihapus: <name>` |
| `contract-templates` | Template Kontrak | Tipe kontrak | Tipe kontrak | Nama template |
| `users` | User | Role + username | Role | Role + username |

### Catatan Vendor & Legal Koperasi

Dokumen yang **tidak memerlukan perpanjangan** (`needsRenewal = false`) tidak akan menampilkan label `TIDAK_AKTIF` yang menyesatkan — melainkan `"Tidak perlu perpanjangan"` sebagai detail. Ini berlaku untuk field Detail di UPDATE dan DELETE.

## Nitro Server Routes

```
server/api/activity-logs/
  index.get.ts     # GET  /api/activity-logs
  modules.get.ts   # GET  /api/activity-logs/modules
  purge.delete.ts  # DELETE /api/activity-logs/purge
```

Semua route memforward `Authorization` cookie ke backend dan meneruskan query params.

## Frontend

Halaman: `app/pages/settings/activity-log.vue`

- Filter: Modul (USelect), Aksi (USelect), User (UInput), Date From/To
- Pagination server-side (limit 50 default, opsi 25/50/100/200)
- Export Excel via `useExport().exportActivityLogsExcel()` — fetch ulang dengan `limit=10000` sesuai filter aktif
- Pengaturan retensi tersimpan di `AppSetting` key `activityLogRetentionDays`
- Nav entry di sidebar Pengaturan, hanya tampil untuk `auth.canManageMasterData` (ADMIN)
