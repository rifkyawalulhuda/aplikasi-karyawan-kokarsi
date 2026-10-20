<script setup lang="ts">
import { effectiveGridLines } from '~/utils/field-spacing'

/**
 * Kontrol spasi untuk satu blok. Dua mode, satu komponen:
 *
 * - `mode="block"` (default) → `block.spaceAfter`: jarak TAMBAHAN di bawah blok,
 *   di atas jarak bawaan renderer. Dipakai semua blok konten.
 * - `mode="field"` → `block.fieldSpacing`: jarak TAMBAHAN ANTAR field di dalam
 *   satu blok (judul↔uraian, uraian↔uraian, poin↔poin, baris↔baris, baris
 *   penutup↔baris penutup).
 *
 * Keduanya ADITIF dan memakai preset yang sama supaya kosakatanya konsisten:
 * - nilai kosong → tombol "Normal" tampak aktif (perilaku bawaan);
 * - memilih "Normal" → HAPUS properti (`emit('update:spaceAfter', undefined)`)
 *   supaya payload draft bersih dan PDF identik dengan kondisi tanpa properti;
 * - preset lain menulis angka; "Kustom…" membuka input angka 0–`max`.
 *
 * Satuan pt, nilai sah bilangan bulat 0–`max` (batas sama dengan validator
 * backend `MAX_BLOCK_SPACE_AFTER` / `MAX_FIELD_SPACING`).
 *
 * `gridPitch` (opsional) membuat kontrol menampilkan HASIL EFEKTIF di MITRA:
 * jarak dibulatkan KE ATAS ke kelipatan grid, sehingga 6 pt benar-benar tercetak
 * 15.8 pt (1 baris). Tanpa keterangan itu admin mengira nilainya diabaikan.
 */
interface Props {
  spaceAfter?: number
  disabled?: boolean
  /** Batas atas nilai kustom (pt) — harus sama dengan batas validator backend. */
  max?: number
  mode?: 'block' | 'field'
  /**
   * Pitch baris grid MITRA (pt). Bila diisi, nilai ditampilkan sebagai hasil
   * efektif ("1 baris · 15.8 pt"). Kosongkan untuk blok yang TIDAK di-grid
   * (tabel, penutup).
   */
  gridPitch?: number
}

const props = withDefaults(defineProps<Props>(), {
  spaceAfter: undefined,
  disabled: false,
  max: 40,
  mode: 'block',
  gridPitch: undefined
})

const emit = defineEmits<{
  'update:spaceAfter': [value: number | undefined]
}>()

/** Preset: `value === undefined` = kembali ke jarak bawaan. */
const PRESETS: Array<{ label: string, value: number | undefined, hint: string }> = [
  { label: 'Rapat', value: 0, hint: 'Tanpa jarak tambahan' },
  { label: 'Normal', value: undefined, hint: 'Jarak bawaan dokumen' },
  { label: 'Renggang', value: 12, hint: 'Tambah 12 pt' },
  { label: 'Ekstra', value: 20, hint: 'Tambah 20 pt' }
]

/** Nilai efektif: `undefined` (bawaan) bila tidak diset. */
const current = computed<number | undefined>(() => props.spaceAfter ?? undefined)

/** Apakah nilai saat ini sebuah preset? Bila bukan, berarti "Kustom". */
const isCustom = computed(() =>
  current.value !== undefined && !PRESETS.some(p => p.value === current.value)
)

/**
 * Hasil efektif untuk MITRA: jarak dibulatkan KE ATAS ke kelipatan `gridPitch`.
 * `null` = tidak ada pembulatan yang perlu ditampilkan (mode blok tanpa grid,
 * nilai kosong, atau nilai 0).
 */
const effective = computed<{ lines: number, pt: number } | null>(() => {
  const lines = effectiveGridLines(current.value, props.gridPitch)
  if (lines === null) return null
  return { lines, pt: lines * (props.gridPitch as number) }
})

const customOpen = ref(false)
const customInput = ref<number>(12)

function pick(value: number | undefined) {
  if (props.disabled) return
  customOpen.value = false
  if (current.value === value) return
  emit('update:spaceAfter', value)
}

function toggleCustom() {
  if (props.disabled) return
  customOpen.value = !customOpen.value
  if (customOpen.value) customInput.value = isCustom.value ? (current.value as number) : 12
}

/** Terapkan nilai input kustom: bulatkan + jepit ke rentang 0–max. */
function applyCustom() {
  const raw = Number(customInput.value)
  if (!Number.isFinite(raw)) {
    emit('update:spaceAfter', undefined)
    return
  }
  const clamped = Math.max(0, Math.min(props.max, Math.round(raw)))
  customInput.value = clamped
  emit('update:spaceAfter', clamped)
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1"
    role="group"
    :aria-label="mode === 'field' ? 'Spasi antar isi' : 'Spasi antar blok'"
  >
    <UButton
      v-for="preset in PRESETS"
      :key="preset.label"
      size="xs"
      :variant="current === preset.value ? 'soft' : 'ghost'"
      :color="current === preset.value ? 'primary' : 'neutral'"
      :disabled="disabled"
      :aria-pressed="current === preset.value"
      :title="preset.hint"
      @click="pick(preset.value)"
    >
      {{ preset.label }}
    </UButton>
    <UButton
      size="xs"
      :variant="isCustom ? 'soft' : 'ghost'"
      :color="isCustom ? 'primary' : 'neutral'"
      :disabled="disabled"
      :aria-pressed="isCustom"
      title="Atur jarak sendiri (pt)"
      @click="toggleCustom"
    >
      {{ isCustom ? `${current} pt` : 'Kustom' }}
    </UButton>
    <UInput
      v-if="customOpen"
      v-model.number="customInput"
      type="number"
      :min="0"
      :max="max"
      size="xs"
      class="w-20"
      :disabled="disabled"
      aria-label="Jarak kustom (pt)"
      @change="applyCustom"
    />
    <span v-if="customOpen" class="text-xs text-muted">pt</span>
    <span
      v-if="effective"
      class="text-xs text-muted"
      :title="`Jarak ${current} pt dibulatkan ke atas ke grid ${gridPitch} pt`"
    >
      · {{ effective.lines }} baris ({{ effective.pt.toFixed(1) }} pt)
    </span>
  </div>
</template>
