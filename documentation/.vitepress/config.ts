import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Kokarsi Docs',
  description: 'Dokumentasi Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu',
  lang: 'id-ID',
  base: '/aplikasi-karyawan-kokarsi/',
  lastUpdated: true,
  ignoreDeadLinks: true,

  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: 'Kokarsi' },
    siteTitle: 'Kokarsi Docs',

    nav: [
      { text: 'Memulai', link: '/id/memulai/pendahuluan' },
      { text: 'Panduan Pengguna', link: '/id/panduan-pengguna/login' },
      { text: 'Deployment', link: '/id/deployment/arsitektur' },
      { text: 'Teknis', link: '/id/teknis/arsitektur-sistem' },
      { text: 'Referensi', link: '/id/referensi/peran-akses' },
    ],

    sidebar: {
      '/id/memulai/': [
        {
          text: 'Memulai',
          items: [
            { text: 'Pendahuluan', link: '/id/memulai/pendahuluan' },
            { text: 'Prasyarat', link: '/id/memulai/prasyarat' },
            { text: 'Instalasi & Development', link: '/id/memulai/instalasi-dev' },
          ],
        },
      ],
      '/id/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Arsitektur', link: '/id/deployment/arsitektur' },
            { text: 'Docker (Rekomendasi)', link: '/id/deployment/docker' },
            { text: 'PostgreSQL Native', link: '/id/deployment/postgresql-native' },
            { text: 'Cloudflare Tunnel', link: '/id/deployment/cloudflare-tunnel' },
          ],
        },
      ],
      '/id/panduan-pengguna/': [
        {
          text: 'Panduan Pengguna',
          items: [
            { text: 'Login & Akun', link: '/id/panduan-pengguna/login' },
            { text: 'Dashboard', link: '/id/panduan-pengguna/dashboard' },
            { text: 'Data Karyawan', link: '/id/panduan-pengguna/data-karyawan' },
            { text: 'Kontrak Karyawan', link: '/id/panduan-pengguna/kontrak-karyawan' },
            { text: 'Surat Peringatan', link: '/id/panduan-pengguna/surat-peringatan' },
            { text: 'Sertifikasi & Ijin', link: '/id/panduan-pengguna/sertifikasi-ijin' },
            { text: 'Kontrak Customer/Vendor', link: '/id/panduan-pengguna/kontrak-vendor' },
            { text: 'Legal Koperasi', link: '/id/panduan-pengguna/legal-koperasi' },
            { text: 'Akte Dokumen', link: '/id/panduan-pengguna/akte-dokumen' },
            { text: 'Notifikasi', link: '/id/panduan-pengguna/notifikasi' },
            { text: 'Pengaturan', link: '/id/panduan-pengguna/pengaturan' },
          ],
        },
      ],
      '/id/teknis/': [
        {
          text: 'Dokumentasi Teknis',
          items: [
            { text: 'Arsitektur Sistem', link: '/id/teknis/arsitektur-sistem' },
            { text: 'Database Schema', link: '/id/teknis/database-schema' },
            { text: 'Autentikasi', link: '/id/teknis/autentikasi' },
            { text: 'Environment Variables', link: '/id/teknis/environment-variables' },
          ],
        },
      ],
      '/id/referensi/': [
        {
          text: 'Referensi',
          items: [
            { text: 'Peran & Akses', link: '/id/referensi/peran-akses' },
            { text: 'Troubleshooting', link: '/id/referensi/troubleshooting' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/rifkyawalulhuda/aplikasi-karyawan-kokarsi' },
    ],

    footer: {
      message: 'Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu',
      copyright: '© 2026 AnNahl Web Media. All rights reserved.',
    },

    editLink: {
      pattern: 'https://github.com/rifkyawalulhuda/aplikasi-karyawan-kokarsi/edit/main/documentation/:path',
      text: 'Edit halaman ini di GitHub',
    },

    lastUpdated: {
      text: 'Terakhir diperbarui',
      formatOptions: {
        dateStyle: 'medium',
      },
    },

    docFooter: {
      prev: 'Halaman sebelumnya',
      next: 'Halaman berikutnya',
    },

    outline: {
      label: 'Di halaman ini',
    },

    returnToTopLabel: 'Kembali ke atas',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Ganti ke tema terang',
    darkModeSwitchTitle: 'Ganti ke tema gelap',
  },

  head: [
    ['link', { rel: 'icon', href: '/aplikasi-karyawan-kokarsi/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#2563eb' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'id_ID' }],
    ['meta', { property: 'og:title', content: 'Kokarsi Docs' }],
    ['meta', { property: 'og:description', content: 'Dokumentasi Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu' }],
  ],
})
