<script setup lang="ts">
/**
 * Daftar dokumen kini hidup di tab "Docs" dalam halaman Space
 * (`/spaces/[id]?view=docs`) — satu sumber UI, tidak diduplikasi.
 * Halaman ini hanya meneruskan agar link lama tetap berfungsi.
 */
definePageMeta({ layout: 'default' })

const route = useRoute()
const spaceId = computed(() => Number(route.params.id))

onMounted(() => {
  navigateTo(`/spaces/${spaceId.value}?view=docs`, { replace: true })
})
</script>

<template>
  <div class="flex h-64 items-center justify-center">
    <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
  </div>
</template>
