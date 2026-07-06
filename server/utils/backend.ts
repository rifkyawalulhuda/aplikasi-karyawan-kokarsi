export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001/api'
export const BACKEND_ROOT = process.env.BACKEND_ROOT ?? 'http://localhost:3001'

// Alias untuk Nitro auto-import — digunakan di semua server/api/ tanpa perlu import eksplisit
export const BACKEND = BACKEND_URL
