# Surat Peringatan Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Tambah fitur manajemen Surat Peringatan dengan generate dokumen PDF otomatis sesuai template asli (logo, kop surat, font, layout persis sama).

**Architecture:** CRUD backend NestJS + Prisma, frontend form Nuxt dengan dynamic violation list, PDF generation pakai `pdfkit` (font TimesNewRoman + Calibri, logo embedded).

**Tech Stack:** NestJS, Prisma, Nuxt UI v4, pdfkit (PDF generation)

---

## Template PDF Reference

Template asli: `C:\Users\Admin\Downloads\Template SP\Surat peringatan.pdf`
Logo: `C:\Users\Admin\Downloads\Template SP\logo_sp.png` (245x237px, RGB)

**Layout A4 (595.5 × 842.25 pt):**
- Logo: x=35, y=24, w=88, h=86
- Kop surat (centered, x≈152-222): TimesNewRoman 14.3pt
  - "KOPERASI KARYAWAN"
  - "PT. SANKYU INDONESIA INTERNASIONAL"
  - "UNIT KANTOR PUSAT"
- Alamat (x=139, TimesNewRoman 11.2pt):
  - "Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20"
  - "GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330"
  - "TELP. 021 - 50555340, FAX. 021- 50555341"
- Judul (centered, Calibri-Bold 14.3pt): "SURAT PERINGATAN KARYAWAN"
- Nomor (centered, Calibri-Bold 12pt): "No : xxx/KUKP-SII/VIII/2025"
- Body (x=72, Calibri 12pt): data karyawan, jenis pelanggaran (numbered), paragraf alasan, paragraf berlaku
- Tanda tangan: Penerima SP (x=108) | Pengurus Koprasi (x=397)
- Nama dalam kurung di bawah tanda tangan

---

## Task 1: Database Schema — WarningLetter Model

**Objective:** Buat model Prisma untuk menyimpan data surat peringatan.

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add WarningLetter model**

```prisma
model WarningLetter {
  id              Int      @id @default(autoincrement())
  letterNumber    String   @unique @db.VarChar(100)
  employeeId      Int
  violationType   String[] @db.Text
  warningLevel    Int
  letterDate      DateTime @db.Date
  validUntil      DateTime @db.Date
  processedById   Int
  processedByName String   @db.VarChar(255)
  documentUrl     String?

  employee Employee @relation(fields: [employeeId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("warning_letters")
}
```

**Step 2: Add relation to Employee model**

```prisma
model Employee {
  // ... existing fields ...
  warningLetters WarningLetter[]
}
```

**Step 3: Run Prisma migration**

Run: `cd backend && npx prisma migrate dev --name add_warning_letters`
Expected: Migration created and applied

**Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add WarningLetter database model"
```

---

## Task 2: Backend — WarningLetter Module Setup

**Objective:** Buat NestJS module, service, dan controller untuk CRUD surat peringatan.

**Files:**
- Create: `backend/src/warning-letters/warning-letters.module.ts`
- Create: `backend/src/warning-letters/warning-letters.service.ts`
- Create: `backend/src/warning-letters/warning-letters.controller.ts`
- Create: `backend/src/warning-letters/dto/create-warning-letter.dto.ts`
- Create: `backend/src/warning-letters/dto/update-warning-letter.dto.ts`

**Step 1: Create DTOs**

```typescript
// create-warning-letter.dto.ts
import { IsString, IsInt, IsArray, IsDateString, IsNotEmpty } from 'class-validator'

export class CreateWarningLetterDto {
  @IsString()
  @IsNotEmpty()
  letterNumber: string

  @IsInt()
  employeeId: number

  @IsArray()
  @IsString({ each: true })
  violationType: string[]

  @IsInt()
  warningLevel: number

  @IsDateString()
  letterDate: string

  @IsDateString()
  validUntil: string

  @IsInt()
  processedById: number

  @IsString()
  processedByName: string
}
```

```typescript
// update-warning-letter.dto.ts
import { PartialType } from '@nestjs/mapped-types'
import { CreateWarningLetterDto } from './create-warning-letter.dto'

