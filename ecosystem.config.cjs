// PM2 Ecosystem Config — Kokarsi PT. Sankyu
// Usage:
//   pm2 start ecosystem.config.cjs          — start semua
//   pm2 stop ecosystem.config.cjs           — stop semua
//   pm2 restart ecosystem.config.cjs        — restart semua
//   pm2 logs                                — lihat logs semua proses
//   pm2 monit                               — monitor realtime

module.exports = {
  apps: [
    {
      name: 'kokarsi-backend',
      script: 'dist/main.js',
      cwd: 'E:/Github/aplikasi-karyawan-kokarsi/backend',
      env: {
        NODE_ENV: 'production',
      },
      // backend membaca .env sendiri via dotenv/config di dist/main.js
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '5s',
      out_file: 'E:/Github/aplikasi-karyawan-kokarsi/logs/backend-out.log',
      error_file: 'E:/Github/aplikasi-karyawan-kokarsi/logs/backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'kokarsi-frontend',
      script: '.output/server/index.mjs',
      cwd: 'E:/Github/aplikasi-karyawan-kokarsi',
      // inject semua dari .env root — fix utama agar tidak crash karena missing env
      env_file: 'E:/Github/aplikasi-karyawan-kokarsi/.env',
      env: {
        NODE_ENV: 'production',
      },
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '5s',
      out_file: 'E:/Github/aplikasi-karyawan-kokarsi/logs/frontend-out.log',
      error_file: 'E:/Github/aplikasi-karyawan-kokarsi/logs/frontend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
