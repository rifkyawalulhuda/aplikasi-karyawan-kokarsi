<script setup lang="ts">
/**
 * Satu kartu blok konten di editor template.
 *
 * Tujuan UX: pengguna tidak perlu tahu istilah internal (`b.id`, slug tipe
 * blok seperti `pageBreak`). Kartu ini menampilkan nama tipe dalam bahasa
 * Indonesia, ringkasan isi, dan hanya mengungkap detail teknis lewat
 * bagian "Detail teknis" yang tertutup.
 */
interface Props {
  block: any
  index: number
  total: number
  editable: boolean
  collapsed: boolean
  selected: boolean
  /** Sedang ditarik (drag) — kartu diredupkan. */
  dragging?: boolean
  /** Garis sisip: di atas kartu (`before`) atau di bawahnya (`after`). */
  dropIndicator?: 'none' | 'before' | 'after'
}
const props = withDefaults(defineProps<Props>(), {
  dragging: false,
  dropIndicator: 'none'
})
const emit = defineEmits<{
  'move': [direction: number]
  'remove': []
  'duplicate': []
  'update:collapsed': [value: boolean]
  'activate': [blockId: string, path?: string | null]
  'dragstart': [event: DragEvent]
  'dragend': []
}>()

/**
 * Koleksi bertipe. `block` sengaja `any` (bentuknya beda per tipe blok), jadi
 * `v-for` atas `block.paragraphs` membuat index ter-infer `string | number`.
 * Computed ini memaksa tipe agar `p`/`ci`/`ri` dikenali `number` oleh vue-tsc.
 * `v-model` tetap menunjuk array asli (`block.paragraphs[p]`) agar tersimpan.
 */
/** Kolom tabel konten: label + kunci + metadata format. */
interface TableColumn {
  key: string
  label?: string
  width?: number
  format?: string
}

const paragraphList = computed<string[]>(() => props.block?.paragraphs ?? [])
const itemList = computed<string[]>(() => props.block?.items ?? [])
const columnList = computed<TableColumn[]>(() => props.block?.columns ?? [])
const rowList = computed<Record<string, string>[]>(() => props.block?.rows ?? [])

/**
 * Beri tahu induk blok mana (dan sub-bagian mana) yang sedang difokuskan.
 * `path === undefined` = sinyal "blok aktif" dari `focusin` umum; sub-bagian
 * yang sudah tercatat dipertahankan. Penting: jangan menulis default `= null`
 * di sini, karena default parameter JS menelan `undefined`.
 */
function markFocus(path?: string | null) { emit('activate', props.block?.id, path) }
/** Setel ulang ke blok ini tanpa sub-bagian (klik area kosong kartu). */
function markBlockOnly() { emit('activate', props.block?.id, null) }

/**
 * Judul pasal dirancang maksimal 2 baris (`"PASAL 1\nRUANG LINGKUP"`), dan
 * layout PDF MITRA memakai batas itu untuk mengukur tinggi + menjaga judul
 * tidak terpisah dari uraiannya.
 *
 * Karena field ini kini `UTextarea` (bisa menerima Enter), Enter perlu dijaga
 * agar pengguna tidak membuat baris ke-3 yang merusak tata letak:
 * - sudah ada 1 newline  -> tolak (sudah 2 baris)
 * - baris pertama kosong -> tolak (hindari baris kosong di atas judul)
 *
 * Penjagaan ini hanya untuk jalur ketik. Tempel-teks (paste) yang membawa
 * `\n\n` atau 3+ baris tidak melewatinya, sehingga backend menormalkan judul
 * pasal saat draft disimpan / versi dipublish — lihat `normalizeArticleHeadings`
 * di `template-schema.validator.ts`.
 */
function onHeadingKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  const heading = String(props.block?.heading ?? '')
  if (heading.includes('\n') || heading.trim() === '') event.preventDefault()
}

