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
      cors: {
        origin: process.env.NUXT_ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }
    },
    // Serve local uploads from public/uploads
    '/uploads/documents/**': {
      // Local files served from public folder automatically
    },
    // Proxy other uploads to backend
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
