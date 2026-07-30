# Email Notification Config — Implementation Plan

**Date:** 2026-07-30  
**Feature:** Tab "Email Config" di Halaman Pengaturan > Umum

---

## Spec Summary

Admin dapat mengkonfigurasi notifikasi email dari tab baru "Email Config" di halaman `/settings`:

1. **Toggle global** — aktifkan/nonaktifkan seluruh fitur email notifikasi
2. **Trigger windows** — tambah/hapus bebas daftar hari pengiriman (angka positif), berlaku global untuk kontrak + sertifikasi
3. **Daftar penerima** — pilih user satu per satu dari `UserAccount`, default kosong
4. **Deduplikasi** — tiap kombinasi `(sourceType, sourceId, triggerDay)` hanya dikirim sekali (sudah ada `@@unique` di `Notification` model, email tracking perlu ditambah)
5. **Audit log** — setiap perubahan config dicatat
6. **Konfirmasi dialog** — sebelum menyimpan perubahan

Cron yang sudah ada di `contract-cron.service.ts` akan membaca config ini alih-alih hardcode `[90, 60, 30, 7, 0]`.

---

## Stack & Pola yang Sudah Ada

| Layer | Teknologi |
|-------|-----------|
| Backend | NestJS + Prisma + PostgreSQL |
| Config store | `AppSetting` table (key/value) |
| Email | Maileroo via `MailerooService.sendEmail()` |
| Cron | `@Cron` di `ContractCronService` |
| Frontend | Nuxt 3 + Vue 3 + Nuxt UI (UCard, UForm, UBadge, UIcon) |
| API proxy | `server/api/settings/general.get.ts` → backend |
| Auth guard | JWT, role check via `ensureAdmin()` di service |

---

## File Structure

### Baru dibuat

| File | Tanggung Jawab |
|------|----------------|
| `backend/prisma/migrations/YYYYMMDD_add_email_notification_config/migration.sql` | Buat tabel `email_notification_recipients` dan `email_notification_sent_log` dan `email_notification_config_log` |
| `backend/src/email-notification-config/email-notification-config.service.ts` | CRUD config: toggle, windows, recipients, audit log |
| `backend/src/email-notification-config/email-notification-config.controller.ts` | REST endpoints: GET/PUT config, GET users list |
| `backend/src/email-notification-config/email-notification-config.module.ts` | NestJS module |
| `backend/src/email-notification-config/dto/update-email-config.dto.ts` | DTO untuk PUT |
| `server/api/settings/email-config.get.ts` | Nuxt proxy → GET backend |
| `server/api/settings/email-config.put.ts` | Nuxt proxy → PUT backend |
| `app/components/settings/EmailConfigTab.vue` | Seluruh UI tab Email Config |

### Dimodifikasi

| File | Perubahan |
|------|-----------|
| `backend/prisma/schema.prisma` | Tambah model `EmailNotificationRecipient`, `EmailNotificationSentLog`, `EmailNotificationConfigLog` |
| `backend/src/settings/settings.module.ts` | Import `EmailNotificationConfigModule` jika perlu share service |
| `backend/src/contract-cron/contract-cron.service.ts` | Inject `EmailNotificationConfigService`, baca `triggerWindows` + `isEnabled` dari DB, cek `sentLog` sebelum kirim |
| `backend/src/contract-cron/contract-cron.module.ts` | Import `EmailNotificationConfigModule` |
| `backend/src/maileroo/maileroo.service.ts` | Terima explicit `recipients` param alih-alih selalu fetch semua `UserAccount` |
| `app/pages/settings/index.vue` | Tambah tab `email-config` ke `SettingsTab` type dan `tabs` array, render `<EmailConfigTab />` |
| `app/types/index.ts` (atau file types) | Tambah type `EmailNotificationConfig` |

---

## Prisma Schema Additions

