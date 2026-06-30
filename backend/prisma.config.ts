import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: 'postgresql://postgres:***@localhost:5434/kokarsi_karyawan',
  },
})