export class UpdateWarningLetterDto extends PartialType(CreateWarningLetterDto) {}
```

**Step 2: Create service**

```typescript
// warning-letters.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateWarningLetterDto } from './dto/create-warning-letter.dto'
import { UpdateWarningLetterDto } from './dto/update-warning-letter.dto'

@Injectable()
export class WarningLettersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWarningLetterDto) {
    return this.prisma.warningLetter.create({
      data: {
        letterNumber: dto.letterNumber,
        employeeId: dto.employeeId,
        violationType: dto.violationType,
        warningLevel: dto.warningLevel,
        letterDate: new Date(dto.letterDate),
        validUntil: new Date(dto.validUntil),
        processedById: dto.processedById,
        processedByName: dto.processedByName,
      },
      include: {
        employee: {
          include: {
            jobRole: true,
          },
        },
      },
    })
  }

  async findAll(page = 1, limit = 10, search?: string) {
    const where = search
      ? {
          OR: [
            { letterNumber: { contains: search, mode: 'insensitive' } },
            { employee: { fullName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}

    const [data, total] = await Promise.all([
      this.prisma.warningLetter.findMany({
        where,
        include: {
          employee: {
            include: {
              jobRole: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warningLetter.count({ where }),
    ])

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: number) {
    const letter = await this.prisma.warningLetter.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            jobRole: true,
          },
        },
      },
    })

    if (!letter) throw new NotFoundException('Surat peringatan tidak ditemukan')
    return letter
  }

  async update(id: number, dto: UpdateWarningLetterDto) {
    await this.findOne(id)

    return this.prisma.warningLetter.update({
      where: { id },
      data: {
        letterNumber: dto.letterNumber,
        employeeId: dto.employeeId,
        violationType: dto.violationType,
        warningLevel: dto.warningLevel,
        letterDate: dto.letterDate ? new Date(dto.letterDate) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        processedById: dto.processedById,
        processedByName: dto.processedByName,
      },
      include: {
        employee: {
          include: {
            jobRole: true,
          },
        },
      },
    })
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.warningLetter.delete({ where: { id } })
  }
}
```

**Step 3: Create controller**

```typescript
// warning-letters.controller.ts
import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards } from '@nestjs/common'
import { WarningLettersService } from './warning-letters.service'
import { CreateWarningLetterDto } from './dto/create-warning-letter.dto'
import { UpdateWarningLetterDto } from './dto/update-warning-letter.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/warning-letters')
@UseGuards(JwtAuthGuard)
export class WarningLettersController {
  constructor(private readonly service: WarningLettersService) {}

  @Post()
  create(@Body() dto: CreateWarningLetterDto) {
    return this.service.create(dto)
  }

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.service.findAll(+page, +limit, search)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarningLetterDto) {
    return this.service.update(+id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id)
  }
}
```

**Step 4: Create module**

```typescript
// warning-letters.module.ts
import { Module } from '@nestjs/common'
import { WarningLettersService } from './warning-letters.service'
import { WarningLettersController } from './warning-letters.controller'

@Module({
  controllers: [WarningLettersController],
  providers: [WarningLettersService],
  exports: [WarningLettersService],
})
export class WarningLettersModule {}
```

**Step 5: Register module in app.module.ts**

```typescript
// app.module.ts
import { WarningLettersModule } from './warning-letters/warning-letters.module'

