// PM2 Ecosystem Config — Kokarsi PT. Sankyu
// Usage:
//   pm2 start ecosystem.config.cjs          — start semua
//   pm2 stop ecosystem.config.cjs           — stop semua
//   pm2 restart ecosystem.config.cjs        — restart semua
//   pm2 logs                                — lihat logs semua proses
//   pm2 monit                               — monitor realtime

const path = require('path')

// ROOT otomatis mengikuti lokasi file ini — tidak hardcode path mesin tertentu
const ROOT = path.resolve(__dirname)
const BACKEND = path.join(ROOT, 'backend')
const LOGS = path.join(ROOT, 'logs')

module.exports = {
  apps: [
    {
      name: 'kokarsi-backend',
      script: 'dist/main.js',
      cwd: BACKEND,
      env: {
        NODE_ENV: 'production',
      },
      // backend membaca .env sendiri via dotenv/config di dist/main.js
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '5s',
      out_file: path.join(LOGS, 'backend-out.log'),
      error_file: path.join(LOGS, 'backend-err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'kokarsi-frontend',
      script: '.output/server/index.mjs',
      cwd: ROOT,
      // inject semua dari .env root — fix utama agar tidak crash karena missing env
      env_file: path.join(ROOT, '.env'),
      env: {
        NODE_ENV: 'production',
      },
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '5s',
      out_file: path.join(LOGS, 'frontend-out.log'),
      error_file: path.join(LOGS, 'frontend-err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
