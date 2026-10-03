/**
 * Pipe binding katalog field → `fieldDefinitions` versi template.
 *
 * `ContractTemplateField` adalah tabel junction yang menyimpan field katalog
 * mana yang dipakai sebuah template, beserta flag `required` (checkbox "wajib
 * diisi" di editor template). Sebelum helper ini ada, tabel tersebut hanya
 * dibaca oleh `count()` (guard arsip di template-fields.service.ts) dan seed,
 * sehingga binding seperti `ktp_issued_date` (MITRA, `required: true`) tidak
 * pernah masuk ke `fieldDefinitions` versi. Akibatnya form kontrak tidak pernah
 * menampilkan kolom dinamis dan PDF merender nilai kosong.
 *
 * Cakupan sengaja dibatasi ke field `CONTRACT_INPUT` (field dinamis yang diisi
 * di form kontrak):
 *  - field `SYSTEM` sudah dibangkitkan `definitionToFieldDefinitions()` dan
 *    divalidasi saat publish, jadi tidak perlu ditimpa;
 *  - field `MASTER_REFERENCE` belum punya jalur resolve di
 *    `template-value-resolver.helpers.ts`, sehingga memaksa `required: true` di
 *    situ akan menggagalkan pembuatan kontrak.
 *
 * Helper ini murni (tanpa NestJS/Prisma) agar bisa di-unit-test.
 */
import { collectAllPlaceholders } from './template-schema.validator'

/** Baris katalog `TemplateFieldDefinition` yang relevan untuk binding. */
export interface CatalogFieldRow {
  key: string
  label?: string | null
  dataType?: string | null
  sourceType?: string | null
  sourceConfig?: unknown
  options?: unknown
}

/** Baris binding `ContractTemplateField` (termasuk relasi `field`). */
export interface TemplateFieldBindingRow {
  required?: boolean | null
  sortOrder?: number | null
  field: CatalogFieldRow
}

/** Satu entri `fieldDefinitions` versi template. */
export interface VersionFieldDefinition {
  key: string
  label?: string
  dataType?: string
  sourceType?: string
  required: boolean
  [extra: string]: unknown
}

/**
 * Normalisasi `fieldDefinitions` versi menjadi array. Bentuk yang diterima:
 * array langsung, `{ fields: [] }`, atau `undefined`/`null` (→ array kosong).
 * Key `custom.xxx` pada field `CONTRACT_INPUT` dirapikan menjadi `xxx` supaya
 * cocok dengan `template-value-resolver.helpers.ts` yang mengharapkan key tanpa
 * prefix (`key.slice('custom.'.length)`).
 */
export function normalizeVersionFieldDefinitions(value: unknown): VersionFieldDefinition[] {
  const rows = Array.isArray(value)
    ? value
    : value && Array.isArray((value as { fields?: unknown[] }).fields)
      ? (value as { fields: unknown[] }).fields
      : []

  const normalized: VersionFieldDefinition[] = []
  for (const raw of rows) {
    const definition = normalizeDefinition(raw)
    if (definition) normalized.push(definition)
  }
  return normalized
}

function normalizeDefinition(raw: unknown): VersionFieldDefinition | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  if (typeof source.key !== 'string' || source.key.length === 0) return null

  const sourceType = typeof source.sourceType === 'string'
    ? source.sourceType
    : source.key.startsWith('custom.') ? 'CONTRACT_INPUT' : 'SYSTEM'
  const key = sourceType === 'CONTRACT_INPUT' ? source.key.replace(/^custom\./, '') : source.key

  // Properti lain dipertahankan apa adanya agar snapshot versi tidak kehilangan
  // metadata yang ditambahkan editor.
  return { ...source, key, sourceType, required: source.required === true }
}

export interface ApplyTemplateBindingsOptions {
  /**
   * Key CONTRACT_INPUT yang terdaftar di katalog field (`TemplateFieldDefinition`).
   *
   * Bila diberikan, field CONTRACT_INPUT yang ADA DI KATALOG tetapi tidak
   * ter-bind ke template akan DIHAPUS dari hasil — inilah "uncheck Pakai" di
   * panel editor. Field di luar daftar ini dipertahankan, sehingga placeholder
   * `{{custom.x}}` yang ditulis langsung di teks (tanpa baris katalog) tidak
   * hilang. Bila tidak diberikan, perilaku lama dipertahankan (tidak menghapus).
   */
  catalogContractInputKeys?: Iterable<string>
}

