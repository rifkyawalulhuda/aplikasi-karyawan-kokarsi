<script setup lang="ts">
/**
 * Preview dokumen kontrak yang meniru layout PDF aktual
 * (`backend/src/contracts/contract-document.service.ts`):
 *  - Kop surat perusahaan (hanya sekali, sebelum batas halaman pertama)
 *  - Title block terpusat (judul + subjudul + nomor kontrak)
 *  - Font Times New Roman, body justify, ukuran ~9.5pt
 *  - Tanda tangan dua pilar (KARYAWAN / KETUA KOPERASI) dengan garis nama
 * Layout PDF asli tetap milik renderer; komponen ini hanya visual editor.
 */
interface Props {
  blocks: any[]
  values: Record<string, string>
  title?: string
  subtitle?: string
  contractNo?: string
  compact?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  contractNo: '',
  compact: false
})

/** Kop surat hanya dirender sekali, yaitu sebelum blok pageBreak pertama. */
const showHeader = computed(() => !(props.blocks ?? []).some(b => b?.type === 'pageBreak'))

/** Placeholder tanpa nilai dibiarkan terlihat (fail-visible) seperti renderer PDF. */
function text(value: any): string {
  return String(value ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m: string, key: string) => props.values?.[key] ?? `«${key}»`)
}

const bodyClass = computed(() => props.compact
  ? 'space-y-[3px] text-justify text-[8px] leading-[1.4]'
  : 'space-y-[4px] text-justify text-[8.5px] leading-[1.45]')
</script>

<template>
  <div class="mx-auto w-full bg-white text-black shadow-md">
    <div class="px-[8.5%] py-[6%] font-serif">
      <div
        v-if="showHeader"
        class="mb-1 flex items-start gap-3 border-b-[3px] border-double border-black pb-2"
      >
        <div class="w-14 shrink-0 rounded border border-dashed border-gray-400 py-6 text-center text-[8px] leading-tight text-gray-500">
          LOGO
        </div>
        <div class="flex-1 text-center leading-tight">
          <p class="text-[13px] font-bold">
            KOPERASI KARYAWAN
          </p>
          <p class="text-[13px] font-bold">
            PT. SANKYU INDONESIA INTERNASIONAL
          </p>
          <p class="text-[13px] font-bold">
            UNIT KANTOR PUSAT
          </p>
          <p class="mt-1 text-[9px]">
            Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20
          </p>
          <p class="text-[9px]">
            GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330
          </p>
          <p class="text-[9px]">
            TELP. 021 - 50555340, FAX. 021- 50555341
          </p>
        </div>
      </div>
      <div v-if="title" class="mx-auto my-4 max-w-[75%] text-center">
        <p class="text-[12px] font-bold uppercase">
          {{ text(title) }}
        </p>
        <p v-if="subtitle" class="text-[9px] uppercase">
          {{ text(subtitle) }}
        </p>
        <p v-if="contractNo" class="mt-1 text-[10px] font-bold">
          No. : {{ contractNo }}
        </p>
      </div>
      <div :class="bodyClass">
        <template v-for="b in blocks" :key="`pv-${b.id}`">
          <KontrakDocumentPreviewBlock :block="b" :values="values" />
        </template>
      </div>
    </div>
  </div>
</template>