```prisma
model EmailNotificationRecipient {
  id            Int         @id @default(autoincrement())
  userAccountId Int
  userAccount   UserAccount @relation(fields: [userAccountId], references: [id], onDelete: Cascade)
  createdAt     DateTime    @default(now())

  @@unique([userAccountId])
  @@map("email_notification_recipients")
}

model EmailNotificationSentLog {
  id         Int      @id @default(autoincrement())
  sourceType String   @db.VarChar(50)   // "contract" | "employee_document"
  sourceId   Int
  triggerDay Int
  sentAt     DateTime @default(now())

  @@unique([sourceType, sourceId, triggerDay])
  @@map("email_notification_sent_log")
}

model EmailNotificationConfigLog {
  id          Int      @id @default(autoincrement())
  changedBy   String   @db.VarChar(255) // username dari JWT
  description String   @db.Text         // e.g. "Menambah trigger window 45 hari"
  createdAt   DateTime @default(now())

  @@map("email_notification_config_log")
}
```

Tambah relasi di `UserAccount`:
```prisma
emailNotificationRecipient EmailNotificationRecipient?
```

Config `isEnabled` dan `triggerWindows` disimpan di `AppSetting` table (pola yang sudah ada):
- key `emailNotificationEnabled` → `"true"` | `"false"`
- key `emailNotificationWindows` → `"90,60,30,7,0"` (CSV)

---

## Task Breakdown

---

### Task 1 — Prisma: Tambah Models + Migrate

**Files:**
- `backend/prisma/schema.prisma` — tambah 3 model + relasi di `UserAccount`
- `backend/prisma/migrations/` — generate migration

**Steps:**
1. Edit `schema.prisma`: tambah `EmailNotificationRecipient`, `EmailNotificationSentLog`, `EmailNotificationConfigLog`, dan field relasi di `UserAccount`
2. Jalankan: `npx prisma migrate dev --name add_email_notification_config` dari direktori `backend/`
3. Verifikasi tabel terbuat di database

**Verify:**
```bash
cd backend && npx prisma migrate status
```
Harus menampilkan migration applied.

**Commit:** `feat(db): add email notification config tables`

---

### Task 2 — Backend: EmailNotificationConfigService

**Files:**
- `backend/src/email-notification-config/email-notification-config.service.ts` (baru)
- `backend/src/email-notification-config/dto/update-email-config.dto.ts` (baru)
- `backend/src/email-notification-config/email-notification-config.module.ts` (baru)

**Service methods:**

```typescript
// Kembalikan seluruh config dalam satu response
async getConfig(): Promise<EmailNotificationConfigDto>

// Update config + tulis audit log
async updateConfig(dto: UpdateEmailConfigDto, username: string): Promise<EmailNotificationConfigDto>

// Kembalikan semua UserAccount untuk dropdown penerima
async getAllUsers(): Promise<{ id: number; name: string; email: string }[]>

// Cek apakah sudah dikirim untuk kombinasi ini (dipakai cron)
async hasSent(sourceType: string, sourceId: number, triggerDay: number): Promise<boolean>

// Catat pengiriman (dipakai cron setelah kirim)
async recordSent(sourceType: string, sourceId: number, triggerDay: number): Promise<void>

// Kembalikan recipients yang aktif (dipakai cron)
async getActiveRecipients(): Promise<{ email: string; name: string }[]>

// Kembalikan trigger windows aktif (dipakai cron)
async getTriggerWindows(): Promise<number[]>

// Cek apakah fitur enabled (dipakai cron)
async isEnabled(): Promise<boolean>
```

**getConfig() logic:**
- Baca `AppSetting` key `emailNotificationEnabled` (default `"true"`)
- Baca `AppSetting` key `emailNotificationWindows` (default `"90,60,30,7,0"`)
- Baca semua `EmailNotificationRecipient` join `UserAccount`
- Return: `{ isEnabled, triggerWindows: number[], recipients: {id, name, email}[] }`

**updateConfig() logic:**
- `ensureAdmin(role)` — tolak jika bukan ADMIN
- Diff lama vs baru untuk audit log description
- Upsert `AppSetting` untuk `isEnabled` dan `windows`
- Delete semua recipient lama, insert yang baru
- Insert ke `EmailNotificationConfigLog`
- Return `getConfig()`