/** Nama tipe blok yang ramah pengguna (bukan slug internal). */
const BLOCK_META: Record<string, { label: string, icon: string, hint: string }> = {
  title: { label: 'Judul', icon: 'i-lucide-heading-1', hint: 'Judul dokumen' },
  subtitle: { label: 'Subjudul', icon: 'i-lucide-heading-2', hint: 'Subjudul di bawah judul' },
  paragraph: { label: 'Paragraf', icon: 'i-lucide-align-left', hint: 'Teks biasa satu blok' },
  article: { label: 'Pasal', icon: 'i-lucide-scale', hint: 'Pasal dengan judul dan uraian' },
  list: { label: 'Daftar', icon: 'i-lucide-list', hint: 'Poin-poin bernomor / bullet' },
  table: { label: 'Tabel', icon: 'i-lucide-table', hint: 'Data baris dan kolom' },
  pageBreak: { label: 'Ganti Halaman', icon: 'i-lucide-scissors', hint: 'Paksa halaman baru di PDF' },
  signature: { label: 'Tanda Tangan', icon: 'i-lucide-pen-line', hint: 'Blok tanda tangan dua pihak' }
}

const meta = computed(() => BLOCK_META[props.block?.type] ?? {
  label: props.block?.type ?? 'Blok', icon: 'i-lucide-square', hint: ''
})

/** Ringkasan isi blok supaya kartu bisa dikenali tanpa dibuka. */
const summary = computed(() => {
  const b = props.block ?? {}
  const clean = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim()
  switch (b.type) {
    case 'title':
    case 'subtitle':
    case 'paragraph':
      return clean(b.text) || 'Belum ada teks'
    case 'article':
      return clean(b.heading) || 'Belum ada judul pasal'
    case 'list':
      return `${(b.items ?? []).length} poin · ${clean((b.items ?? [])[0]) || 'kosong'}`
    case 'table':
      return `${(b.rows ?? []).length} baris × ${(b.columns ?? []).length} kolom`
    case 'pageBreak':
      return 'Halaman baru dimulai setelah blok ini'
    case 'signature':
      return `${clean(b.leftRole) || 'Pihak Pertama'} & ${clean(b.rightRole) || 'Pihak Kedua'}`
    default:
      return meta.value.hint
  }
})

/** Peringatan halus bila ada isi yang masih kosong. */
const emptyWarnings = computed(() => {
  const b = props.block ?? {}
  const blank = (v: any) => !String(v ?? '').trim()
  const warns: string[] = []
  if (b.type === 'article') {
    if (blank(b.heading)) warns.push('Judul pasal kosong')
    if ((b.paragraphs ?? []).some((p: any) => blank(p))) warns.push('Ada uraian kosong')
  } else if (b.type === 'list') {
    if ((b.items ?? []).some((i: any) => blank(i))) warns.push('Ada poin kosong')
  } else if (b.type === 'table') {
    if ((b.rows ?? []).some((r: any) => (b.columns ?? []).some((c: any) => blank(r?.[c.key])))) warns.push('Ada sel kosong')
  } else if (['title', 'subtitle', 'paragraph'].includes(b.type)) {
    if (blank(b.text)) warns.push('Teks masih kosong')
  }
  return warns
})

function removeParagraph(i: number) {
  const arr = props.block.paragraphs ?? []
  if (arr.length <= 1) { arr[0] = ''; return }
  arr.splice(i, 1)
}
function removeListItem(i: number) {
  const arr = props.block.items ?? []
  if (arr.length <= 1) { arr[0] = ''; return }
  arr.splice(i, 1)
}

/**
 * Prefix tampilan tiap poin daftar, mencerminkan hasil di PDF
 * (`listPrefix` di `mitra-layout.engine.ts`): `\u2022` / `1.` / `a.`.
 *
 * Memakai escape `\u2022`, bukan karakter literal, supaya tidak rusak lagi bila
 * berkas disimpan ulang dengan encoding berbeda (pernah terjadi mojibake).
 */
