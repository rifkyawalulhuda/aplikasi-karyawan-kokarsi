import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcrypt'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) throw new Error('DATABASE_URL tidak ditemukan di .env')

const pool = new Pool({ connectionString: DB_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('Seeding database...')

  const workLocations = await Promise.all([
    prisma.workLocation.upsert({ where: { id: 1 }, update: {}, create: { name: 'Head Office Jakarta' } }),
    prisma.workLocation.upsert({ where: { id: 2 }, update: {}, create: { name: 'Warehouse Cikarang' } }),
    prisma.workLocation.upsert({ where: { id: 3 }, update: {}, create: { name: 'Port Tanjung Priok' } }),
  ])

  const jobRoles = await Promise.all([
    prisma.jobRole.upsert({ where: { id: 1 }, update: {}, create: { name: 'Staff Administrasi' } }),
    prisma.jobRole.upsert({ where: { id: 2 }, update: {}, create: { name: 'Operator Forklift' } }),
    prisma.jobRole.upsert({ where: { id: 3 }, update: {}, create: { name: 'Supervisor Gudang' } }),
    prisma.jobRole.upsert({ where: { id: 4 }, update: {}, create: { name: 'Teknisi Mesin' } }),
  ])

  const jobLevels = await Promise.all([
    prisma.jobLevel.upsert({ where: { id: 1 }, update: {}, create: { name: 'Staff' } }),
    prisma.jobLevel.upsert({ where: { id: 2 }, update: {}, create: { name: 'Senior Staff' } }),
    prisma.jobLevel.upsert({ where: { id: 3 }, update: {}, create: { name: 'Supervisor' } }),
    prisma.jobLevel.upsert({ where: { id: 4 }, update: {}, create: { name: 'Manager' } }),
  ])

  const taxStatuses = await Promise.all([
    prisma.taxStatus.upsert({ where: { id: 1 }, update: {}, create: { name: 'TK/0' } }),
    prisma.taxStatus.upsert({ where: { id: 2 }, update: {}, create: { name: 'TK/1' } }),
    prisma.taxStatus.upsert({ where: { id: 3 }, update: {}, create: { name: 'K/0' } }),
    prisma.taxStatus.upsert({ where: { id: 4 }, update: {}, create: { name: 'K/1' } }),
    prisma.taxStatus.upsert({ where: { id: 5 }, update: {}, create: { name: 'K/2' } }),
  ])

  console.log('Lookup data seeded:', {
    workLocations: workLocations.length,
    jobRoles: jobRoles.length,
    jobLevels: jobLevels.length,
    taxStatuses: taxStatuses.length,
  })

  const employee = await prisma.employee.upsert({
    where: { employeeNo: 'EMP001' },
    update: {},
    create: {
      employeeNo: 'EMP001',
      fullName: 'Budi Santoso',
      employmentStatus: 'KONTRAK',
      gender: 'MALE',
      birthDate: new Date('1990-05-15'),
      joinDate: new Date('2022-01-01'),
      email: 'budi.santoso@sankyu.co.id',
      phoneNumber: '081234567890',
      educationLevel: 'S1',
      workLocationId: workLocations[0].id,
      jobRoleId: jobRoles[0].id,
      jobLevelId: jobLevels[0].id,
      taxStatusId: taxStatuses[2].id,
    },
  })

  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.masterAdmin.upsert({
    where: { employeeNo: 'EMP001' },
    update: {},
    create: {
      employeeNo: employee.employeeNo,
      fullName: 'Admin Kokarsi',
      password: hashedPassword,
    },
  })

  await prisma.contract.upsert({
    where: { contractNo: 'KTR/2024/001' },
    update: {},
    create: {
      employeeId: employee.id,
      contractNo: 'KTR/2024/001',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'),
      contractType: 'PKWT',
      status: 'AKTIF',
    },
  })

  console.log('Seed selesai!')
  console.log('Login: employeeNo=EMP001, password=admin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
