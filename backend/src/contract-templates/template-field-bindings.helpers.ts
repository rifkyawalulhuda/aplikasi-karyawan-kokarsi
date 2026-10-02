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
 *  - field yang TIDAK ter-bind sengaja tidak dihapus (editor bisa menambah field
 *    dinamis langsung dari `fieldDefinitions`).
 */
export function applyTemplateBindings(
  fieldDefinitions: unknown,
  bindings: TemplateFieldBindingRow[],
): VersionFieldDefinition[] {
  const definitions = normalizeVersionFieldDefinitions(fieldDefinitions)
  const byKey = new Map<string, VersionFieldDefinition>()
  for (const definition of definitions) {
    if (!byKey.has(definition.key)) byKey.set(definition.key, definition)
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

  return definitions
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
