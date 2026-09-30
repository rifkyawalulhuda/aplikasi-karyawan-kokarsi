<script setup lang="ts">
/**
 * Render blok konten (title, paragraph, article, list, table, pageBreak,
 * signature) dengan gaya yang sama seperti renderer PDF aktual.
 * Dipakai di dalam `KontrakDocumentPreview`.
 */
interface Props {
  block: any
  values: Record<string, string>
}
const props = defineProps<Props>()

/** Placeholder tanpa nilai dibiarkan terlihat (fail-visible) seperti renderer PDF. */
function text(value: any): string {
  return String(value ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m: string, key: string) => props.values?.[key] ?? `«${key}»`)
}

const listStyle = computed(() => {
  const style = props.block?.style
  if (style === 'bullet') return 'list-disc pl-4'
  if (style === 'alphabetic') return 'list-[lower-alpha] pl-4'
  return 'list-decimal pl-4'
})
</script>

<template>
  <template v-if="block.type==='title'||block.type==='subtitle'" />
  <p v-else-if="block.type==='paragraph'" class="whitespace-pre-wrap">
    {{ text(block.text) }}
  </p>
  <template v-else-if="block.type==='article'">
    <p v-if="block.heading" class="pt-[5px] text-[9px] font-bold">
      {{ text(block.heading) }}
    </p>
    <p v-for="(p, n) in block.paragraphs" :key="n" class="whitespace-pre-wrap">
      {{ text(p) }}
    </p>
  </template>
  <ul v-else-if="block.type==='list'" :class="listStyle">
    <li v-for="(it, n) in block.items" :key="n">
      {{ text(it) }}
    </li>
  </ul>
  <table v-else-if="block.type==='table'" class="my-1.5 w-full border-collapse text-[8px]">
    <thead v-if="block.header!==false">
      <tr>
        <th
          v-for="c in block.columns"
          :key="c.key"
          class="border border-black px-1 py-0.5 text-center font-bold"
        >
          {{ text(c.label) }}
        </th>
      </tr>
    </thead><tbody>
      <tr v-for="(r, n) in block.rows" :key="n">
        <td
          v-for="c in block.columns"
          :key="c.key"
          class="border border-black px-1 py-0.5"
          :class="c.align==='right'?'text-right':(c.align==='center'?'text-center':'')"
        >
          {{ text(r[c.key]) }}
        </td>
      </tr>
    </tbody>
  </table>
  <div
    v-else-if="block.type==='pageBreak'"
    class="my-4 border-t border-dashed border-gray-400 pt-1 text-center text-[8px] uppercase tracking-widest text-gray-500"
  >
    — Batas halaman —
  </div>
  <div v-else-if="block.type==='signature'" class="mt-6 w-full">
    <p class="mb-2 text-[8.5px]">
      Pada hari ini, ____________________, yang bertanda tangan di bawah ini :
    </p>
    <div class="grid grid-cols-2 gap-4 text-center text-[9px]">
      <div>
        <p class="font-bold">
          {{ text(block.leftRole) }}
        </p>
        <div class="h-12" />
        <p class="border-b border-black font-bold">
          {{ values['employee.fullName'] }}
        </p>
        <p class="text-[8px]">
          KARYAWAN
        </p>
      </div>
      <div>
        <p class="font-bold">
          {{ text(block.rightRole) }}
        </p>
        <div class="h-12" />
        <p class="border-b border-black font-bold">
          {{ values['coop.chairmanName'] }}
        </p>
        <p class="text-[8px]">
          KETUA KOPERASI
        </p>
      </div>
    </div>
  </div>
</template>