**DTO (`update-email-config.dto.ts`):**
```typescript
export class UpdateEmailConfigDto {
  isEnabled: boolean
  triggerWindows: number[]       // min 1 elemen, tiap nilai > 0
  recipientUserIds: number[]     // bisa kosong
}
```

**Module:**
```typescript
@Module({
  imports: [PrismaModule],
  providers: [EmailNotificationConfigService],
  exports: [EmailNotificationConfigService],
})
export class EmailNotificationConfigModule {}
```

**Verify:**
- Compile: `cd backend && npx tsc --noEmit`

**Commit:** `feat(backend): EmailNotificationConfigService`

---

### Task 3 — Backend: EmailNotificationConfigController + API Proxy

**Files:**
- `backend/src/email-notification-config/email-notification-config.controller.ts` (baru)
- `server/api/settings/email-config.get.ts` (baru)
- `server/api/settings/email-config.put.ts` (baru)

**Controller endpoints:**
```
GET  /email-notification-config       → getConfig()  (JWT guarded, ADMIN only)
PUT  /email-notification-config       → updateConfig() (JWT guarded, ADMIN only)
GET  /email-notification-config/users → getAllUsers()  (JWT guarded, ADMIN only)
```

Ikuti pola dari `settings.controller.ts`: ekstrak `user.role` dan `user.username` dari JWT payload via `@Req()`.

**Nuxt proxy `email-config.get.ts`:**
```typescript
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getCookie(event, 'auth_token')
  const res = await fetch(`${config.backendUrl}/email-notification-config`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw createError({ statusCode: res.status })
  return res.json()
})
```

**Nuxt proxy `email-config.put.ts`:**
```typescript
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getCookie(event, 'auth_token')
  const body = await readBody(event)
  const res = await fetch(`${config.backendUrl}/email-notification-config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw createError({ statusCode: res.status, message: err?.message })
  }
  return res.json()
})
```

**Daftarkan module di `app.module.ts`:**
```typescript
import { EmailNotificationConfigModule } from './email-notification-config/email-notification-config.module'
// tambahkan ke imports array
```

**Verify:**
```bash
cd backend && npx tsc --noEmit
# lalu test manual dengan curl:
curl -H "Authorization: Bearer <token>" http://localhost:3001/email-notification-config
```

**Commit:** `feat(backend): email notification config controller + nuxt proxy`

---

### Task 4 — Frontend: EmailConfigTab Component

**Files:**
- `app/components/settings/EmailConfigTab.vue` (baru)

**UI sections (dalam satu UCard atau beberapa UCard stacked):**

1. **Toggle global**
   - `UToggle` dengan label "Aktifkan Notifikasi Email"
   - Jika disabled, sections lain dimunculkan tapi disabled/dimmed

2. **Trigger Windows**
   - Judul: "Hari Pengiriman"
   - Daftar chip/badge tiap window dengan tombol hapus (X)
   - Input angka + tombol "Tambah" untuk menambah window baru
   - Validasi: hanya angka positif, tidak boleh duplikat

3. **Penerima Email**
   - Judul: "Penerima Notifikasi"
   - Multi-select atau checklist dari daftar `UserAccount` (nama + email)
   - Fetch dari `/api/settings/email-config-users` (atau endpoint yang sama)

4. **Tombol Simpan**
   - Saat diklik: tampilkan `UModal` konfirmasi dialog
   - Dialog: "Perubahan akan segera berlaku pada cron berikutnya. Lanjutkan?"
   - Setelah konfirmasi: POST ke `/api/settings/email-config`

**Script setup structure:**
```typescript
const { data: config, refresh } = await useFetch('/api/settings/email-config')
const { data: allUsers } = await useFetch('/api/settings/email-config-users')

const form = reactive({
  isEnabled: false,
  triggerWindows: [] as number[],
  recipientUserIds: [] as number[],
})

// watchEffect untuk sync config → form (pola dari index.vue)
watchEffect(() => {
  form.isEnabled = config.value?.isEnabled ?? true
  form.triggerWindows = [...(config.value?.triggerWindows ?? [90, 60, 30, 7, 0])]
  form.recipientUserIds = config.value?.recipients?.map(r => r.id) ?? []
})

