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
    clientBundle: {
      icons: [
        'lucide:bell',
        'lucide:layout-dashboard',
        'lucide:users',
        'lucide:file-text',
        'lucide:calendar-days',
        'lucide:kanban',
        'lucide:file-badge',
        'lucide:file-signature',
        'lucide:settings',
        'lucide:building-2',
        'lucide:id-card',
        'lucide:scroll-text',
        'lucide:alert-triangle',
        'lucide:user',
        'lucide:chevrons-up-down',
        'lucide:refresh-cw',
        'lucide:more-horizontal',
        'lucide:calendar',
        'lucide:message-circle',
        'lucide:columns-2',
        'lucide:chevron-left',
        'lucide:chevron-right',
        'lucide:plus',
        'lucide:loader-circle',
        'lucide:layout-kanban',
        'lucide:pencil',
        'lucide:trash-2',
        'lucide:x',
        'lucide:link',
        'lucide:file',
        'lucide:paperclip',
        'lucide:check-square',
        'lucide:align-left',
        'lucide:map-pin',
        'lucide:clock',
        'lucide:arrow-up-right',
        'lucide:arrow-up',
        'lucide:arrow-down',
        'lucide:minus',
        'lucide:alert-circle',
      ],
      scan: true,
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