function itemPrefix(index: number): string {
  const style = props.block?.style ?? 'bullet'
  if (style === 'numbered') return `${index + 1}.`
  if (style === 'alphabetic') return `${String.fromCharCode(97 + (index % 26))}.`
  return '\u2022'
}
function removeRow(i: number) {
  const arr = props.block.rows ?? []
  if (arr.length <= 1) return
  arr.splice(i, 1)
}
function addRow() {
  const b = props.block
  const row: Record<string, any> = {}
  for (const c of b.columns ?? []) row[c.key] = ''
  b.rows = [...(b.rows ?? []), row]
}
function removeColumn(i: number) {
  const b = props.block
  if ((b.columns ?? []).length <= 1) return
  const col = b.columns[i]
  b.columns = b.columns.filter((_: any, n: number) => n !== i)
  for (const r of b.rows ?? []) delete r?.[col.key]
}
function addColumn() {
  const b = props.block
  let n = (b.columns ?? []).length + 1
  let key = `kolom${n}`
  const used = new Set((b.columns ?? []).map((c: any) => c.key))
  while (used.has(key)) { n++; key = `kolom${n}` }
  const next = [...(b.columns ?? []), { key, label: `Kolom ${n}`, width: 1, format: 'text' }]
  // Bagi bobot lebar secara merata (2 kolom → 50/50, 3 → ~33 tiap kolom).
  // `width` adalah BOBOT RELATIF yang dinormalisasi renderer, bukan persen
  // mentah — dulu semua kolom memakai 100 sehingga tabel meluber dari halaman.
  const even = Math.round(100 / next.length)
  b.columns = next.map((c: TableColumn) => ({ ...c, width: even }))
  for (const r of b.rows ?? []) r[key] = ''
}
</script>