const showConfirm = ref(false)
const saving = ref(false)

function openConfirm() { showConfirm.value = true }
async function confirmSave() {
  saving.value = true
  try {
    await $fetch('/api/settings/email-config', { method: 'PUT', body: form })
    toast.add({ title: 'Konfigurasi email berhasil disimpan', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Gagal menyimpan', description: e?.data?.message, color: 'error' })
  } finally {
    saving.value = false
    showConfirm.value = false
  }
}
```

**Verify:**
- Render di browser, cek semua section muncul
- Tambah window, hapus window, checklist penerima
- Klik simpan → konfirmasi dialog muncul → save berhasil

**Commit:** `feat(frontend): EmailConfigTab component`

---

### Task 5 — Frontend: Daftarkan Tab di settings/index.vue

**Files:**
- `app/pages/settings/index.vue`

**Perubahan:**

1. Tambah `'email-config'` ke type:
```typescript
type SettingsTab = 'general' | 'profile' | 'login-appearance' | 'email-config'
```

2. Tambah tab ke `tabs` computed (hanya untuk ADMIN, ikuti pola `login-appearance`):
```typescript
...(auth.canManageMasterData
  ? [{ key: 'email-config' as SettingsTab, label: 'Email Config', icon: 'i-lucide-mail' }]
  : []),
```

3. Tambah section di template:
```html
<!-- Tab: Email Config -->
<div v-if="activeTab === 'email-config'">
  <EmailConfigTab />
</div>
```

4. Import component (auto-import Nuxt, tidak perlu import manual jika di `components/settings/`)

**Verify:**
- Tab "Email Config" muncul di sidebar tab
- Klik tab → EmailConfigTab render
- Tab hanya muncul untuk user dengan `canManageMasterData`

**Commit:** `feat(frontend): daftarkan tab Email Config di settings page`

---

### Task 6 — Backend: Update Cron untuk Baca Config

**Files:**
- `backend/src/contract-cron/contract-cron.service.ts`
- `backend/src/contract-cron/contract-cron.module.ts`
- `backend/src/maileroo/maileroo.service.ts`

**Perubahan di `MailerooService`:**

Semua 4 method `send*Notification` saat ini fetch semua `UserAccount`. Ubah signature untuk terima explicit recipients:

```typescript
// Sebelum (otomatis fetch semua user):
async sendContractStatusNotification(changes: ContractStatusChange[]): Promise<boolean>

// Sesudah (terima recipients dari caller):
async sendContractStatusNotification(
  changes: ContractStatusChange[],
  recipients: { email: string; name: string }[]
): Promise<boolean>
```

Lakukan hal yang sama untuk `sendDocumentStatusNotification`, `sendVendorContractNotification`, `sendLegalKoperasiNotification`.

Di dalam masing-masing method: hapus block `findMany UserAccount`, gunakan `recipients` param langsung. Tambahkan early return jika `recipients.length === 0`.

**Perubahan di `ContractCronService`:**

Inject `EmailNotificationConfigService`:
```typescript
constructor(
  private prisma: PrismaService,
  private maileroo: MailerooService,
  private vendorContractsService: VendorContractsService,
  private legalKoperasiService: LegalKoperasiService,
  private notificationsService: NotificationsService,
  private emailConfig: EmailNotificationConfigService,  // ← baru
) {}
```

Di awal `syncContractStatuses()`:
```typescript
const emailEnabled = await this.emailConfig.isEnabled()
const triggerWindows = await this.emailConfig.getTriggerWindows()
const recipients = emailEnabled ? await this.emailConfig.getActiveRecipients() : []
```

Ganti hardcoded window check. Saat ini cron menentukan `AKAN_HABIS` pada `daysLeft <= 30`. Logika pengiriman email (bukan status sync) harus berdasarkan `triggerWindows`:

```typescript
// Untuk tiap kontrak yang statusnya berubah ke AKAN_HABIS atau sudah AKAN_HABIS:
if (emailEnabled && recipients.length > 0) {
  for (const window of triggerWindows) {
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
    if (daysLeft === window) {
      const alreadySent = await this.emailConfig.hasSent('contract', contract.id, window)
      if (!alreadySent) {
        changesForWindow.push(contract)
      }
    }
  }
}
```

Setelah `sendContractStatusNotification` berhasil:
```typescript
await this.emailConfig.recordSent('contract', contract.id, window)
```

Lakukan hal serupa untuk employee documents (sourceType: `'employee_document'`).

**Perubahan di `ContractCronModule`:**
```typescript
imports: [PrismaModule, MailerooModule, VendorContractsModule, LegalKoperasiModule, NotificationsModule, EmailNotificationConfigModule],
```

**Verify:**
```bash
cd backend && npx tsc --noEmit
```
Harus 0 errors.

**Commit:** `feat(backend): cron baca trigger windows + recipients dari DB, deduplikasi via sentLog`

---

### Task 7 — Tambah Endpoint untuk User List (Penerima)

**Files:**
- `backend/src/email-notification-config/email-notification-config.controller.ts` — tambah `GET /email-notification-config/users`
- `server/api/settings/email-config-users.get.ts` (baru)

**Controller tambahan:**
```typescript
@Get('users')
@UseGuards(JwtAuthGuard)
async getUsers(@Req() req) {
  return this.service.getAllUsers()
}
```

**Nuxt proxy `email-config-users.get.ts`:**
```typescript
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getCookie(event, 'auth_token')
  const res = await fetch(`${config.backendUrl}/email-notification-config/users`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw createError({ statusCode: res.status })
  return res.json()
})
```

**Verify:**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/email-notification-config/users
# → array [{ id, name, email }]
```

**Commit:** `feat(backend): endpoint list users untuk penerima email config`

---

### Task 8 — Types Frontend

**Files:**
- `app/types/index.ts` (atau file types yang ada — cek dengan codegraph)

Tambahkan:
```typescript
export interface EmailNotificationConfig {
  isEnabled: boolean
  triggerWindows: number[]
  recipients: { id: number; name: string; email: string }[]
}

export interface EmailNotificationUser {
  id: number
  name: string
  email: string
}
```

**Commit:** `feat(types): EmailNotificationConfig types`

---

## Urutan Eksekusi

```
Task 8 (types)
  → Task 1 (migrate)
    → Task 2 (service)
      → Task 3 (controller + proxy)
        → Task 7 (users endpoint)
          → Task 4 (frontend component)
            → Task 5 (daftarkan tab)
              → Task 6 (update cron)
```

Tasks 7 dan 8 bisa paralel dengan Task 3.

---

## Consistency Check

- `EmailNotificationConfigService.getActiveRecipients()` → dipakai di Task 6 (cron)
- `EmailNotificationConfigService.hasSent()` → dipakai di Task 6
- `EmailNotificationConfigService.recordSent()` → dipakai di Task 6
- `EmailNotificationConfigService.isEnabled()` → dipakai di Task 6
- `EmailNotificationConfigService.getTriggerWindows()` → dipakai di Task 6
- `MailerooService.sendContractStatusNotification(changes, recipients)` → signature baru dipakai di Task 6
- `MailerooService.sendDocumentStatusNotification(changes, recipients)` → signature baru dipakai di Task 6
- `EmailNotificationConfig` type → dipakai di Task 4 (frontend)
- `/api/settings/email-config` GET/PUT → dipakai di Task 4
- `/api/settings/email-config-users` GET → dipakai di Task 4

Tidak ada inkonsistensi nama yang ditemukan.

---

## Edge Cases yang Harus Dihandle

| Kasus | Handling |
|-------|----------|
| `recipients` kosong | Cron skip kirim email, log warning |
| `triggerWindows` kosong | Cron skip semua email, log warning |
| `isEnabled = false` | Cron skip semua email |
| `triggerWindows` duplikat (misal [30, 30]) | Deduplikasi di service saat simpan |
| User dihapus dari `UserAccount` tapi masih di recipients | `onDelete: Cascade` di Prisma handle ini |
| Cron jalan 2x dalam satu hari | `sentLog` @@unique mencegah duplikat kirim |
