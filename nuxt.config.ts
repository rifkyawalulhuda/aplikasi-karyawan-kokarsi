import { readFileSync } from 'node:fs'

// https://nuxt.com/docs/api/configuration/nuxt-config
const appPackage = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
) as { version?: string }

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt'
  ],

  runtimeConfig: {
    public: {
      appVersion: appPackage.version ?? '1.0.0'
    }
  },

  devtools: {
    enabled: process.env.NODE_ENV !== 'production'
  },

  app: {
    head: {
      title: 'Kokarsi PT. Sankyu',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
      ],
    }
  },

  css: ['~/assets/css/main.css'],

  icon: {
    mode: 'svg',
    // Scan source files agar semua ikon yang dipakai app ikut di-bundle ke client.
    // Tanpa ini ikon di luar bundle hanya di-fetch async → sempat kosong saat refresh
    // (hydration mismatch) sehingga ikon menghilang.
    clientBundle: {
      scan: true,
    },
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
    // Semua upload lewat backend. Selain /uploads/settings, backend menolak tanpa JWT.
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
