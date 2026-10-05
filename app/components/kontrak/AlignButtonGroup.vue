<script setup lang="ts">
/**
 * Grup perataan empat arah untuk blok teks (`paragraph` / `article`).
 *
 * Perilakunya RADIO, bukan toggle:
 * - `align` tidak ada → tombol `defaultAlign` tampak aktif (menunjukkan
 *   perilaku nyata renderer hari ini: paragraph/article default justify,
 *   judul pasal (`headingAlign`) default center).
 * - Klik nilai yang sama dengan `defaultAlign` saat `align` kosong → HAPUS
 *   properti (`emit('update:align', undefined)`) supaya payload draft bersih
 *   dan PDF identik dengan kondisi tanpa `align`.
 * - Klik tombol yang sudah aktif → tidak mengubah apa-apa ("tanpa perataan"
 *   bukan keadaan yang bermakna di sini).
 */
type AlignValue = 'left' | 'center' | 'right' | 'justify'

interface Props {
  align?: AlignValue
  /** Nilai yang tampak aktif saat `align` tidak ada. */
  defaultAlign?: 'justify' | 'left' | 'center'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  align: undefined,
  defaultAlign: 'justify',
  disabled: false
})

const emit = defineEmits<{
  'update:align': [value: AlignValue | undefined]
}>()

const ALIGN_ITEMS: Array<{ value: AlignValue, icon: string, label: string }> = [
  { value: 'left', icon: 'i-lucide-align-left', label: 'Rata kiri' },
  { value: 'center', icon: 'i-lucide-align-center', label: 'Rata tengah' },
  { value: 'right', icon: 'i-lucide-align-right', label: 'Rata kanan' },
  { value: 'justify', icon: 'i-lucide-align-justify', label: 'Rata kiri-kanan' }
]

/** Nilai efektif yang ditampilkan aktif (fallback ke default). */
const current = computed<AlignValue>(() => props.align ?? props.defaultAlign)

function pick(value: AlignValue) {
  if (props.disabled || value === current.value) return
  // Kembali ke perilaku default = hapus properti, bukan menulis nilainya.
  emit('update:align', value === props.defaultAlign ? undefined : value)
}
</script>

<template>
  <div class="flex items-center gap-0.5" role="radiogroup" aria-label="Perataan teks">
    <UTooltip v-for="item in ALIGN_ITEMS" :key="item.value" :text="item.label">
      <UButton
        :icon="item.icon"
        size="xs"
        :variant="current === item.value ? 'soft' : 'ghost'"
        :color="current === item.value ? 'primary' : 'neutral'"
        :disabled="disabled"
        :aria-checked="current === item.value"
        :aria-label="item.label"
        role="radio"
        @click="pick(item.value)"
      />
    </UTooltip>
  </div>
</template>
