import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Kokarsi Docs',
  description: 'Dokumentasi Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu',
  lang: 'id-ID',
  base: '/aplikasi-karyawan-kokarsi/',
  srcDir: 'id',
  lastUpdated: true,
  ignoreDeadLinks: true,

  themeConfig: {
    siteTitle: 'Kokarsi',

    nav: [
      { text: 'Memulai', link: '/memulai/pendahuluan' },
      { text: 'Panduan Pengguna', link: '/panduan-pengguna/login' },
      { text: 'Deployment', link: '/deployment/arsitektur' },
      { text: 'Teknis', link: '/teknis/arsitektur-sistem' },
      { text: 'Referensi', link: '/referensi/peran-akses' },
    ],

    sidebar: {
      '/memulai/': [
        {
          text: 'Memulai',
          items: [
            { text: 'Pendahuluan', link: '/memulai/pendahuluan' },
            { text: 'Prasyarat', link: '/memulai/prasyarat' },
            { text: 'Instalasi & Development', link: '/memulai/instalasi-dev' },
          ],
        },
      ],
      '/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Arsitektur', link: '/deployment/arsitektur' },
            { text: 'Docker (Rekomendasi)', link: '/deployment/docker' },
            { text: 'PostgreSQL Native', link: '/deployment/postgresql-native' },
            { text: 'Cloudflare Tunnel', link: '/deployment/cloudflare-tunnel' },
          ],
        },
      ],
      '/panduan-pengguna/': [
        {
          text: 'Panduan Pengguna',
          items: [
            { text: 'Login & Akun', link: '/panduan-pengguna/login' },
            { text: 'Dashboard', link: '/panduan-pengguna/dashboard' },
            { text: 'Data Karyawan', link: '/panduan-pengguna/data-karyawan' },
            { text: 'Kontrak Karyawan', link: '/panduan-pengguna/kontrak-karyawan' },
            { text: 'Template Kontrak', link: '/panduan-pengguna/template-kontrak' },
            { text: 'Surat Peringatan', link: '/panduan-pengguna/surat-peringatan' },
            { text: 'Dok. Karyawan', link: '/panduan-pengguna/dok-karyawan' },
            { text: 'Sertifikasi & Ijin', link: '/panduan-pengguna/sertifikasi-ijin' },
            { text: 'Kontrak Customer/Vendor', link: '/panduan-pengguna/kontrak-vendor' },
            { text: 'Legal Koperasi', link: '/panduan-pengguna/legal-koperasi' },
            { text: 'Akte Dokumen', link: '/panduan-pengguna/akte-dokumen' },
            { text: 'Kalender', link: '/panduan-pengguna/kalender' },
            { text: 'Space', link: '/panduan-pengguna/space' },
            { text: 'Notifikasi', link: '/panduan-pengguna/notifikasi' },
            { text: 'Pengaturan', link: '/panduan-pengguna/pengaturan' },
            { text: 'Log Aktivitas', link: '/panduan-pengguna/log-aktivitas' },
            { text: 'Email Config', link: '/panduan-pengguna/email-config' },
          ],
        },
      ],
      '/teknis/': [
        {
          text: 'Dokumentasi Teknis',
          items: [
            { text: 'Arsitektur Sistem', link: '/teknis/arsitektur-sistem' },
            { text: 'Arsitektur SSE Space', link: '/teknis/arsitektur-sse-space' },
            { text: 'Database Schema', link: '/teknis/database-schema' },
            { text: 'Database Schema: Kalender & Space', link: '/teknis/database-schema-kalender-space' },
            { text: 'Autentikasi', link: '/teknis/autentikasi' },
            { text: 'Environment Variables', link: '/teknis/environment-variables' },
            { text: 'Notifikasi Email', link: '/teknis/email-notification' },
          ],
        },
      ],
      '/referensi/': [
        {
          text: 'Referensi',
          items: [
            { text: 'Peran & Akses', link: '/referensi/peran-akses' },
            { text: 'Troubleshooting', link: '/referensi/troubleshooting' },
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
      pattern: 'https://github.com/rifkyawalulhuda/aplikasi-karyawan-kokarsi/edit/main/documentation/id/:path',
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
