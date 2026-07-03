# Auto-Calculate Berlaku Sampai (6 Bulan) Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ubah form Surat Peringatan agar "Berlaku Sampai" dihitung otomatis (Tanggal Surat + 6 bulan), bukan input manual.

**Architecture:** Hapus input manual "Berlaku Sampai", tambahkan `watch` pada `state.letterDate` yang menghitung tanggal +6 bulan dan mengisi `state.validUntil` otomatis. Tampilkan sebagai read-only text.

**Tech Stack:** Vue 3 Composition API, Nuxt UI v4

---

## Current State

File: `app/components/warning-letters/AddModal.vue`

- `state.letterDate` dan `state.validUntil` keduanya input manual (line 200-207)
- `state.validUntil` diinisialisasi sebagai string kosong (line 58)
- Tidak ada watcher untuk auto-calculate

## Changes Needed

### Task 1: Tambah watcher untuk auto-calculate validUntil

**Objective:** Saat `state.letterDate` berubah, otomatis hitung `state.validUntil` = letterDate + 6 bulan.

**Files:**
- Modify: `app/components/warning-letters/AddModal.vue` (script section, setelah line 78)

**Step 1: Tambah watcher**

Tambahkan setelah blok `watch(() => props.open, ...)` (sekitar line 78):

```typescript
// Auto-calculate Berlaku Sampai = Tanggal Surat + 6 bulan
watch(() => state.letterDate, (date) => {
  if (date) {
    const d = new Date(date)
    d.setMonth(d.getMonth() + 6)
    state.validUntil = d.toISOString().split('T')[0]
  } else {
    state.validUntil = ''
  }
})
```

### Task 2: Ubah UI — hapus input manual "Berlaku Sampai"

**Objective:** Ganti input date "Berlaku Sampai" menjadi read-only display.

**Files:**
- Modify: `app/components/warning-letters/AddModal.vue` (template section, line 200-207)

**Step 1: Ganti grid 2 kolom menjadi 1 kolom + display read-only**

Ganti:

```html
<div class="grid grid-cols-2 gap-3">
  <UFormField label="Tanggal Surat" name="letterDate" required>
    <UInput v-model="state.letterDate" type="date" class="w-full" />
  </UFormField>
  <UFormField label="Berlaku Sampai" name="validUntil" required>
    <UInput v-model="state.validUntil" type="date" class="w-full" />
  </UFormField>
</div>
```

Dengan:

```html
<div class="grid grid-cols-2 gap-3">
  <UFormField label="Tanggal Surat" name="letterDate" required>
    <UInput v-model="state.letterDate" type="date" class="w-full" />
  </UFormField>
  <UFormField label="Berlaku Sampai (6 Bulan)" name="validUntil">
    <UInput
      :model-value="state.validUntil"
      type="date"
      readonly
      class="w-full opacity-60"
    />
  </UFormField>
</div>
```

### Task 3: Update resetForm

**Objective:** Pastikan `resetForm` tidak perlu reset `validUntil` manual karena watcher handle it.

**Files:**
- Modify: `app/components/warning-letters/AddModal.vue` (resetForm function)

**Step 1: Tidak perlu perubahan** — `resetForm` sudah set `state.letterDate = ''` yang akan trigger watcher → `state.validUntil = ''`.

### Task 4: Verifikasi

**Step 1: Run typecheck**

Run: `cd E:/Github/aplikasi-karyawan-kokarsi && npx nuxi typecheck`
Expected: 0 errors

**Step 2: Test manual via browser**

1. Buka `http://localhost:3000/dokumen/surat-peringatan`
2. Klik "Tambah Surat"
3. Pilih tanggal surat (misal: 2025-08-18)
4. Verify: "Berlaku Sampai" otomatis terisi 2026-02-18
5. Verify: Field "Berlaku Sampai" read-only (tidak bisa diubah manual)
6. Submit form — verify data tersimpan dengan validUntil yang benar

---

## Risks & Tradeoffs

1. **Edge case: tahun kabisat** — `Date.setMonth()` di JavaScript handle secara benar (misal Jan 31 + 6 bulan = Jul 31). Tidak perlu special case.
2. **Zod validation** — `validUntil` masih divalidasi oleh schema (`z.string().min(1)`), tapi karena auto-filled, validation akan pass selama `letterDate` terisi.
3. **Read-only UI** — User tidak bisa override tanggal berlaku. Jika dibutuhkan flexibility di masa depan, ubah `readonly` ke `disabled` atau hapus attribute.
