import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcrypt'
import { CONTRACT_DOCUMENT_DEFINITIONS } from '../src/contracts/contract-document-definitions'
import { definitionToContentDefinition, definitionToFieldDefinitions } from '../src/contract-templates/default-template-definition'
import { validateContentDefinition } from '../src/contract-templates/template-schema.validator'
import { applyTemplateBindings } from '../src/contract-templates/template-field-bindings.helpers'

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
    prisma.jobRole.upsert({ where: { id: 9 }, update: {}, create: { name: 'Driver Truck B3' } }),
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

  const bootstrapPassword = process.env.SEED_ADMIN_PASSWORD
  if (!bootstrapPassword) {
    throw new Error('SEED_ADMIN_PASSWORD wajib diisi saat menjalankan seed')
  }
  const hashedPassword = await bcrypt.hash(bootstrapPassword, 10)
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

  const adminUserPassword = await bcrypt.hash(bootstrapPassword, 10)
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

  const pengelolaBootstrapPassword = process.env.SEED_PENGELOLA_PASSWORD
  if (!pengelolaBootstrapPassword) {
    throw new Error('SEED_PENGELOLA_PASSWORD wajib diisi saat menjalankan seed')
  }
  const pengelolaPassword = await bcrypt.hash(pengelolaBootstrapPassword, 10)
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
      code: 'MITRA_DRIVER_TRUCK_B3',
      name: 'Mitra Driver Truck B3',
      family: 'MITRA' as const,
      templateKey: 'MITRA_DRIVER_TRUCK_B3',
      contractTypeId: contractTypes.find(item => item.name === 'MITRA')?.id,
      jobRoleId: jobRoles.find(item => item.name === 'Driver Truck B3')?.id,
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

  // Field custom wajib untuk template keluarga MITRA.
  const ktpIssuedDateField = await prisma.templateFieldDefinition.upsert({
    where: { key: 'ktp_issued_date' },
    update: {
      label: 'Tanggal Terbit KTP Mitra',
      dataType: 'DATE',
      sourceType: 'CONTRACT_INPUT',
      isSystem: false,
      isActive: true,
    },
    create: {
      key: 'ktp_issued_date',
      label: 'Tanggal Terbit KTP Mitra',
      dataType: 'DATE',
      sourceType: 'CONTRACT_INPUT',
      isSystem: false,
      isActive: true,
    },
  })

  for (const templateSeed of templateSeeds) {
    const template = await prisma.contractTemplate.upsert({
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

    const definition = CONTRACT_DOCUMENT_DEFINITIONS[templateSeed.templateKey]

    // Simpan binding katalog untuk template agar field yang dipakai versi
    // pertama juga dapat dipakai editor dan endpoint katalog secara konsisten.
    // Binding WAJIB ditulis sebelum versi PUBLISHED dibuat: `fieldDefinitions`
    // versi adalah snapshot beku dan `publish()`/`createDraft` membacanya dari
    // tabel binding. Kalau binding ditulis setelah versi, versi v1 lahir tanpa
    // field dinamis (mis. ktp_issued_date untuk MITRA).
    const definitionFields = definition ? definitionToFieldDefinitions(definition) : []

    for (const [sortOrder, field] of definitionFields.entries()) {
      const catalogField = await prisma.templateFieldDefinition.upsert({
        where: { key: field.key },
        update: {
          label: field.label,
          dataType: field.dataType,
          sourceType: field.sourceType,
          isActive: true,
        },
        create: {
          key: field.key,
          label: field.label,
          dataType: field.dataType,
          sourceType: field.sourceType,
          isSystem: field.sourceType === 'SYSTEM',
          isActive: true,
        },
      })
      await prisma.contractTemplateField.upsert({
        where: { templateId_fieldId: { templateId: template.id, fieldId: catalogField.id } },
        update: { required: field.required, sortOrder },
        create: { templateId: template.id, fieldId: catalogField.id, required: field.required, sortOrder },
      })
    }

    if (templateSeed.family === 'MITRA') {
      // `required: false` — field tetap tampil di form kontrak (opsional), dan
      // admin dapat mencentang "Wajib" dari panel Field template kapan saja.
      // Jangan hardcode wajib: kontrak yang tidak butuh tanggal terbit KTP
      // (mis. mitra lama) tidak boleh diblokir saat submit.
      await prisma.contractTemplateField.upsert({
        where: { templateId_fieldId: { templateId: template.id, fieldId: ktpIssuedDateField.id } },
        update: { required: false, sortOrder: definitionFields.length },
        create: {
          templateId: template.id,
          fieldId: ktpIssuedDateField.id,
          required: false,
          sortOrder: definitionFields.length,
        },
      })
    }

    // Versi PUBLISHED pertama dibuat SETELAH binding katalog lengkap, lalu
    // `fieldDefinitions`-nya di-overlay memakai helper yang sama dengan
    // `createDraft`/`publish` agar v1 seed setara versi hasil alur normal.
    const versionCount = await prisma.contractTemplateVersion.count({ where: { templateId: template.id } })
    if (definition && versionCount === 0) {
      const contentDefinition = definitionToContentDefinition(definition)
      const bindings = await prisma.contractTemplateField.findMany({
        where: { templateId: template.id, field: { is: { isActive: true } } },
        include: { field: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      })
      const fieldDefinitions = applyTemplateBindings(definitionToFieldDefinitions(definition), bindings)
      validateContentDefinition(contentDefinition, fieldDefinitions.map(field => field.key), templateSeed.family)
      await prisma.contractTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          contentDefinition: contentDefinition as any,
          fieldDefinitions: fieldDefinitions as any,
          changeSummary: 'Versi awal dari definisi template bawaan aplikasi',
          createdByName: 'System seed',
          publishedByName: 'System seed',
          publishedAt: new Date(),
        },
      })
    }
  }

  const personalDocTypes = [
    { name: 'KTP', documentType: 'KTP', issuer: 'Dukcapil', category: 'PERSONAL' as const },
    { name: 'SIM', documentType: 'SIM', issuer: 'Polri', category: 'PERSONAL' as const },
    { name: 'NPWP', documentType: 'NPWP', issuer: 'Ditjen Pajak', category: 'PERSONAL' as const },
    { name: 'Kartu Keluarga', documentType: 'KK', issuer: 'Dukcapil', category: 'PERSONAL' as const },
    { name: 'Paspor', documentType: 'PASPOR', issuer: 'Imigrasi', category: 'PERSONAL' as const },
    { name: 'BPJS Ketenagakerjaan', documentType: 'BPJS_TK', issuer: 'BPJS TK', category: 'PERSONAL' as const },
    { name: 'BPJS Kesehatan', documentType: 'BPJS_KES', issuer: 'BPJS Kesehatan', category: 'PERSONAL' as const },
    { name: 'Ijazah', documentType: 'IJAZAH', issuer: 'Institusi Pendidikan', category: 'PERSONAL' as const },
    { name: 'Sertifikat Kompetensi', documentType: 'SERTIFIKAT', issuer: 'Lembaga Sertifikasi', category: 'PERSONAL' as const },
  ]

  for (const dt of personalDocTypes) {
    const existing = await prisma.documentType.findFirst({ where: { documentType: dt.documentType } })
    if (existing) {
      await prisma.documentType.update({
        where: { id: existing.id },
        data: { category: dt.category },
      })
    } else {
      await prisma.documentType.create({ data: dt })
    }
  }

  // Mock data untuk modul Pemakaian Kendaraan. Aman dijalankan ulang karena
  // hanya menghapus record yang dibuat oleh blok seed ini.
  await prisma.operationalVehicleUsage.deleteMany({
    where: { destination: { startsWith: '[MOCK] ' } },
  })

  const mockDrivers = ['Budi Santoso', 'Andi Wijaya', 'Dedi Kurniawan', 'Fajar Nugroho', 'Rizky Ramadhan']
  const mockUsers = ['Tim Operasional', 'Human Capital', 'Administrasi', 'Finance', 'Warehouse']
  const mockRequesters = ['Rina Permata', 'Siti Aminah', 'Agus Setiawan', 'Maya Lestari', 'Dimas Pratama']
  const mockDestinations = [
    'Kantor Pusat Jakarta',
    'Warehouse Cikarang',
    'Port Tanjung Priok',
    'Bank BCA Cikarang',
    'Klinik Mitra Keluarga',
    'Vendor Mekar Jaya',
    'Stasiun Cikarang',
  ]
  const mockVehicles = ['Xenia B 2845 FON', 'Grand max B 9043 FCM']
  const mockRecords = Array.from({ length: 100 }, (_, index) => {
    const dayOffset = 99 - index
    const hour = 7 + (index % 10)
    const minute = (index * 7) % 60
    const usedAt = new Date()
    usedAt.setDate(usedAt.getDate() - dayOffset)
    usedAt.setHours(hour, minute, 0, 0)

    const isCancelled = index % 9 === 0
    return {
      usedAt,
      vehicleNumber: mockVehicles[index % mockVehicles.length],
      driver: mockDrivers[index % mockDrivers.length],
      destination: `[MOCK] ${mockDestinations[index % mockDestinations.length]}`,
      user: mockUsers[index % mockUsers.length],
      requester: mockRequesters[index % mockRequesters.length],
      status: isCancelled ? 'BATAL' as const : null,
      cancelledAt: isCancelled ? new Date(usedAt.getTime() - 60 * 60 * 1000) : null,
      cancelledByName: isCancelled ? (index % 2 === 0 ? 'Admin Kokarsi' : 'Rina Permata') : null,
      cancelledByRole: isCancelled ? (index % 2 === 0 ? 'ADMIN' : 'PENGELOLA_KOPERASI') : null,
      createdAt: new Date(usedAt.getTime() - 24 * 60 * 60 * 1000),
      createdByName: index % 2 === 0 ? 'Admin Kokarsi' : 'Rina Permata',
      createdByRole: index % 2 === 0 ? 'ADMIN' : 'PENGELOLA_KOPERASI',
    }
  })

  await prisma.operationalVehicleUsage.createMany({ data: mockRecords })
  console.log('Mock pemakaian kendaraan seeded:', mockRecords.length)

  console.log('Seed selesai!')
  console.log('Seed selesai. Gunakan credential bootstrap dari environment dan segera ganti password setelah login pertama.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
