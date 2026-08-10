<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

// Favicon mengikuti logo organisasi yang dipakai di Pengaturan (jika ada)
const { logoUrl, refresh: refreshAppSettings } = useAppSettings()

// Refetch settings setelah login (SPA tanpa reload) agar logo/favicon ter-update
watch(
  () => useAuthStore().isLoggedIn,
  (loggedIn) => {
    if (loggedIn) refreshAppSettings()
  },
  { immediate: true }
)

const favicon = computed(() => {
  if (logoUrl.value) return logoUrl.value
  return '/favicon.ico'
})

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    () => ({ rel: 'icon', href: favicon.value }),
    () => ({ rel: 'shortcut icon', href: favicon.value }),
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Kokarsi PT. Sankyu'
const description = 'Sistem Informasi Karyawan Koperasi PT. Sankyu'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