@Module({
  imports: [
    // ... existing modules ...
    WarningLettersModule,
  ],
})
export class AppModule {}
```

**Step 6: Compile backend**

Run: `cd backend && npx tsc -p tsconfig.json`
Expected: No errors

**Step 7: Commit**

```bash
git add backend/src/warning-letters/ backend/src/app.module.ts
git commit -m "feat: add WarningLetter CRUD backend module"
```

---

## Task 3: Frontend — Nuxt API Proxy

**Objective:** Buat Nitro API routes untuk proxy ke backend.

**Files:**
- Create: `server/api/warning-letters/index.ts`
- Create: `server/api/warning-letters/[id].ts`

**Step 1: Create index.ts**

```typescript
// server/api/warning-letters/index.ts
import { defineEventHandler, getQuery, readBody } from 'h3'
import { proxyRequest } from '~/server/utils/proxy'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    return proxyRequest(event, '/api/warning-letters', { query })
  }

  if (method === 'POST') {
    const body = await readBody(event)
    return proxyRequest(event, '/api/warning-letters', { method: 'POST', body })
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
```

**Step 2: Create [id].ts**

```typescript
// server/api/warning-letters/[id].ts
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { proxyRequest } from '~/server/utils/proxy'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (method === 'GET') {
    return proxyRequest(event, `/api/warning-letters/${id}`)
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    return proxyRequest(event, `/api/warning-letters/${id}`, { method: 'PUT', body })
  }

  if (method === 'DELETE') {
    return proxyRequest(event, `/api/warning-letters/${id}`, { method: 'DELETE' })
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
```

**Step 3: Commit**

```bash
git add server/api/warning-letters/
git commit -m "feat: add Nitro proxy routes for warning-letters"
```

---

## Task 4: Frontend — Sidebar Navigation

**Objective:** Tambah menu "Dokumen Karyawan" dengan submenu "Surat Peringatan" di sidebar.

**Files:**
- Modify: `app/layouts/default.vue`

**Step 1: Add navigation item**

```typescript
// default.vue — insert before 'Pengaturan'
{
  label: 'Dokumen Karyawan',
  icon: 'i-lucide-folder-open',
  defaultOpen: true,
  type: 'trigger',
  children: [
    {
      label: 'Surat Peringatan',
      icon: 'i-lucide-file-warning',
      to: '/dokumen/surat-peringatan',
      onSelect: () => { open.value = false },
    },
  ],
},
```

**Step 2: Commit**

```bash
git add app/layouts/default.vue
git commit -m "feat: add Dokumen Karyawan sidebar menu"
```

---

## Task 5: Frontend — Warning Letter Page

**Objective:** Buat halaman list surat peringatan dengan tabel dan tombol tambah.

**Files:**
- Create: `app/pages/dokumen/surat-peringatan.vue`

**Step 1: Create page structure**

```vue
<script setup lang="ts">
import { h, resolveComponent } from 'vue'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

useHead({ title: 'Surat Peringatan' })

const UIcon = resolveComponent('UIcon')
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const { data, refresh, pending } = await useFetch('/api/warning-letters', {
  query: { page: 1, limit: 50 },
})

const letters = computed(() => data.value?.data || [])

const columns = [
  { accessorKey: 'letterNumber', header: 'No. Surat' },
  {
    accessorKey: 'employee',
    header: 'Nama Karyawan',
    cell: ({ row }) => row.original.employee?.fullName || '-',
  },
  { accessorKey: 'warningLevel', header: 'Level' },
  {
    accessorKey: 'letterDate',
    header: 'Tanggal',
    cell: ({ row }) => new Date(row.original.letterDate).toLocaleDateString('id-ID'),
  },
  {
    id: 'actions',
    header: 'Aksi',
    cell: ({ row }) =>
      h('div', { class: 'flex gap-2' }, [
        h(UButton, {
          size: 'xs',
          variant: 'soft',
          color: 'primary',
          onClick: () => navigateTo(`/dokumen/surat-peringatan/${row.original.id}`),
        }, () => 'Lihat'),
        h(UButton, {
          size: 'xs',
          variant: 'soft',
          color: 'secondary',
          onClick: () => generateDocument(row.original.id),
        }, () => 'Generate'),
      ]),
  },
]

async function generateDocument(id: number) {
  window.open(`/api/warning-letters/${id}/generate`, '_blank')
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Surat Peringatan">
        <template #right>
          <UButton
            label="Tambah Surat"
            icon="i-lucide-plus"
            @click="navigateTo('/dokumen/surat-peringatan/new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <div class="p-6">
      <UTable :data="letters" :columns="columns" :loading="pending" />
    </div>
  </UDashboardPanel>
</template>
```

**Step 2: Commit**

```bash
git add app/pages/dokumen/surat-peringatan.vue
git commit -m "feat: add warning letter list page"
```

---

## Task 6: Frontend — Warning Letter Form

**Objective:** Buat form input surat peringatan dengan dynamic violation list.

**Files:**
- Create: `app/pages/dokumen/surat-peringatan/new.vue`
- Create: `app/components/warning-letters/AddModal.vue`

**Step 1: Create AddModal component**

```vue
<script setup lang="ts">
import type { Employee, UserAccount } from '~/types'

const props = defineProps<{
  employees: Employee[]
  users: UserAccount[]
}>()

const emit = defineEmits<{
  close: []
  submit: [data: any]
}>()

const form = reactive({
  letterNumber: '',
  employeeId: null as number | null,
  violationType: [''],
  warningLevel: 1,
  letterDate: new Date(),
  validUntil: new Date(),
  processedById: null as number | null,
})

const selectedEmployee = computed(() =>
  props.employees.find((e) => e.id === form.employeeId)
)

const employeeItems = computed(() =>
  props.employees.map((e) => ({
    label: e.fullName,
    value: e.id,
  }))
)

const userItems = computed(() =>
  props.users.map((u) => ({
    label: u.name,
    value: u.id,
  }))
)

function addViolation() {
  form.violationType.push('')
}

function removeViolation(index: number) {
  if (form.violationType.length > 1) {
    form.violationType.splice(index, 1)
  }
}

function handleSubmit() {
  emit('submit', {
    letterNumber: form.letterNumber,
    employeeId: form.employeeId,
    violationType: form.violationType.filter((v) => v.trim()),
    warningLevel: form.warningLevel,
    letterDate: form.letterDate.toISOString(),
    validUntil: form.validUntil.toISOString(),
    processedById: form.processedById,
    processedByName: props.users.find((u) => u.id === form.processedById)?.name || '',
  })
}
</script>

<template>
  <UModal :open="true" @update:open="emit('close')">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Tambah Surat Peringatan</h3>
            <UButton icon="i-lucide-x" variant="ghost" @click="emit('close')" />
          </div>
        </template>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <UFormField label="Nomor Surat" required>
            <UInput v-model="form.letterNumber" placeholder="195/KUKP-SII/VIII/2025" />
          </UFormField>

          <UFormField label="Karyawan" required>
            <USelect
              v-model="form.employeeId"
              :items="employeeItems"
              placeholder="Pilih karyawan"
              class="w-full"
            />
          </UFormField>

          <div v-if="selectedEmployee" class="grid grid-cols-2 gap-4 p-4 bg-muted rounded">
            <div>
              <span class="text-sm text-muted">NIK</span>
              <p class="font-medium">{{ selectedEmployee.employeeNo }}</p>
            </div>
            <div>
              <span class="text-sm text-muted">Jabatan</span>
              <p class="font-medium">{{ selectedEmployee.jobRole?.name || '-' }}</p>
            </div>
          </div>

          <UFormField label="Jenis Pelanggaran" required>
            <div class="space-y-2 w-full">
              <div
                v-for="(violation, index) in form.violationType"
                :key="index"
                class="flex gap-2"
              >
                <UInput
                  v-model="form.violationType[index]"
                  :placeholder="`Pelanggaran ${index + 1}`"
                  class="flex-1"
                />
                <UButton
                  v-if="form.violationType.length > 1"
                  icon="i-lucide-trash-2"
                  variant="soft"
                  color="error"
                  @click="removeViolation(index)"
                />
              </div>
              <UButton
                label="Tambah Pelanggaran"
                icon="i-lucide-plus"
                variant="soft"
                size="sm"
                @click="addViolation"
              />
            </div>
          </UFormField>

          <UFormField label="Level Peringatan" required>
            <USelect
              v-model="form.warningLevel"
              :items="[
                { label: 'SP 1', value: 1 },
                { label: 'SP 2', value: 2 },
                { label: 'SP 3', value: 3 },
              ]"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Tanggal Surat" required>
              <UInput v-model="form.letterDate" type="date" />
            </UFormField>
            <UFormField label="Berlaku Sampai" required>
              <UInput v-model="form.validUntil" type="date" />
            </UFormField>
          </div>

          <UFormField label="Pengurus Koperasi" required>
            <USelect
              v-model="form.processedById"
              :items="userItems"
              placeholder="Pilih pengurus"
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-4">
            <UButton label="Batal" variant="soft" @click="emit('close')" />
            <UButton label="Simpan" type="submit" />
          </div>
        </form>
      </UCard>
    </template>
  </UModal>
</template>
```

**Step 2: Create new.vue page**

```vue
<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

useHead({ title: 'Tambah Surat Peringatan' })

const { data: employeesData } = await useFetch('/api/employees', { query: { limit: 1000 } })
const { data: usersData } = await useFetch('/api/users', { query: { limit: 1000 } })

const employees = computed(() => employeesData.value?.data || [])
const users = computed(() => usersData.value?.data || [])

async function handleSubmit(formData: any) {
  try {
    await $fetch('/api/warning-letters', {
      method: 'POST',
      body: formData,
    })
    navigateTo('/dokumen/surat-peringatan')
  } catch (error) {
    console.error('Error creating warning letter:', error)
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Tambah Surat Peringatan" />
    </template>

    <WarningLettersAddModal
      :employees="employees"
      :users="users"
      @close="navigateTo('/dokumen/surat-peringatan')"
      @submit="handleSubmit"
    />
  </UDashboardPanel>
</template>
```

**Step 3: Commit**

```bash
git add app/pages/dokumen/surat-peringatan/new.vue app/components/warning-letters/AddModal.vue
git commit -m "feat: add warning letter form with dynamic violations"
```

---

## Task 7: Backend — PDF Document Generation

**Objective:** Generate dokumen PDF persis sesuai template asli (logo, kop surat, font TimesNewRoman + Calibri, layout A4).

**Files:**
- Create: `backend/src/warning-letters/pdf-generator.service.ts`
- Modify: `backend/src/warning-letters/warning-letters.controller.ts`
- Install: `pdfkit` library
- Copy: logo file ke `backend/assets/logo-sp.png`

**Step 1: Install pdfkit**

Run: `cd backend && npm install pdfkit && npm install -D @types/pdfkit`
Expected: Package installed

**Step 2: Copy logo to backend assets**

```bash
mkdir -p backend/assets
cp "C:/Users/Admin/Downloads/Template SP/logo_sp.png" backend/assets/logo-sp.png
```

**Step 3: Download & register fonts**

Download Times New Roman dan Calibri (atau gunakan system fonts).
Untuk Windows: fonts tersedia di `C:/Windows/Fonts/`
- `times.ttf` (Times New Roman)
- `timesbd.ttf` (Times New Roman Bold)
- `calibri.ttf` (Calibri)
- `calibrib.ttf` (Calibri Bold)

**Step 4: Create PDF generator service**

```typescript
// pdf-generator.service.ts
import { Injectable } from '@nestjs/common'
import * as PDFDocument from 'pdfkit'
import * as path from 'path'
import * as fs from 'fs'

@Injectable()
export class PdfGeneratorService {
  private readonly fontDir = 'C:/Windows/Fonts'
  private readonly logoPath = path.join(__dirname, '../../assets/logo-sp.png')

  private formatDate(date: Date | string): string {
    const d = new Date(date)
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  async generateWarningLetter(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: true,
      })

      const buffers: Buffer[] = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Register fonts
      doc.registerFont('TimesNewRoman', path.join(this.fontDir, 'times.ttf'))
      doc.registerFont('TimesNewRoman-Bold', path.join(this.fontDir, 'timesbd.ttf'))
      doc.registerFont('Calibri', path.join(this.fontDir, 'calibri.ttf'))
      doc.registerFont('Calibri-Bold', path.join(this.fontDir, 'calibrib.ttf'))

      const { employee, violationType, warningLevel, letterDate, validUntil, processedByName } = data
      const pageWidth = 595.5
      const centerX = pageWidth / 2

      // === LOGO ===
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 35, 24, { width: 88, height: 86 })
      }

      // === KOP SURAT (Times New Roman, centered) ===
      doc.font('TimesNewRoman-Bold').fontSize(14.3)
      doc.text('KOPERASI KARYAWAN', 130, 22, { align: 'center', width: 340 })
      doc.text('PT. SANKYU INDONESIA INTERNASIONAL', 130, 40, { align: 'center', width: 340 })
      doc.text('UNIT KANTOR PUSAT', 130, 58, { align: 'center', width: 340 })

      // === ALAMAT (Times New Roman 11.2pt) ===
      doc.font('TimesNewRoman').fontSize(11.2)
      doc.text('Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20', 139, 77, { width: 340 })
      doc.text('GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330', 139, 91, { width: 340 })
      doc.text('TELP. 021 - 50555340, FAX. 021- 50555341', 139, 106, { width: 340 })

      // Garis pembatas
      doc.moveTo(35, 122).lineTo(560, 122).stroke()

      // === JUDUL (Calibri-Bold 14.3pt, centered) ===
      doc.font('Calibri-Bold').fontSize(14.3)
      doc.text('SURAT PERINGATAN KARYAWAN', 72, 139, { align: 'center', width: 451 })

      // === NOMOR SURAT (Calibri-Bold 12pt, centered) ===
      doc.font('Calibri-Bold').fontSize(12)
      doc.text(`No : ${data.letterNumber}`, 72, 157, { align: 'center', width: 451 })

      // === BODY (Calibri 12pt, x=72) ===
      let y = 203
      doc.font('Calibri').fontSize(12)
      doc.text('Surat peringatan ini di tujukan kepada  :', 72, y)

      y = 230
      doc.text('Nama', 72, y)
      doc.text(`:   ${employee.fullName}`, 180, y)

      y = 255
      doc.text('NIK', 72, y)
      doc.text(`:  ${employee.employeeNo}`, 180, y)

      y = 279
      doc.text('Jabatan', 72, y)
      doc.text(`:  ${employee.jobRole?.name || '-'}`, 180, y)

      y = 303
      doc.text('Jenis Pelanggaran', 72, y)
      doc.text(':', 180, y)

      // Violations (numbered list)
      y = 328
      for (let i = 0; i < violationType.length; i++) {
        doc.text(`${i + 1}.  ${violationType[i]}`, 72, y, { width: 451 })
        y += 25
      }

      // Paragraf alasan
      y += 15
      const paragraf1 = `Surat peringatan ini diterbitkan berdasarkan kesalahan yang telah saudara ${employee.fullName} lakukan. Oleh karena itu perusahaan memberikan Surat Peringatan Ke ${warningLevel}, hal ini bertujuan untuk dapat memberikan arahan serta peringatan terhadap saudara agar mematuhi tata tertib perusahaan dan tidak melakukan kesalahan lagi yang dapat merugikan perusahaan.`
      doc.text(paragraf1, 72, y, { width: 451, align: 'justify' })

      // Paragraf berlaku
      y = doc.y + 20
      const paragraf2 = `Surat peringatan ini berlaku semenjak di terbitkan sampai dengan ${this.formatDate(validUntil)}. Surat peringatan ini dibuat agar dapat diperhatikan dan ditaati oleh yang bersangkutan.`
      doc.text(paragraf2, 72, y, { width: 451, align: 'justify' })

      // === TANGGAL & TANDA TANGAN ===
      y = doc.y + 40
      doc.text(`Bekasi, ${this.formatDate(letterDate)}`, 72, y, { align: 'left' })

      y += 53
      doc.text('Penerima SP', 108, y)
      doc.text('Pengurus Koprasi', 397, y)

      y += 67
      doc.text(`( ${employee.fullName} )`, 72, y)
      doc.text(`(${processedByName})`, 397, y)

      doc.end()
    })
  }
}
```

**Step 5: Add generate endpoint to controller**

```typescript
// warning-letters.controller.ts (tambah endpoint)
import { Controller, Get, Param, Res } from '@nestjs/common'
import { Response } from 'express'
import { PdfGeneratorService } from './pdf-generator.service'

