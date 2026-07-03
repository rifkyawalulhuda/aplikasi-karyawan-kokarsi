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
    prisma.jobRole.upsert({ where: { id: 5 }, update: {}, create: { name: 'Driver' } }),
    prisma.jobRole.upsert({ where: { id: 6 }, update: {}, create: { name: 'Kasir' } }),
    prisma.jobRole.upsert({ where: { id: 7 }, update: {}, create: { name: 'Karyawan Gudang' } }),
    prisma.jobRole.upsert({ where: { id: 8 }, update: {}, create: { name: 'Staff Admin' } }),
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

  const contractTypes = await Promise.all([
    prisma.contractType.upsert({ where: { name: 'PKWT' }, update: {}, create: { name: 'PKWT' } }),
    prisma.contractType.upsert({ where: { name: 'MITRA' }, update: {}, create: { name: 'MITRA' } }),
    prisma.contractType.upsert({ where: { name: 'PKWTT' }, update: {}, create: { name: 'PKWTT' } }),
    prisma.contractType.upsert({ where: { name: 'Magang' }, update: {}, create: { name: 'Magang' } }),
  ])

  const departments = await Promise.all([
    prisma.department.upsert({ where: { name: 'Operasional' }, update: {}, create: { name: 'Operasional' } }),
    prisma.department.upsert({ where: { name: 'Administrasi' }, update: {}, create: { name: 'Administrasi' } }),
    prisma.department.upsert({ where: { name: 'Human Capital' }, update: {}, create: { name: 'Human Capital' } }),
  ])

  console.log('Lookup data seeded:', {
    workLocations: workLocations.length,
    jobRoles: jobRoles.length,
    jobLevels: jobLevels.length,
    taxStatuses: taxStatuses.length,
    contractTypes: contractTypes.length,
    departments: departments.length,
  })

  const employee = await prisma.employee.upsert({
    where: { employeeNo: 'EMP001' },
    update: {},
    create: {
      employeeNo: 'EMP001',
      fullName: 'Budi Santoso',
      nik: '3275011505900001',
      birthPlace: 'Bekasi',
      address: 'Jl. Melati No. 10, Cikarang, Bekasi',
      employmentStatus: 'AKTIF',
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
      departmentId: departments[0].id,
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
      role: 'ADMIN',
    },
  })

  await prisma.userAccount.deleteMany({
    where: {
      OR: [
        { username: 'admin.kokarsi' },
        { nik: 'SKY-ADM-001' },
        { email: 'admin@kokarsi-sankyu.co.id' },
        { username: 'pengelola1' },
        { nik: 'SKY-PEL-001' },
        { email: 'rina.permata@sankyu.co.id' },
      ],
    },
  })

  const adminUserPassword = await bcrypt.hash('admin123', 10)
  await prisma.userAccount.create({
    data: {
      name: 'Admin Kokarsi',
      nik: 'SKY-ADM-001',
      email: 'admin@kokarsi-sankyu.co.id',
      role: 'ADMIN',
      username: 'admin.kokarsi',
      password: adminUserPassword,
    },
  })

  const pengelolaPassword = await bcrypt.hash('pengelola123', 10)
  await prisma.userAccount.create({
    data: {
      name: 'Rina Permata',
      nik: 'SKY-PEL-001',
      email: 'rina.permata@sankyu.co.id',
      role: 'PENGELOLA_KOPERASI',
      username: 'pengelola1',
      password: pengelolaPassword,
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
      contractTypeId: contractTypes[0].id,
      status: 'AKTIF',
      signedDate: new Date('2024-01-01'),
      positionLabel: 'Staff Admin',
      workLocationLabel: 'Head Office Jakarta',
      baseCompensation: 5941759,
    },
  })

  const templateSeeds = [
    {
      code: 'MITRA_DRIVER',
      name: 'Mitra Driver',
      family: 'MITRA' as const,
      templateKey: 'MITRA_DRIVER',
      contractTypeId: contractTypes.find(item => item.name === 'MITRA')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Driver')?.id,
    },
    {
      code: 'MITRA_KOMART',
      name: 'Mitra Kasir Komart',
      family: 'MITRA' as const,
      templateKey: 'MITRA_KOMART',
      contractTypeId: contractTypes.find(item => item.name === 'MITRA')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Kasir')?.id,
    },
    {
      code: 'MITRA_STAFF',
      name: 'Mitra Staff Admin',
      family: 'MITRA' as const,
      templateKey: 'MITRA_STAFF',
      contractTypeId: contractTypes.find(item => item.name === 'MITRA')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Staff Admin')?.id,
    },
    {
      code: 'MITRA_WAREHOUSE',
      name: 'Mitra Warehouse',
      family: 'MITRA' as const,
      templateKey: 'MITRA_WAREHOUSE',
      contractTypeId: contractTypes.find(item => item.name === 'MITRA')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Karyawan Gudang')?.id,
    },
    {
      code: 'PKWT_DRIVER',
      name: 'PKWT Driver',
      family: 'PKWT' as const,
      templateKey: 'PKWT_DRIVER',
      contractTypeId: contractTypes.find(item => item.name === 'PKWT')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Driver')?.id,
    },
    {
      code: 'PKWT_KASIR',
      name: 'PKWT Kasir',
      family: 'PKWT' as const,
      templateKey: 'PKWT_KASIR',
      contractTypeId: contractTypes.find(item => item.name === 'PKWT')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Kasir')?.id,
    },
    {
      code: 'PKWT_STAFF',
      name: 'PKWT Staff Admin',
      family: 'PKWT' as const,
      templateKey: 'PKWT_STAFF',
      contractTypeId: contractTypes.find(item => item.name === 'PKWT')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Staff Admin')?.id,
    },
    {
      code: 'PKWT_WAREHOUSE',
      name: 'PKWT Warehouse',
      family: 'PKWT' as const,
      templateKey: 'PKWT_WAREHOUSE',
      contractTypeId: contractTypes.find(item => item.name === 'PKWT')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Karyawan Gudang')?.id,
    },
  ]

  for (const templateSeed of templateSeeds) {
    await prisma.contractTemplate.upsert({
      where: { code: templateSeed.code },
      update: {
        name: templateSeed.name,
        family: templateSeed.family,
        templateKey: templateSeed.templateKey,
        contractTypeId: templateSeed.contractTypeId,
        jobRoleId: templateSeed.jobRoleId,
        isActive: true,
      },
      create: {
        ...templateSeed,
        isActive: true,
      },
    })
  }

  console.log('Seed selesai!')
  console.log('Login admin: employeeNo=EMP001, password=admin123')
  console.log('Login admin user: username=admin.kokarsi, password=admin123')
  console.log('Login pengelola: username=pengelola1, password=pengelola123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