<template>
  <div
    class="relative rounded-lg border transition"
    :class="[
      selected ? 'border-primary ring-1 ring-primary/30' : 'border-default',
      dragging ? 'opacity-40' : ''
    ]"
    @click="markFocus()"
    @focusin="markFocus()"
  >
    <!-- Garis sisip atas -->
    <div
      v-if="dropIndicator === 'before'"
      class="pointer-events-none absolute inset-x-0 -top-[5px] z-10 flex items-center gap-1"
    >
      <span class="size-2 rounded-full bg-primary" />
      <span class="h-[2px] flex-1 rounded bg-primary" />
    </div>

    <!-- Kepala kartu: identitas blok + aksi. Klik di mana pun pada kepala
         kartu memilih blok ini sebagai target sisipan field. -->
    <div class="flex items-center gap-2 px-3 py-2">
      <!-- Handle drag: hanya aktif pada draft. -->
      <span
        v-if="editable"
        class="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted transition-colors hover:bg-elevated hover:text-highlighted active:cursor-grabbing"
        draggable="true"
        role="button"
        tabindex="-1"
        title="Tarik untuk memindahkan blok"
        aria-label="Tarik untuk memindahkan blok"
        @dragstart="emit('dragstart', $event)"
        @dragend="emit('dragend')"
        @click.stop
      >
        <UIcon name="i-lucide-grip-vertical" class="size-4" />
      </span>
      <UButton
        :icon="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
        size="xs"
        variant="ghost"
        color="neutral"
        :aria-label="collapsed ? 'Buka blok' : 'Tutup blok'"
        @click.stop="emit('update:collapsed', !collapsed)"
      />
      <UIcon :name="meta.icon" class="size-4 shrink-0 text-primary" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="truncate text-sm font-medium">{{ meta.label }}</span>
          <span class="shrink-0 text-xs text-muted">Blok {{ index + 1 }}</span>
          <UBadge
            v-if="emptyWarnings.length"
            color="warning"
            variant="subtle"
            size="sm"
            icon="i-lucide-alert-triangle"
            :label="emptyWarnings[0]"
          />
        </div>
        <p v-if="collapsed" class="truncate text-xs text-muted">
          {{ summary }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-0.5">
        <UTooltip text="Pindah ke atas">
          <UButton
            icon="i-lucide-arrow-up"
            size="xs"
            variant="ghost"
            color="neutral"
            aria-label="Pindah ke atas"
            :disabled="!editable || index === 0"
            @click.stop="emit('move', -1)"
          />
        </UTooltip>
        <UTooltip text="Pindah ke bawah">
          <UButton
            icon="i-lucide-arrow-down"
            size="xs"
            variant="ghost"
            color="neutral"
            aria-label="Pindah ke bawah"
            :disabled="!editable || index === total - 1"
            @click.stop="emit('move', 1)"
          />
        </UTooltip>
        <UTooltip text="Duplikat blok">
          <UButton
            icon="i-lucide-copy"
            size="xs"
            variant="ghost"
            color="neutral"
            aria-label="Duplikat blok"
            :disabled="!editable"
            @click.stop="emit('duplicate')"
          />
        </UTooltip>
        <UTooltip text="Hapus blok">
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="error"
            aria-label="Hapus blok"
            :disabled="!editable"
            @click.stop="emit('remove')"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Isi kartu -->
    <div v-show="!collapsed" class="space-y-2 border-t border-default px-3 py-3">
      <UAlert
        v-if="!editable"
        icon="i-lucide-lock"
        color="neutral"
        variant="subtle"
        title="Hanya baca"
        description="Versi ini sudah dipublish. Buat draft baru untuk mengubah isi."
      />

      <template v-if="['title', 'subtitle', 'paragraph'].includes(block.type)">
        <UFormField :label="block.type === 'paragraph' ? 'Teks paragraf' : 'Teks'">
          <div @click="markBlockOnly()" @focusin="markBlockOnly()">
            <UTextarea
              v-model="block.text"
              :disabled="!editable"
              :rows="3"
              autoresize
              class="w-full"
              placeholder="Tulis teks di sini&#8230;"
            />
          </div>
        </UFormField>
      </template>

      <template v-else-if="block.type === 'article'">
        <UFormField
          label="Judul pasal"
          hint="Maks. 2 baris. Tekan Enter untuk memisah, mis. PASAL 1 / RUANG LINGKUP"
        >
          <UTextarea
            v-model="block.heading"
            :disabled="!editable"
            :rows="2"
            :maxrows="2"
            autoresize
            class="w-full"
            placeholder="PASAL 1&#10;RUANG LINGKUP"
            @keydown.enter="onHeadingKeydown"
          />
        </UFormField>
        <UFormField label="Uraian pasal">
          <div class="space-y-2">
            <div
              v-for="(_, p) in paragraphList"
              :key="p"
              class="flex items-start gap-2"
              @click="markFocus(`art:${p}`)"
              @focusin="markFocus(`art:${p}`)"
            >
              <span class="mt-2 w-5 shrink-0 text-right text-xs text-muted">{{ p + 1 }}.</span>
              <UTextarea
                v-model="block.paragraphs[p]"
                :disabled="!editable"
                :rows="3"
                autoresize
                class="flex-1"
                placeholder="Tulis isi pasal&#8230;"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Hapus paragraf"
                :disabled="!editable"
                @click="removeParagraph(p)"
              />
            </div>
            <UButton
              label="Tambah paragraf"
              icon="i-lucide-plus"
              size="xs"
              variant="soft"
              :disabled="!editable"
              @click="block.paragraphs.push('')"
            />
          </div>
        </UFormField>
      </template>

      <template v-else-if="block.type === 'list'">
        <UFormField label="Gaya penomoran">
          <USelect
            v-model="block.style"
            :disabled="!editable"
            :items="[
              { label: 'Bullet (\u2022)', value: 'bullet' },
              { label: 'Angka (1, 2, 3)', value: 'numbered' },
              { label: 'Huruf (a, b, c)', value: 'alphabetic' }
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Poin daftar">
          <div class="space-y-2">
            <div
              v-for="(_, p) in itemList"
              :key="p"
              class="flex items-center gap-2"
              @click="markFocus(`item:${p}`)"
              @focusin="markFocus(`item:${p}`)"
            >
              <span class="w-5 shrink-0 text-right text-xs text-muted">{{ itemPrefix(p) }}</span>
              <UInput
                v-model="block.items[p]"
                :disabled="!editable"
                class="flex-1"
                placeholder="Isi poin&#8230;"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Hapus poin"
                :disabled="!editable"
                @click="removeListItem(p)"
              />
            </div>
            <UButton
              label="Tambah poin"
              icon="i-lucide-plus"
              size="xs"
              variant="soft"
              :disabled="!editable"
              @click="block.items.push('')"
            />
          </div>
        </UFormField>
      </template>

      <template v-else-if="block.type === 'table'">
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th v-for="(c, ci) in columnList" :key="c.key" class="p-1 align-top">
                  <div class="flex items-center gap-1">
                    <UInput
                      v-model="c.label"
                      :disabled="!editable"
                      class="w-full"
                      placeholder="Judul kolom"
                    />
                    <UButton
                      icon="i-lucide-x"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      aria-label="Hapus kolom"
                      :disabled="!editable || columnList.length <= 1"
                      @click="removeColumn(ci)"
                    />
                  </div>
                </th>
                <th class="w-8" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in rowList" :key="ri">
                <td
                  v-for="(c, ci) in columnList"
                  :key="c.key"
                  class="p-1"
                  @click="markFocus(`row:${ri}:${ci}`)"
                  @focusin="markFocus(`row:${ri}:${ci}`)"
                >
                  <UInput v-model="r[c.key]" :disabled="!editable" placeholder="&#8212;" />
                </td>
                <td class="p-1">
                  <UButton
                    icon="i-lucide-trash-2"
                    size="xs"
                    variant="ghost"
                    color="error"
                    aria-label="Hapus baris"
                    :disabled="!editable || rowList.length <= 1"
                    @click="removeRow(ri)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Tambah baris"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            :disabled="!editable"
            @click="addRow"
          />
          <UButton
            label="Tambah kolom"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            :disabled="!editable"
            @click="addColumn"
          />
        </div>
      </template>

      <template v-else-if="block.type === 'signature'">
        <p class="text-xs text-muted">
          Nama orang (Ketua Koperasi &amp; Mitra/Karyawan) diambil otomatis dari data kontrak.
          Teks di bawah dapat disesuaikan; kosongkan untuk memakai format bawaan.
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Label pilar kiri">
            <UInput v-model="block.leftRole" :disabled="!editable" placeholder="PIHAK PERTAMA" />
          </UFormField>
          <UFormField label="Label pilar kanan">
            <UInput v-model="block.rightRole" :disabled="!editable" placeholder="PIHAK KEDUA" />
          </UFormField>
          <UFormField label="Nama perusahaan/pihak kiri">
            <UInput v-model="block.leftHeader" :disabled="!editable" placeholder="KOPERASI PT. SANKYU INT'L" />
          </UFormField>
          <UFormField label="Nama perusahaan/pihak kanan">
            <UInput v-model="block.rightHeader" :disabled="!editable" placeholder="MITRA" />
          </UFormField>
          <UFormField label="Jabatan kiri">
            <UInput v-model="block.leftParty" :disabled="!editable" placeholder="(Ketua Koperasi)" />
          </UFormField>
          <UFormField label="Jabatan kanan">
            <UInput v-model="block.rightParty" :disabled="!editable" placeholder="(Mitra)" />
          </UFormField>
        </div>
      </template>

      <div v-else-if="block.type === 'pageBreak'" class="rounded-md bg-elevated p-3 text-sm text-muted">
        Blok ini menyisipkan perpindahan halaman pada PDF. Tidak ada yang perlu diisi.
      </div>

      <UAlert
        v-else
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        title="Tipe blok tidak dikenali"
        :description="`Tipe '${block.type}' belum didukung editor. Isinya dipertahankan apa adanya.`"
      />

      <details v-if="editable" class="pt-1">
        <summary class="cursor-pointer text-xs text-muted select-none">
          Detail teknis
        </summary>
        <div class="mt-2 space-y-1 text-xs text-muted">
          <p>ID blok: <code class="rounded bg-elevated px-1">{{ block.id }}</code></p>
          <p>Tipe: <code class="rounded bg-elevated px-1">{{ block.type }}</code></p>
        </div>
      </details>
    </div>

    <!-- Garis sisip bawah -->
    <div
      v-if="dropIndicator === 'after'"
      class="pointer-events-none absolute inset-x-0 -bottom-[5px] z-10 flex items-center gap-1"
    >
      <span class="size-2 rounded-full bg-primary" />
      <span class="h-[2px] flex-1 rounded bg-primary" />
    </div>
  </div>
</template>