// ... di dalam class:
  constructor(
    private readonly service: WarningLettersService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  @Get(':id/generate')
  async generate(@Param('id') id: string, @Res() res: Response) {
    const letter = await this.service.findOne(+id)
    const buffer = await this.pdfGenerator.generateWarningLetter(letter)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="SP-${letter.letterNumber}.pdf"`)
    res.send(buffer)
  }
```

**Step 6: Update module**

```typescript
// warning-letters.module.ts
import { Module } from '@nestjs/common'
import { WarningLettersService } from './warning-letters.service'
import { WarningLettersController } from './warning-letters.controller'
import { PdfGeneratorService } from './pdf-generator.service'

@Module({
  controllers: [WarningLettersController],
  providers: [WarningLettersService, PdfGeneratorService],
  exports: [WarningLettersService],
})
export class WarningLettersModule {}
```

**Step 7: Compile backend**

Run: `cd backend && npx tsc -p tsconfig.json`
Expected: No errors

**Step 8: Commit**

```bash
git add backend/src/warning-letters/ backend/assets/ backend/package.json backend/package-lock.json
git commit -m "feat: add PDF document generation for warning letters (pdfkit)"
```

---

## Task 8: Frontend — Generate Proxy Route

**Objective:** Tambah Nitro proxy untuk generate endpoint.

**Files:**
- Create: `server/api/warning-letters/[id]/generate.ts`

**Step 1: Create generate proxy**

```typescript
// server/api/warning-letters/[id]/generate.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyRequest } from '~/server/utils/proxy'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  return proxyRequest(event, `/api/warning-letters/${id}/generate`)
})
```

**Step 2: Commit**

```bash
git add server/api/warning-letters/[id]/
git commit -m "feat: add Nitro proxy for generate endpoint"
```

---

## Task 9: Testing & Validation

**Objective:** Test semua fitur end-to-end.

**Step 1: Start backend**

Run: `cd backend && node dist/main.js`
Expected: Server running on port 3001

**Step 2: Start frontend**

Run: `cd E:/Github/aplikasi-karyawan-kokarsi && pnpm dev`
Expected: Server running on port 3000

**Step 3: Test navigation**

Open browser: `http://localhost:3000`
Verify: Sidebar has "Dokumen Karyawan" > "Surat Peringatan"

**Step 4: Test form**

Click "Tambah Surat"
Verify: Form opens with all fields
- Nomor Surat input
- Karyawan dropdown (auto-fill NIK & Jabatan)
- Jenis Pelanggaran (can add multiple)
- Level Peringatan dropdown (1-3)
- Tanggal Surat & Berlaku Sampai
- Pengurus Koperasi dropdown

**Step 5: Test save**

Fill form and submit
Verify: Redirects to list page, new entry appears

**Step 6: Test generate**

Click "Generate" button on list
Verify: PDF document downloads with correct format (logo, kop surat, font, layout sesuai template)

**Step 7: Commit final changes**

```bash
git add .
git commit -m "feat: complete Surat Peringatan feature"
```

---

## Risks & Tradeoffs

1. **PDF layout accuracy:** Posisi teks bergantung pada koordinat absolut (pt). Perlu fine-tune spacing jika font rendering berbeda antar OS. Gunakan system fonts Windows (`C:/Windows/Fonts/`) untuk konsistensi.
2. **File storage:** Current implementation return buffer langsung, tidak save ke disk. Jika perlu history, tambahkan file storage.
3. **Validation:** Belum ada validasi duplicate nomor surat di frontend. Backend sudah handle unique constraint.

---

## Open Questions

1. Apakah perlu fitur edit surat peringatan yang sudah dibuat?
2. Apakah perlu export ke PDF juga?
3. Apakah perlu tracking status (draft/final)?
