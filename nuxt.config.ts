// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt'
  ],

  devtools: {
    enabled: true
  },

  app: {
    head: {
      title: 'Kokarsi PT. Sankyu'
    }
  },

  css: ['~/assets/css/main.css'],

  icon: {
    mode: 'svg',
    serverBundle: {
      collections: ['lucide', 'simple-icons']
    },
  },

  routeRules: {
    '/api/**': {
      // @ts-expect-error Nitro routeRules cors accepts object at runtime, but types only declare boolean
      cors: {
        origin: process.env.NUXT_ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }
    },
    // Proxy semua upload ke backend (termasuk gambar dokumen disimpan di backend/uploads/documents/**)
    '/uploads/**': {
      proxy: 'http://localhost:3001/uploads/**'
    }
  },

  compatibilityDate: '2024-07-11',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