/**
 * Timpa/selaraskan `fieldDefinitions` versi dengan binding katalog template.
 *
 * Aturan:
 *  - field `CONTRACT_INPUT` yang ter-bind tetapi belum ada di `fieldDefinitions`
 *    ditambahkan dari metadata katalog;
 *  - field `CONTRACT_INPUT` yang sudah ada diselaraskan dari katalog: `required`
 *    mengikuti binding (sumber kebenaran checkbox "wajib diisi"), sedangkan
 *    `label`/`dataType`/`sourceConfig`/`options` mengikuti katalog. Tanpa
 *    penyelarasan metadata, field yang sebelumnya dibuat seed/bootstrap dengan
 *    placeholder mentah tampil di form sebagai label `custom.xxx` bertipe TEXT —
 *    mis. "Tanggal Terbit KTP Mitra" kehilangan tipe DATE sehingga input tanggal
 *    berubah menjadi kotak teks bebas;
 *  - urutan field lama dipertahankan; field baru di-append mengikuti `sortOrder`;
 *  - binding selain `CONTRACT_INPUT` diabaikan (lihat catatan cakupan di atas);
 *  - bila `options.catalogContractInputKeys` diberikan, field katalog yang tidak
 *    ter-bind dihapus (perilaku "uncheck Pakai" di panel editor).
 */
