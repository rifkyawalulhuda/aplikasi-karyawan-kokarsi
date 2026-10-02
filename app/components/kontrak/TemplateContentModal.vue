<script setup lang="ts">
interface Template { id: number, name: string, family: 'PKWT' | 'MITRA' }
interface Version { id: number, versionNumber: number, status: string, contentDefinition: any, fieldDefinitions: any, changeSummary?: string }
const props = defineProps<{ open: boolean, template: Template | null }>(); const emit = defineEmits<{ 'update:open': [boolean], 'saved': [] }>()
const open = computed({ get: () => props.open, set: v => emit('update:open', v) }); const toast = useToast()
const loading = ref(false), saving = ref(false), busy = ref(false), error = ref(''); const versions = ref<Version[]>([]), selected = ref<Version | null>(null), draft = ref<Version | null>(null), fields = ref<any[]>([])
const lang = ref<'id' | 'en'>('id'); const preview = ref<any>(null); const previewOpen = ref(false); const fieldOpen = ref(false); const fieldSaving = ref(false)
const fieldSearch = ref(''); const collapsedBlocks = ref<Record<string, boolean>>({}); const focusedBlockId = ref<string | null>(null)
const blockPickerOpen = ref(false); const confirmDeleteIndex = ref<number | null>(null); const pendingVersion = ref<Version | null>(null)
/** Sub-bagian blok yang sedang difokuskan (indeks paragraf/poin/baris/kolom), agar sisipan tepat sasaran. */
const focusedTarget = ref<{ blockId: string | null, path: string | null }>({ blockId: null, path: null })
const form = reactive({ key: '', label: '', dataType: 'TEXT', sourceType: 'CONTRACT_INPUT', options: '' })
const isPkwt = computed(() => props.template?.family === 'PKWT'); const blocks = computed<any[]>({ get: () => draft.value?.contentDefinition?.languages?.[lang.value] ?? selected.value?.contentDefinition?.languages?.[lang.value] ?? [], set: (v) => { if (draft.value)draft.value.contentDefinition.languages[lang.value] = v } })
const fieldItems = computed(() => fields.value.length ? fields.value : (Array.isArray(draft.value?.fieldDefinitions) ? draft.value?.fieldDefinitions : draft.value?.fieldDefinitions?.fields ?? []))
const placeholderText = (key: string) => `{{${key}}}`
const previewValues: Record<string, string> = {
  'employee.fullName': 'Budi Santoso', 'employee.employeeNo': 'KOK-0001', 'employee.jobRole': 'Staff Operasional',
  'contract.startDate': '1 Januari 2026', 'contract.endDate': '31 Desember 2026', 'contract.salary': 'Rp5.000.000',
  'company.name': 'Koperasi Karyawan Kokarsi', 'contract.number': 'PKWT/001/2026',
  'coop.chairmanName': 'Ahmad Fauzi'
}
function previewText(value: any) { return String(value ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => previewValues[key] ?? `«${key}»`) }
const previewBlocks = computed(() => blocks.value)
/** Blok title pertama jadi judul tengah dokumen (mengikuti drawTitleBlock renderer PDF). */
const titleBlock = computed(() => blocks.value.find(b => b.type === 'title') as any)
const subtitleBlock = computed(() => blocks.value.find(b => b.type === 'subtitle') as any)
const docTitle = computed(() => previewText(titleBlock.value?.text ?? ''))
const docSubtitle = computed(() => previewText(subtitleBlock.value?.text ?? ''))
const cloneVersion = (value: Version): Version => JSON.parse(JSON.stringify(value))
watch(() => props.open, (v) => { if (v && props.template)load() }); watch(() => props.template?.id, (v) => { if (v && props.open)load() })
async function load() { if (!props.template) return; loading.value = true; error.value = ''; try { const [vs, fs, bs] = await Promise.all([$fetch<Version[]>(`/api/contract-templates/${props.template.id}/versions`), $fetch<any[]>('/api/template-fields'), $fetch<{ fields: BindingView[] }>('/api/template-fields/bindings', { query: { templateId: props.template.id } })]); versions.value = vs ?? []; fields.value = fs ?? []; bindings.value = bs.fields ?? []; await select(versions.value.find(v => v.status === 'DRAFT') ?? versions.value.find(v => v.status === 'PUBLISHED') ?? versions.value[0]) } catch (e: any) { error.value = apiErrorMessage(e, 'Gagal memuat versi') } finally { loading.value = false } }
async function select(v?: Version) { if (!v) return; selected.value = await $fetch<Version>(`/api/contract-template-versions/${v.id}`); draft.value = selected.value.status === 'DRAFT' ? cloneVersion(selected.value) : null; setFocus(draft.value?.contentDefinition?.languages?.[lang.value]?.[0]?.id ?? null); snapshotDraft() }
async function createDraft() { if (!props.template || draft.value) return; busy.value = true; try { const v = await $fetch<Version>(`/api/contract-templates/${props.template.id}/versions`, { method: 'POST', body: { changeSummary: 'Draft baru dari editor' } }); versions.value = [v, ...versions.value]; await select(v) } catch (e: any) { toast.add({ title: 'Draft gagal dibuat', description: apiErrorMessage(e), color: 'error' }) } finally { busy.value = false } }
async function save() { if (!draft.value) return; saving.value = true; try { const v = await $fetch<Version>(`/api/contract-template-versions/${draft.value.id}`, { method: 'PUT', body: { contentDefinition: draft.value.contentDefinition, fieldDefinitions: draft.value.fieldDefinitions, changeSummary: draft.value.changeSummary || 'Perubahan editor' } }); draft.value = cloneVersion(v); selected.value = v; versions.value = versions.value.map(x => x.id === v.id ? v : x); snapshotDraft(); toast.add({ title: 'Draft tersimpan', color: 'success' }) } catch (e: any) { toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' }) } finally { saving.value = false } }
async function action(name: 'preview' | 'publish' | 'rollback') { const v = draft.value ?? selected.value; if (!v) return; busy.value = true; try { if (name === 'preview' && draft.value) await save(); const r = await $fetch<any>(`/api/contract-template-versions/${v.id}/${name}`, { method: 'POST' }); if (name === 'preview') { preview.value = r; previewOpen.value = true } else { toast.add({ title: name === 'publish' ? 'Versi dipublish' : 'Rollback berhasil', color: 'success' }); await load(); emit('saved') } } catch (e: any) { toast.add({ title: 'Aksi gagal', description: apiErrorMessage(e), color: 'error' }) } finally { busy.value = false } }
function add(type: string) { const id = `${type}-${Date.now()}`; const d: any = { paragraph: { id, type, text: '' }, article: { id, type, heading: 'Pasal baru', paragraphs: [''] }, list: { id, type, style: 'bullet', items: [''] }, table: { id, type, columns: [{ key: 'value', label: 'Nilai', width: 100, format: 'text' }], rows: [{ value: '' }] }, pageBreak: { id, type }, signature: { id, type, leftRole: 'Pihak Pertama', rightRole: 'Pihak Kedua' } }; blocks.value.push(d[type]); setFocus(id); collapsedBlocks.value[id] = false; blockPickerOpen.value = false }
function move(i: number, d: number) { const j = i + d; if (j < 0 || j >= blocks.value.length) return; const x = blocks.value.splice(i, 1)[0]; blocks.value.splice(j, 0, x) }
/** @deprecated gunakan `insertField()` — dipertahankan untuk kompatibilitas. */
const useField = insertField
async function createField() { fieldSaving.value = true; try { const f = await $fetch<any>('/api/template-fields', { method: 'POST', body: { key: form.key, label: form.label, dataType: form.dataType, sourceType: form.sourceType, options: form.dataType === 'DROPDOWN' ? form.options.split(',').map(x => x.trim()).filter(Boolean) : undefined } }); fields.value.push(f); fieldOpen.value = false; toast.add({ title: 'Field dibuat', color: 'success' }) } catch (e: any) { toast.add({ title: 'Field gagal dibuat', description: apiErrorMessage(e), color: 'error' }) } finally { fieldSaving.value = false } }
const color = (s: string) => s === 'PUBLISHED' ? 'success' : s === 'DRAFT' ? 'warning' : 'neutral'

// ── Panel binding: field katalog mana yang dipakai template ini + flag wajib ──
// Bind/unbind bersifat PER-TEMPLATE (bukan per-versi), jadi disimpan segera saat
// checkbox diklik — tidak menunggu "Simpan draft". Perubahan baru terlihat di
// form kontrak setelah versi berikutnya dipublish.
interface BindingView {
  fieldId: number
  key: string
  label: string
  dataType: string
  sourceType: string
  isSystem: boolean
  bound: boolean
  required: boolean
  locked: boolean
  usedInContent: boolean
  sortOrder: number | null
}
const bindings = ref<BindingView[]>([])
const bindingSaving = ref<number | null>(null)
const bindingOpen = ref(false)
const bindingSearch = ref('')

const filteredBindings = computed(() => {
  const q = bindingSearch.value.trim().toLowerCase()
  if (!q) return bindings.value
  return bindings.value.filter(b => [b.key, b.label].some(v => String(v ?? '').toLowerCase().includes(q)))
})
const boundCount = computed(() => bindings.value.filter(b => b.bound).length)

/**
 * Peringatan saat melepas field yang placeholder-nya masih ada di konten:
 * publish akan ditolak sampai `{{...}}` dihapus dari teks template.
 */
function setBinding(row: BindingView, patch: { bound?: boolean; required?: boolean }) {
  const nextBound = patch.bound ?? row.bound
  const nextRequired = patch.required ?? row.required
  if (nextBound === row.bound && nextRequired === row.required) return

  if (!nextBound && row.usedInContent) {
    const entry = toast.add({
      title: `Lepas field "${row.label}"?`,
      description: `Field masih dipakai di teks template (${placeholderText(row.key)}). Setelah dilepas, `
        + 'field hilang dari form kontrak dan PENERBITAN versi akan gagal sampai placeholder itu dihapus dari teks.',
      icon: 'i-lucide-triangle-alert',
      color: 'warning',
      duration: 0,
      close: false,
      actions: [
        { label: 'Batal', color: 'neutral', variant: 'ghost', onClick: () => toast.remove(entry.id) },
        {
          label: 'Tetap lepas',
          color: 'warning',
          variant: 'solid',
          onClick: () => { toast.remove(entry.id); void commitBinding(row, { bound: false, required: nextRequired }) },
        },
      ],
    })
    return
  }
  void commitBinding(row, { bound: nextBound, required: nextRequired })
}

async function commitBinding(row: BindingView, patch: { bound: boolean; required: boolean }) {
  bindingSaving.value = row.fieldId
  try {
    const res = await $fetch<{ fields: BindingView[] }>('/api/template-fields/bindings', {
      method: 'PUT',
      body: { templateId: props.template!.id, fieldId: row.fieldId, bound: patch.bound, required: patch.required },
    })
    bindings.value = res.fields ?? bindings.value
    if (!patch.bound && row.usedInContent) {
      toast.add({
        title: 'Field dilepas dari template',
        description: `Hapus ${placeholderText(row.key)} dari teks template sebelum menerbitkan versi baru.`,
        color: 'warning',
      })
    } else {
      toast.add({ title: patch.bound ? 'Field dipakai di template' : 'Field dilepas dari template', color: 'success' })
    }
  } catch (e: any) {
    toast.add({ title: 'Gagal mengubah field', description: apiErrorMessage(e), color: 'error' })
  } finally {
    bindingSaving.value = null
  }
}

/** Katalog tipe blok untuk pemilih "Tambah blok" — label ramah pengguna. */
const BLOCK_PICKER = [
  { type: 'paragraph', label: 'Paragraf', icon: 'i-lucide-align-left', desc: 'Satu blok teks biasa' },
  { type: 'article', label: 'Pasal', icon: 'i-lucide-scale', desc: 'Judul pasal + beberapa paragraf uraian' },
  { type: 'list', label: 'Daftar', icon: 'i-lucide-list', desc: 'Poin bernomor, huruf, atau bullet' },
  { type: 'table', label: 'Tabel', icon: 'i-lucide-table', desc: 'Baris dan kolom, mis. rincian upah' },
  { type: 'signature', label: 'Tanda Tangan', icon: 'i-lucide-pen-line', desc: 'Blok tanda tangan dua pihak' },
  { type: 'title', label: 'Judul Dokumen', icon: 'i-lucide-heading-1', desc: 'Judul utama di tengah halaman' },
  { type: 'subtitle', label: 'Subjudul', icon: 'i-lucide-heading-2', desc: 'Baris kecil di bawah judul' },
  { type: 'pageBreak', label: 'Ganti Halaman', icon: 'i-lucide-scissors', desc: 'Paksa halaman baru di PDF' }
] as const

/** Apakah draft punya perubahan yang belum disimpan. */
const draftDirty = ref(false)
const originalDraftJson = ref('')
function snapshotDraft() { originalDraftJson.value = draft.value ? JSON.stringify(draft.value) : ''; draftDirty.value = false }
watch(draft, () => {
  if (!draft.value) { draftDirty.value = false; return }
  // Baseline diambil sekali per versi; perubahan apa pun membuat draft "kotor".
  draftDirty.value = JSON.stringify(draft.value) !== originalDraftJson.value
}, { deep: true })

/** Field yang tampil di panel kanan, mengikuti kata kunci pencarian. */
const filteredFieldItems = computed(() => {
  const q = fieldSearch.value.trim().toLowerCase()
  const items = fieldItems.value ?? []
  if (!q) return items
  return items.filter((f: any) => [f.key, f.label].some(v => String(v ?? '').toLowerCase().includes(q)))
})

/** Blok yang sedang dituju sisipan placeholder. */
const focusedBlock = computed(() => (blocks.value ?? []).find((b: any) => b.id === focusedBlockId.value) ?? null)

/** Label sub-bagian target (paragraf/poin/sel) untuk ditampilkan ke pengguna. */
const focusedLocationLabel = computed(() => {
  const b: any = focusedBlock.value
  if (!b) return ''
  const path = focusedTarget.value.path
  if (!path) return b.type === 'article' ? 'paragraf 1' : b.type === 'list' ? 'poin 1' : b.type === 'table' ? 'sel pertama' : 'isi blok'
  const parts = path.split(':')
  const n = Number(parts[parts.length - 1])
  if (path.startsWith('art:')) return `paragraf ${Number.isInteger(n) ? n + 1 : 1}`
  if (path.startsWith('item:')) return `poin ${Number.isInteger(n) ? n + 1 : 1}`
  if (path.startsWith('row:')) return `sel tabel (baris ${Number(parts[1]) + 1})`
  return 'isi blok'
})

/**
 * Tandai blok + sub-bagian yang difokuskan (dipanggil kartu blok).
 * `path === undefined` = sinyal "blok aktif" saja (dari `focusin` umum): jangan
 * menimpa sub-bagian yang sudah tercatat pada blok yang sama.
 */
function setFocus(blockId: string | null, path?: string | null) {
  // PENTING: jangan beri default `= null` pada `path`. Default parameter JS
  // menelan `undefined`, sehingga sinyal "blok aktif saja" dari `focusin`
  // yang membubbling akan tampak seperti `null` dan menghapus sub-bagian
  // (paragraf/poin) yang baru saja difokuskan.
  if (path === undefined) {
    if (focusedBlockId.value === blockId) return
    focusedBlockId.value = blockId
    focusedTarget.value = { blockId, path: null }
    return
  }
  focusedBlockId.value = blockId
  focusedTarget.value = { blockId, path }
}

/** Sisipkan placeholder field ke bagian blok yang sedang difokuskan. */
function insertField(key: string) {
  const list = blocks.value ?? []
  const target = focusedBlock.value ?? list[0]
  if (!target) {
    toast.add({ title: 'Belum ada blok', description: 'Tambahkan minimal satu blok sebelum menyisipkan field.', color: 'warning' })
    return
  }
  const text = `{{${key}}}`
  // Sub-path hanya relevan kalau kita benar-benar memakai blok yang terfokus.
  // Kalau jatuh ke `list[0]`, path lama tidak boleh dipakai (bisa nyasar ke blok lain).
  const path = focusedBlock.value ? focusedTarget.value.path : null
  const slotIndex = path ? Number(path.split(':').pop()) : NaN
  const at = Number.isInteger(slotIndex) && slotIndex >= 0 ? slotIndex : 0
  const appendTo = (cur: any) => `${cur ?? ''} ${text}`.trim()

  if (target.type === 'article') {
    if (!target.paragraphs?.length) target.paragraphs = ['']
    const i = Math.min(at, target.paragraphs.length - 1)
    target.paragraphs[i] = appendTo(target.paragraphs[i])
  } else if (target.type === 'list') {
    if (!target.items?.length) target.items = ['']
    const i = Math.min(at, target.items.length - 1)
    target.items[i] = appendTo(target.items[i])
  } else if (target.type === 'table') {
    if (!target.columns?.length) target.columns = [{ key: 'value', label: 'Nilai', width: 100, format: 'text' }]
    if (!target.rows?.length) target.rows = [{}]
    // path berbentuk `row:<baris>:<kolom>`; jatuh ke sel pertama bila tak ada fokus.
    const parts = path?.split(':') ?? []
    const rowIdx = parts[0] === 'row' ? Number(parts[1]) : 0
    const colIdx = parts[0] === 'row' ? Number(parts[2]) : 0
    const r = Math.min(Number.isInteger(rowIdx) && rowIdx >= 0 ? rowIdx : 0, target.rows.length - 1)
    const column = target.columns[Number.isInteger(colIdx) && colIdx >= 0 ? colIdx : 0] ?? target.columns[0]
    target.rows[r][column.key] = appendTo(target.rows[r][column.key])
  } else if (target.type === 'signature') {
    toast.add({ title: 'Blok tanda tangan tidak menerima field', description: 'Sisipkan field ke blok teks, pasal, daftar, atau tabel.', color: 'warning' })
    return
  } else {
    target.text = appendTo(target.text)
  }
  const where = target.type === 'article' ? `paragraf ${Math.min(at, Math.max(target.paragraphs.length - 1, 0)) + 1}`
    : target.type === 'list' ? `poin ${Math.min(at, Math.max(target.items.length - 1, 0)) + 1}`
      : target.type === 'table' ? 'sel tabel'
        : 'isi blok'
  toast.add({ title: `Field disisipkan ke Blok ${list.indexOf(target) + 1}`, description: `Ditempatkan di ${where}.`, color: 'success' })
}

/** Duplikat blok, termasuk seluruh isinya. */
function duplicateBlock(i: number) {
  const list = blocks.value ?? []
  const src = list[i]
  if (!src) return
  const copy = JSON.parse(JSON.stringify(src))
  copy.id = `${src.type}-${Date.now()}`
  list.splice(i + 1, 0, copy)
  toast.add({ title: 'Blok diduplikat', color: 'success' })
}

/** Hapus blok setelah konfirmasi. */
function confirmDeleteBlock() {
  if (confirmDeleteIndex.value === null) return
  blocks.value.splice(confirmDeleteIndex.value, 1)
  confirmDeleteIndex.value = null
  toast.add({ title: 'Blok dihapus', color: 'success' })
}

const confirmCloseOpen = ref(false)

/** Pilih versi — kalau draft berubah, minta konfirmasi dulu. */
async function requestSelect(v: Version) {
  if (draftDirty.value && v.id !== selected.value?.id) { pendingVersion.value = v; return }
  await select(v)
}

/** Tutup modal — kalau draft berubah, minta konfirmasi dulu. */
function requestClose() {
  if (draftDirty.value) { pendingVersion.value = null; confirmCloseOpen.value = true; return }
  open.value = false
}

/** Ringkasan singkat isi blok untuk tampilan daftar. */
const blocksCount = computed(() => (blocks.value ?? []).length)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Editor Template — ${template?.name ?? ''}`"
    :description="draft ? 'Anda berada di mode edit draft.' : 'Mode baca: pilih atau buat draft untuk mengubah isi.'"
    :ui="{ content: 'max-w-7xl w-full' }"
  >
    <template #body>
      <div v-if="error" class="space-y-3 p-4">
        <UAlert
          icon="i-lucide-circle-alert"
          color="error"
          variant="subtle"
          title="Gagal memuat editor"
          :description="error"
        />
        <UButton label="Coba lagi" icon="i-lucide-refresh-cw" @click="load" />
      </div>

      <div v-else-if="loading" class="flex flex-col items-center gap-3 p-12 text-muted">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
        <p class="text-sm">
          Memuat versi template…
        </p>
      </div>

      <div v-else class="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)_320px]">
        <!-- ── Riwayat versi ── -->
        <aside class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="font-semibold">
                Riwayat versi
              </p>
              <p class="text-xs text-muted">
                {{ versions.length }} versi
              </p>
            </div>
            <UTooltip v-if="!draft" text="Buat draft baru untuk diedit">
              <UButton
                size="xs"
                label="Draft baru"
                icon="i-lucide-plus"
                :loading="busy"
                @click="createDraft"
              />
            </UTooltip>
          </div>

          <div v-if="!versions.length" class="rounded-lg border border-dashed border-default p-4 text-center">
            <UIcon name="i-lucide-file-stack" class="mx-auto size-6 text-muted" />
            <p class="mt-2 text-xs text-muted">
              Belum ada versi. Buat draft baru untuk mulai menyusun template.
            </p>
          </div>

          <div class="max-h-[62vh] space-y-2 overflow-auto pr-1">
            <div
              v-for="v in versions"
              :key="v.id"
              class="cursor-pointer rounded-lg border p-3 transition hover:border-primary/50"
              :class="selected?.id === v.id ? 'border-primary bg-primary/5' : 'border-default'"
              @click="requestSelect(v)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                  <UIcon
                    v-if="selected?.id === v.id"
                    name="i-lucide-circle-dot"
                    class="size-3.5 shrink-0 text-primary"
                  />
                  <b class="text-sm">v{{ v.versionNumber }}</b>
                </div>
                <UBadge
                  :color="color(v.status)"
                  variant="subtle"
                  size="sm"
                  :label="v.status"
                />
              </div>
              <p class="mt-1 line-clamp-2 text-xs text-muted">
                {{ v.changeSummary || 'Tanpa ringkasan' }}
              </p>
              <UButton
                v-if="v.status === 'ARCHIVED'"
                class="mt-2"
                size="xs"
                label="Rollback ke versi ini"
                icon="i-lucide-undo-2"
                variant="subtle"
                color="warning"
                @click.stop="select(v).then(() => action('rollback'))"
              />
            </div>
          </div>
        </aside>

        <!-- ── Editor blok ── -->
        <main class="min-w-0 space-y-4">
          <div class="space-y-3">
            <!-- Status + aksi utama -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-semibold">
                    {{ draft ? 'Draft' : 'Versi' }} v{{ (draft ?? selected)?.versionNumber }}
                  </p>
                  <UBadge
                    v-if="draftDirty"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-circle-dot"
                    label="Belum disimpan"
                  />
                  <UBadge
                    v-else-if="draft"
                    color="success"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-check"
                    label="Tersimpan"
                  />
                </div>
                <p class="text-xs text-muted">
                  {{ draft ? 'Perubahan berlaku setelah Publish.' : 'Mode baca — buat draft baru untuk mengubah isi.' }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  label="Pratinjau"
                  icon="i-lucide-eye"
                  variant="soft"
                  :loading="busy"
                  @click="action('preview')"
                />
                <UButton
                  v-if="draft"
                  label="Simpan"
                  icon="i-lucide-save"
                  variant="soft"
                  :disabled="!draftDirty"
                  :loading="saving"
                  @click="save"
                />
                <UButton
                  v-if="draft"
                  label="Publish"
                  icon="i-lucide-rocket"
                  color="primary"
                  :loading="busy"
                  @click="action('publish')"
                />
              </div>
            </div>

            <UFormField
              v-if="draft"
              label="Ringkasan perubahan"
              help="Muncul di riwayat versi supaya tim lain tahu apa yang berubah."
            >
              <UInput v-model="draft.changeSummary" placeholder="Contoh: Perbarui Pasal 5 tentang upah" class="w-full" />
            </UFormField>

            <!-- Bahasa + jumlah blok -->
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-default">
              <div class="flex gap-1">
                <UButton
                  label="Indonesia"
                  icon="i-lucide-languages"
                  size="sm"
                  :variant="lang === 'id' ? 'soft' : 'ghost'"
                  :color="lang === 'id' ? 'primary' : 'neutral'"
                  @click="lang = 'id'"
                />
                <UButton
                  v-if="isPkwt"
                  label="English"
                  icon="i-lucide-languages"
                  size="sm"
                  :variant="lang === 'en' ? 'soft' : 'ghost'"
                  :color="lang === 'en' ? 'primary' : 'neutral'"
                  @click="lang = 'en'"
                />
              </div>
              <p class="text-xs text-muted">
                {{ blocksCount }} blok pada versi {{ lang === 'id' ? 'Indonesia' : 'English' }}
              </p>
            </div>
          </div>

          <!-- Daftar blok -->
          <div v-if="!blocksCount" class="rounded-xl border border-dashed border-default p-8 text-center">
            <UIcon name="i-lucide-layout-list" class="mx-auto size-8 text-muted" />
            <p class="mt-3 font-medium">
              Belum ada blok di versi {{ lang === 'id' ? 'Indonesia' : 'English' }}
            </p>
            <p class="mx-auto mt-1 max-w-sm text-sm text-muted">
              Blok adalah bagian dokumen (paragraf, pasal, tabel, tanda tangan).
              Tambahkan blok pertama untuk mulai menyusun template.
            </p>
            <UButton
              v-if="draft"
              class="mt-4"
              label="Tambah blok pertama"
              icon="i-lucide-plus"
              color="primary"
              @click="blockPickerOpen = true"
            />
            <p v-else class="mt-3 text-xs text-muted">
              Buat draft baru untuk mulai mengubah isi.
            </p>
          </div>

          <div v-else class="space-y-2">
            <KontrakTemplateBlockCard
              v-for="(b, i) in blocks"
              :key="b.id"
              :block="b"
              :index="i"
              :total="blocksCount"
              :editable="!!draft"
              :collapsed="collapsedBlocks[b.id] ?? true"
              :selected="focusedBlockId === b.id"
              @update:collapsed="v => collapsedBlocks[b.id] = v"
              @activate="(id, path) => setFocus(id, path)"
              @move="d => move(i, d)"
              @duplicate="duplicateBlock(i)"
              @remove="confirmDeleteIndex = i"
            />
          </div>

          <UButton
            v-if="draft"
            block
            label="Tambah blok"
            icon="i-lucide-plus"
            variant="soft"
            size="lg"
            @click="blockPickerOpen = true"
          />
          <div v-else-if="blocksCount" class="rounded-lg bg-elevated p-3 text-center text-sm text-muted">
            Mode baca. Buat draft baru untuk menambah atau mengubah blok.
          </div>
        </main>

        <!-- ── Field dinamis (sticky) + Pratinjau + Validasi ── -->
        <aside class="space-y-3">
          <!-- Panel field: sticky agar daftar field selalu terlihat saat menggulir blok. -->
          <div class="flex flex-col gap-2 rounded-lg border border-default bg-default p-3 shadow-sm lg:sticky lg:top-3 lg:z-10 lg:max-h-[calc(100dvh-8rem)]">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-semibold">
                  Field dinamis
                </p>
                <p class="text-xs text-muted">
                  Klik untuk menyisipkan ke blok terpilih.
                </p>
              </div>
              <div class="flex items-center gap-1">
                <UButton
                  size="xs"
                  label="Kelola"
                  icon="i-lucide-list-checks"
                  variant="soft"
                  color="neutral"
                  @click="bindingOpen = true"
                />
                <UButton
                  size="xs"
                  label="Baru"
                  icon="i-lucide-plus"
                  variant="soft"
                  @click="fieldOpen = true"
                />
              </div>
            </div>

            <p v-if="focusedBlock" class="rounded-md bg-primary/5 px-2 py-1 text-xs text-muted">
              Sisipkan ke
              <b class="text-primary">Blok {{ blocks.indexOf(focusedBlock) + 1 }}</b>
              <span v-if="focusedLocationLabel"> · {{ focusedLocationLabel }}</span>
            </p>
            <p v-else-if="blocksCount" class="rounded-md bg-elevated px-2 py-1 text-xs text-muted">
              Belum ada blok terpilih — field masuk ke Blok 1.
            </p>

            <UInput
              v-model="fieldSearch"
              icon="i-lucide-search"
              placeholder="Cari field…"
              size="sm"
              class="w-full shrink-0"
            />

            <div class="min-h-0 flex-1 space-y-1.5 overflow-auto pr-1">
              <UButton
                v-for="f in filteredFieldItems"
                :key="f.key"
                block
                variant="outline"
                color="neutral"
                size="sm"
                :disabled="!draft"
                class="justify-start text-left"
                @click="insertField(f.key)"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm">
                    {{ f.label || f.key }}
                  </p>
                  <code class="text-xs text-muted">{{ placeholderText(f.key) }}</code>
                </div>
                <UIcon v-if="draft" name="i-lucide-corner-down-left" class="size-3.5 shrink-0" />
              </UButton>

              <div
                v-if="!filteredFieldItems.length"
                class="rounded border border-dashed border-default p-3 text-center text-xs text-muted"
              >
                {{ fieldSearch ? 'Tidak ada field yang cocok.' : 'Belum ada field. Buat field baru untuk dipakai di template.' }}
              </div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between">
              <p class="font-semibold">
                Pratinjau dokumen
              </p>
              <UBadge
                color="neutral"
                variant="subtle"
                size="sm"
                label="data contoh"
              />
            </div>
            <p class="mt-0.5 text-xs text-muted">
              Tampilan mengikuti PDF asli (Times New Roman, kop surat, tanda tangan dua pihak).
            </p>
          </div>

          <div class="max-h-[52vh] overflow-auto rounded-lg bg-neutral-200 p-3">
            <KontrakDocumentPreview
              :blocks="blocks"
              :values="previewValues"
              :title="docTitle"
              :subtitle="docSubtitle"
              :contract-no="previewValues['contract.number']"
            />
          </div>

          <div class="rounded-lg border border-default p-3">
            <p class="font-semibold">
              Validasi template
            </p>
            <div v-if="preview" class="mt-2 space-y-1 text-sm">
              <p>
                <span class="text-muted">Status:</span>
                <UBadge :color="preview.valid ? 'success' : 'error'" :label="preview.valid ? 'Valid' : 'Tidak valid'" />
              </p>
              <p><span class="text-muted">Placeholder:</span> {{ preview.placeholderCount }}</p>
              <p><span class="text-muted">Blok:</span> {{ preview.blockCount }}</p>
            </div>
            <p v-else class="mt-2 text-xs text-muted">
              Klik <b>Pratinjau</b> untuk menjalankan validasi backend.
            </p>
          </div>
        </aside>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <p v-if="draftDirty" class="text-xs text-warning">
          Ada perubahan yang belum disimpan.
        </p>
        <span v-else />
        <div class="flex gap-2">
          <UButton
            label="Tutup"
            color="neutral"
            variant="subtle"
            @click="requestClose"
          />
          <UButton
            v-if="draft"
            label="Simpan draft"
            icon="i-lucide-save"
            color="primary"
            :disabled="!draftDirty"
            :loading="saving"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- ── Modal pratinjau (validasi backend) ── -->
  <UModal v-model:open="previewOpen" title="Pratinjau dokumen" :ui="{ content: 'max-w-5xl w-full' }">
    <template #body>
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div class="max-h-[70vh] overflow-auto rounded-lg bg-neutral-200 p-3">
          <KontrakDocumentPreview
            :blocks="previewBlocks"
            :values="previewValues"
            :title="docTitle"
            :subtitle="docSubtitle"
            :contract-no="previewValues['contract.number']"
          />
        </div>
        <aside class="space-y-3">
          <UAlert
            v-if="preview"
            :icon="preview.valid ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
            :color="preview.valid ? 'success' : 'error'"
            variant="subtle"
            :title="preview.valid ? 'Template valid' : 'Template tidak valid'"
            :description="preview.valid ? 'Semua placeholder dan blok lolos validasi backend.' : 'Periksa kembali placeholder dan struktur blok.'"
          />
          <div v-if="preview" class="space-y-1 text-sm">
            <p><span class="text-muted">Placeholder:</span> {{ preview.placeholderCount }}</p>
            <p><span class="text-muted">Blok:</span> {{ preview.blockCount }}</p>
          </div>
          <UAlert
            icon="i-lucide-info"
            color="neutral"
            variant="subtle"
            title="Tentang pratinjau"
            description="Teks berwarna adalah data contoh. Placeholder tanpa nilai tampil sebagai «kunci» persis seperti di PDF."
          />
        </aside>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Tutup"
        color="neutral"
        variant="subtle"
        @click="previewOpen = false"
      />
    </template>
  </UModal>

  <!-- ── Modal pilih tipe blok ── -->
  <UModal
    v-model:open="blockPickerOpen"
    title="Tambah blok"
    description="Pilih jenis bagian dokumen yang ingin ditambahkan."
    :ui="{ content: 'max-w-3xl w-full' }"
  >
    <template #body>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="opt in BLOCK_PICKER"
          :key="opt.type"
          type="button"
          class="flex items-start gap-3 rounded-lg border border-default p-3 text-left transition hover:border-primary hover:bg-primary/5"
          @click="add(opt.type)"
        >
          <UIcon :name="opt.icon" class="mt-0.5 size-5 shrink-0 text-primary" />
          <div class="min-w-0">
            <p class="font-medium">
              {{ opt.label }}
            </p>
            <p class="text-xs text-muted">
              {{ opt.desc }}
            </p>
          </div>
        </button>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Batal"
        color="neutral"
        variant="subtle"
        @click="blockPickerOpen = false"
      />
    </template>
  </UModal>

  <!-- ── Konfirmasi hapus blok ── -->
  <UModal
    :open="confirmDeleteIndex !== null"
    title="Hapus blok ini?"
    description="Blok beserta seluruh isinya akan dihilangkan dari draft. Belum permanen sampai Publish."
    @update:open="v => { if (!v) confirmDeleteIndex = null }"
  >
    <template #body>
      <div v-if="confirmDeleteIndex !== null" class="rounded-lg bg-elevated p-3">
        <p class="text-sm">
          <span class="text-muted">Blok {{ confirmDeleteIndex + 1 }} ·</span>
          <b>{{ blocks[confirmDeleteIndex]?.type }}</b>
        </p>
        <p class="mt-1 line-clamp-2 text-xs text-muted">
          {{ String(blocks[confirmDeleteIndex]?.text || blocks[confirmDeleteIndex]?.heading || '') || 'Tanpa teks' }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="subtle"
          @click="confirmDeleteIndex = null"
        />
        <UButton
          label="Hapus blok"
          icon="i-lucide-trash-2"
          color="error"
          @click="confirmDeleteBlock"
        />
      </div>
    </template>
  </UModal>

  <!-- ── Konfirmasi perubahan belum disimpan ── -->
  <UModal
    v-model:open="confirmCloseOpen"
    title="Perubahan belum disimpan"
    description="Kalau ditutup sekarang, perubahan pada draft ini akan hilang."
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Tetap di sini"
          color="neutral"
          variant="subtle"
          @click="confirmCloseOpen = false"
        />
        <UButton
          label="Buang perubahan"
          color="error"
          @click="confirmCloseOpen = false; open = false"
        />
      </div>
    </template>
  </UModal>

  <!-- ── Konfirmasi pindah versi ── -->
  <UModal
    :open="pendingVersion !== null"
    title="Pindah versi?"
    description="Draft yang sedang diedit belum disimpan. Berpindah versi akan membuang perubahan itu."
    @update:open="v => { if (!v) pendingVersion = null }"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Tetap di sini"
          color="neutral"
          variant="subtle"
          @click="pendingVersion = null"
        />
        <UButton
          label="Buang & pindah"
          color="error"
          @click="select(pendingVersion ?? undefined).then(() => pendingVersion = null)"
        />
      </div>
    </template>
  </UModal>

  <!-- ── Modal field kustom ── -->
  <UModal
    v-model:open="fieldOpen"
    title="Field kustom baru"
    description="Field dipakai sebagai placeholder di dalam blok teks."
  >
    <template #body>
      <div class="space-y-3">
        <UFormField label="Kunci" help="Tanpa spasi; gunakan titik untuk pengelompokan, mis. employee.fullName" required>
          <UInput v-model="form.key" placeholder="employee.namaPanggilan" class="w-full" />
        </UFormField>
        <UFormField label="Label" help="Nama yang tampil saat pengisian kontrak." required>
          <UInput v-model="form.label" placeholder="Nama Panggilan" class="w-full" />
        </UFormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Tipe data">
            <USelect v-model="form.dataType" :items="['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MASTER_REFERENCE']" class="w-full" />
          </UFormField>
          <UFormField label="Sumber nilai">
            <USelect v-model="form.sourceType" :items="['CONTRACT_INPUT', 'MASTER_REFERENCE']" class="w-full" />
          </UFormField>
        </div>
        <UFormField v-if="form.dataType === 'DROPDOWN'" label="Pilihan" help="Pisahkan tiap opsi dengan koma.">
          <UInput v-model="form.options" placeholder="Tetap, Kontrak, Harian" class="w-full" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="subtle"
          @click="fieldOpen = false"
        />
        <UButton
          label="Buat field"
          color="primary"
          :loading="fieldSaving"
          @click="createField"
        />
      </div>
    </template>
  </UModal>

  <!-- ── Modal kelola field template (binding + wajib) ── -->
  <UModal
    v-model:open="bindingOpen"
    title="Field pada template ini"
    description="Tentukan field mana yang muncul di form kontrak dan mana yang wajib diisi."
    :ui="{ content: 'max-w-3xl w-full' }"
  >
    <template #body>
      <div class="space-y-3">
        <UAlert
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="Berlaku setelah Publish"
          description="Perubahan di sini tersimpan langsung ke template. Form kontrak mengikuti versi PUBLISHED, jadi terbitkan versi baru agar perubahan terlihat."
        />

        <UInput
          v-model="bindingSearch"
          icon="i-lucide-search"
          placeholder="Cari field…"
          size="sm"
          class="w-full"
        />

        <div v-if="!bindings.length" class="flex items-center gap-2 py-6 text-sm text-muted">
          <UIcon name="i-lucide-info" class="size-4" />
          Belum ada field katalog. Tambahkan field lewat tombol "Baru".
        </div>

        <div v-else class="max-h-[55vh] overflow-auto rounded-lg border border-default">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-elevated text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="px-3 py-2 font-semibold">
                  Field
                </th>
                <th class="w-20 px-3 py-2 text-center font-semibold">
                  Pakai
                </th>
                <th class="w-20 px-3 py-2 text-center font-semibold">
                  Wajib
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredBindings"
                :key="row.fieldId"
                class="border-t border-default align-top"
                :class="row.bound ? '' : 'opacity-70'"
              >
                <td class="px-3 py-2">
                  <p class="font-medium text-highlighted">
                    {{ row.label }}
                  </p>
                  <code class="text-xs text-muted">{{ placeholderText(row.key) }}</code>
                  <div class="mt-1 flex flex-wrap items-center gap-1">
                    <UBadge
                      :color="row.sourceType === 'SYSTEM' ? 'neutral' : 'primary'"
                      variant="subtle"
                      size="xs"
                      :label="row.sourceType === 'SYSTEM' ? 'Otomatis' : 'Input manual'"
                    />
                    <UBadge
                      v-if="row.usedInContent"
                      color="warning"
                      variant="subtle"
                      size="xs"
                      label="Dipakai di teks"
                    />
                  </div>
                  <p v-if="row.usedInContent && !row.locked" class="mt-1 text-xs text-warning">
                    Melepas field ini butuh menghapus {{ placeholderText(row.key) }} dari teks template,
                    atau Publish akan gagal.
                  </p>
                </td>
                <td class="px-3 py-2 text-center">
                  <UCheckbox
                    :model-value="row.bound"
                    :disabled="row.locked || bindingSaving === row.fieldId"
                    @update:model-value="v => setBinding(row, { bound: v === true })"
                  />
                </td>
                <td class="px-3 py-2 text-center">
                  <UCheckbox
                    :model-value="row.required"
                    :disabled="row.locked || !row.bound || bindingSaving === row.fieldId"
                    @update:model-value="v => setBinding(row, { required: v === true })"
                  />
                </td>
              </tr>
              <tr v-if="!filteredBindings.length">
                <td colspan="3" class="px-3 py-6 text-center text-sm text-muted">
                  Tidak ada field yang cocok.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-xs text-muted">
          {{ boundCount }} dari {{ bindings.length }} field dipakai template ini.
          Field "Otomatis" selalu dipakai dan wajib — nilainya diambil dari data karyawan/kontrak.
        </p>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Tutup"
        color="neutral"
        variant="subtle"
        @click="bindingOpen = false"
      />
    </template>
  </UModal>
</template>
