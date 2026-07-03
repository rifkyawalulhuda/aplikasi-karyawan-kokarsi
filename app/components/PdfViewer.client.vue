<script setup lang="ts">
const props = defineProps<{
  src: string
}>()

const container = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const errorMsg = ref('')
let renderToken = 0

async function renderPdf(url: string) {
  const token = ++renderToken
  loading.value = true
  errorMsg.value = ''

  if (container.value) {
    container.value.innerHTML = ''
  }

  if (!url) {
    loading.value = false
    return
  }

  try {
    // Dynamic import so pdfjs never runs during SSR
    const pdfjsLib = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

    // Fetch PDF bytes with credentials (cookie auth)
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
      throw new Error(`Gagal memuat PDF (${res.status})`)
    }
    const data = new Uint8Array(await res.arrayBuffer())

    if (token !== renderToken) return

    const pdf = await pdfjsLib.getDocument({ data }).promise

    if (token !== renderToken) return

    const target = container.value
    if (!target) return

    const baseWidth = target.clientWidth || 794
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (token !== renderToken) return

      const page = await pdf.getPage(pageNum)
      const unscaled = page.getViewport({ scale: 1 })
      const scale = baseWidth / unscaled.width
      const viewport = page.getViewport({ scale: scale * dpr })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.style.display = 'block'
      canvas.style.marginBottom = '12px'
      canvas.style.borderRadius = '8px'
      canvas.style.boxShadow = '0 1px 6px rgba(15,23,42,0.12)'

      await page.render({ canvas, viewport } as any).promise

      if (token !== renderToken) return
      target.appendChild(canvas)
    }

    loading.value = false
  } catch (e: any) {
    if (token !== renderToken) return
    errorMsg.value = e?.message ?? 'Gagal menampilkan dokumen PDF'
    loading.value = false
  }
}

watch(() => props.src, (url) => {
  renderPdf(url)
})

onMounted(() => {
  renderPdf(props.src)
})

onBeforeUnmount(() => {
  renderToken++
})
</script>

<template>
  <div class="relative h-full w-full overflow-auto">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-muted animate-spin" />
    </div>
    <div v-if="errorMsg" class="flex h-full items-center justify-center p-6 text-center text-sm text-error">
      {{ errorMsg }}
    </div>
    <div ref="container" class="mx-auto w-full max-w-[794px]" />
  </div>
</template>