export function applyTemplateBindings(
  fieldDefinitions: unknown,
  bindings: TemplateFieldBindingRow[],
  options: ApplyTemplateBindingsOptions = {},
): VersionFieldDefinition[] {
  const definitions = normalizeVersionFieldDefinitions(fieldDefinitions)
  const byKey = new Map<string, VersionFieldDefinition>()
  for (const definition of definitions) {
    if (!byKey.has(definition.key)) byKey.set(definition.key, definition)
  }

  const boundKeys = new Set(
    bindings
      .map(b => b?.field)
      .filter((f: any) => f && f.sourceType === 'CONTRACT_INPUT' && typeof f.key === 'string')
      .map((f: any) => String(f.key).replace(/^custom\./, '')),
  )

  // "Uncheck Pakai": buang field CONTRACT_INPUT yang terdaftar di katalog field
  // tetapi tidak punya baris binding di template ini.
  const removed = new Set<string>()
  if (options.catalogContractInputKeys) {
    const catalogKeys = new Set(
      [...options.catalogContractInputKeys].map(k => String(k).replace(/^custom\./, '')),
    )
    for (const [key, definition] of byKey) {
      if (definition.sourceType !== 'CONTRACT_INPUT') continue
      if (catalogKeys.has(key) && !boundKeys.has(key)) {
        byKey.delete(key)
        removed.add(key)
      }
    }
  }

  const ordered = [...bindings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  for (const binding of ordered) {
    const catalog = binding?.field
    if (!catalog || typeof catalog.key !== 'string' || catalog.key.length === 0) continue
    if (catalog.sourceType !== 'CONTRACT_INPUT') continue

    const key = catalog.key.replace(/^custom\./, '')
    const existing = byKey.get(key)
    if (existing) {
      existing.required = binding.required === true
      // Metadata katalog adalah sumber kebenaran untuk label/tipe: field yang
      // dibuat jalur lama memakai key mentah (`custom.ktp_issued_date`) akan
      // tampil apa adanya sebagai label dan kehilangan tipe DATE-nya di form.
      if (typeof catalog.label === 'string' && catalog.label.length > 0) existing.label = catalog.label
      if (typeof catalog.dataType === 'string' && catalog.dataType.length > 0) existing.dataType = catalog.dataType
      if (catalog.sourceConfig !== undefined && catalog.sourceConfig !== null) existing.sourceConfig = catalog.sourceConfig
      if (catalog.options !== undefined && catalog.options !== null) existing.options = catalog.options
      continue
    }

    const created: VersionFieldDefinition = {
      key,
      label: catalog.label ?? key,
      dataType: catalog.dataType ?? 'TEXT',
      sourceType: 'CONTRACT_INPUT',
      required: binding.required === true,
    }
    if (catalog.sourceConfig !== undefined && catalog.sourceConfig !== null) {
      created.sourceConfig = catalog.sourceConfig
    }
    if (catalog.options !== undefined && catalog.options !== null) {
      created.options = catalog.options
    }
    byKey.set(key, created)
    definitions.push(created)
  }

  // `definitions` masih memuat field yang baru dilepas; saring sebelum kembali
  // agar urutan & isinya konsisten dengan `byKey`.
  return removed.size === 0 ? definitions : definitions.filter(d => !removed.has(d.key))
}

/** Tebak tipe data dari nama key bila katalog tidak menyediakannya. */
function inferDataType(key: string): string {
  if (key.includes('Date') || key.endsWith('Date')) return 'DATE'
  if (key.includes('Compensation')) return 'NUMBER'
  return 'TEXT'
}

/**
 * Pastikan `fieldDefinitions` mencakup SETIAP placeholder SYSTEM yang dipakai
 * konten.
 *
 * MASALAH YANG DIPERBAIKI: `TemplateSnapshotService.buildSnapshot()` hanya
 * me-resolve key yang terdaftar di `fieldDefinitions` versi. Bila editor
 * menyisipkan placeholder SYSTEM (mis. `{{contract.contractNo}}`) ke teks TANPA
 * menambahkannya ke `fieldDefinitions`, key itu tidak pernah punya nilai →
 * tercetak sebagai `...............` di PDF, walaupun pratinjau (yang memakai
 * data contoh) terlihat lengkap. Validasi publish pun lolos karena key SYSTEM
 * ada di katalog global — jadi ketidak-sinkronan ini senyap.
 *
 * Hanya field SYSTEM yang ditambahkan: nilainya berasal dari data kontrak/
 * karyawan sehingga selalu dapat di-resolve. Field `CONTRACT_INPUT` (`custom.*`)
 * TIDAK ditambahkan otomatis — ia harus ter-bind eksplisit lewat panel "Kelola",
 * kalau tidak nilainya tidak punya sumber (dan publish memang harus menolak).
 */
export function ensureFieldDefinitionsForContent(
  content: unknown,
  fieldDefinitions: VersionFieldDefinition[],
  catalog: CatalogFieldRow[] = [],
): VersionFieldDefinition[] {
  const byKey = new Map<string, VersionFieldDefinition>()
  for (const definition of fieldDefinitions) {
    if (!byKey.has(definition.key)) byKey.set(definition.key, definition)
  }
  const catalogByKey = new Map<string, CatalogFieldRow>()
  for (const row of catalog) {
    if (row?.key) catalogByKey.set(String(row.key).replace(/^custom\./, ''), row)
  }

  for (const placeholder of collectAllPlaceholders(content)) {
    if (placeholder.startsWith('custom.')) continue
    const key = placeholder
    if (!key || byKey.has(key)) continue

    const cat = catalogByKey.get(key)
    if (!cat || cat.sourceType !== 'SYSTEM') continue

    const created: VersionFieldDefinition = {
      key,
      label: typeof cat.label === 'string' && cat.label.length > 0 ? cat.label : key,
      dataType: typeof cat.dataType === 'string' && cat.dataType.length > 0 ? cat.dataType : inferDataType(key),
      sourceType: 'SYSTEM',
      required: true,
    }
    byKey.set(key, created)
    fieldDefinitions.push(created)
  }

  return fieldDefinitions
}

/** Field dinamis (`CONTRACT_INPUT`) yang harus ditampilkan di form kontrak. */
export interface ContractInputField {
  /** key tanpa prefix `custom.` — sesuai yang diharapkan resolver & snapshot */
  key: string
  label: string
  dataType: string
  required: boolean
  sourceConfig?: unknown
  options?: unknown
}

/** Tipe field yang dikenali editor template & renderer form kontrak. */
const CONTRACT_INPUT_DATA_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN']

/**
 * Ambil field dinamis dari `fieldDefinitions` sebuah versi template.
 *
 * Dipakai endpoint `GET /contract-templates/:id/fields` yang mengisi form
 * kontrak. Sumbernya sengaja `fieldDefinitions` versi PUBLISHED — bukan tabel
 * katalog `ContractTemplateField` — supaya field yang ditampilkan form persis
 * sama dengan yang divalidasi `TemplateSnapshotService` saat kontrak dibuat.
 * Kalau endpoint membaca katalog sementara validasi membaca versi, form bisa
 * menampilkan field yang tidak ditegakkan (atau sebaliknya).
 *
 * Urutan field mengikuti urutan array `fieldDefinitions` (urutan yang dilihat
 * admin di editor template). `dataType` yang tidak dikenali jatuh ke `TEXT`
 * agar form tetap bisa merender input, bukan gagal senyap.
 */
export function extractContractInputFields(fieldDefinitions: unknown): ContractInputField[] {
  const fields: ContractInputField[] = []
  for (const definition of normalizeVersionFieldDefinitions(fieldDefinitions)) {
    if (definition.sourceType !== 'CONTRACT_INPUT') continue

    const field: ContractInputField = {
      key: definition.key,
      label: typeof definition.label === 'string' && definition.label.length > 0 ? definition.label : definition.key,
      dataType: typeof definition.dataType === 'string' && CONTRACT_INPUT_DATA_TYPES.includes(definition.dataType)
        ? definition.dataType
        : 'TEXT',
      required: definition.required === true,
    }
    if (definition.sourceConfig !== undefined && definition.sourceConfig !== null) {
      field.sourceConfig = definition.sourceConfig
    }
    if (definition.options !== undefined && definition.options !== null) {
      field.options = definition.options
    }
    fields.push(field)
  }
  return fields
}
