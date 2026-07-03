import { mkdir, copyFile, writeFile, access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(backendRoot, '..')
const sourceRoot = join(repoRoot, 'docs', 'sample-legal-doc', 'template-kontrak-kerja')
const outputRoot = join(backendRoot, 'assets', 'contract-templates')
const rawRoot = join(outputRoot, 'raw-doc')
const convertedRoot = join(outputRoot, 'docx-ready')

const templateEntries = [
  { key: 'PKWT_DRIVER', family: 'PKWT', sourceRelativePath: join('pkwt', 'PKWT DRIVER 2026.doc'), outputName: 'pkwt-driver-2026.docx' },
  { key: 'PKWT_KASIR', family: 'PKWT', sourceRelativePath: join('pkwt', 'PKWT KASIR 2026 -.doc'), outputName: 'pkwt-kasir-2026.docx' },
  { key: 'PKWT_STAFF', family: 'PKWT', sourceRelativePath: join('pkwt', 'PKWT STAFF 2026 .doc'), outputName: 'pkwt-staff-2026.docx' },
  { key: 'PKWT_WAREHOUSE', family: 'PKWT', sourceRelativePath: join('pkwt', 'PKWT WARE HOUSE 2026.doc'), outputName: 'pkwt-warehouse-2026.docx' },
  { key: 'MITRA_DRIVER', family: 'MITRA', sourceRelativePath: join('mitra', 'KONTRAK KERJA MITRA DRIVER OPS 2026_ .doc'), outputName: 'mitra-driver-ops-2026.docx' },
  { key: 'MITRA_KOMART', family: 'MITRA', sourceRelativePath: join('mitra', 'KONTRAK KERJA MITRA KOMART 2026_.doc'), outputName: 'mitra-komart-2026.docx' },
  { key: 'MITRA_STAFF', family: 'MITRA', sourceRelativePath: join('mitra', 'KONTRAK KERJA MITRA STAFF 2026.doc'), outputName: 'mitra-staff-2026.docx' },
  { key: 'MITRA_WAREHOUSE', family: 'MITRA', sourceRelativePath: join('mitra', 'KONTRAK KERJA MITRA WARE HOUSE CLC 2026.doc'), outputName: 'mitra-warehouse-clc-2026.docx' },
]

const placeholderSchema = [
  { placeholder: '{{employee.fullName}}', description: 'Nama lengkap karyawan' },
  { placeholder: '{{employee.employeeNo}}', description: 'Nomor induk karyawan' },
  { placeholder: '{{employee.nik}}', description: 'NIK karyawan' },
  { placeholder: '{{employee.birthPlace}}', description: 'Tempat lahir' },
  { placeholder: '{{employee.birthDate}}', description: 'Tanggal lahir format Indonesia' },
  { placeholder: '{{employee.address}}', description: 'Alamat lengkap' },
  { placeholder: '{{contract.contractNo}}', description: 'Nomor kontrak' },
  { placeholder: '{{contract.contractTypeName}}', description: 'Nama tipe kontrak' },
  { placeholder: '{{contract.startDate}}', description: 'Tanggal mulai kontrak format Indonesia' },
  { placeholder: '{{contract.endDate}}', description: 'Tanggal selesai kontrak format Indonesia' },
  { placeholder: '{{contract.signedDate}}', description: 'Tanggal tanda tangan format Indonesia' },
  { placeholder: '{{contract.positionLabel}}', description: 'Posisi kerja di dokumen' },
  { placeholder: '{{contract.locationLabel}}', description: 'Lokasi kerja di dokumen' },
  { placeholder: '{{contract.compensation}}', description: 'Nominal kompensasi dalam Rupiah' },
]

async function ensureDir(path) {
  await mkdir(path, { recursive: true })
}

async function fileExists(path) {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function resolveSofficePath() {
  const candidates = [
    process.env.LIBREOFFICE_PATH,
    'soffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--version'])
      return candidate
    } catch {
      // try next
    }
  }

  return null
}

async function convertWithLibreOffice(sofficePath, sourcePath, outputDir) {
  await execFileAsync(sofficePath, [
    '--headless',
    '--convert-to',
    'docx',
    '--outdir',
    outputDir,
    sourcePath,
  ])
}

async function main() {
  await ensureDir(rawRoot)
  await ensureDir(convertedRoot)

  const sofficePath = await resolveSofficePath()
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    outputRoot,
    converter: sofficePath ? 'LibreOffice headless' : 'manual conversion required',
    templates: [],
    placeholderSchema,
    nextSteps: [
      'Buka setiap file .docx hasil konversi dan rapikan layout bila ada pergeseran margin atau font.',
      'Ganti data statis dalam dokumen menjadi placeholder sesuai placeholderSchema.',
      'Simpan template final di folder docx-ready dan gunakan sebagai sumber generator berbasis placeholder.',
    ],
  }

  for (const entry of templateEntries) {
    const sourcePath = join(sourceRoot, entry.sourceRelativePath)
    const rawCopyPath = join(rawRoot, entry.sourceRelativePath)
    const convertedPath = join(convertedRoot, entry.outputName)

    await ensureDir(dirname(rawCopyPath))
    await copyFile(sourcePath, rawCopyPath)

    let status = 'copied'
    let notes = 'Sample .doc berhasil disalin ke folder raw.'

    if (sofficePath) {
      try {
        await convertWithLibreOffice(sofficePath, sourcePath, convertedRoot)
        const defaultConvertedPath = join(convertedRoot, entry.sourceRelativePath.replace(/\.doc$/i, '.docx'))
        if (await fileExists(defaultConvertedPath) && defaultConvertedPath !== convertedPath) {
          await copyFile(defaultConvertedPath, convertedPath)
        }
        status = 'converted'
        notes = 'Konversi .doc -> .docx berhasil. Lanjutkan dengan review layout dan pemasangan placeholder.'
      } catch (error) {
        status = 'copied'
        notes = 'Konversi otomatis gagal. Siapkan LibreOffice headless atau lakukan save as .docx secara manual.'
      }
    } else {
      notes = 'LibreOffice headless tidak ditemukan. Lakukan konversi manual ke .docx, lalu simpan dengan nama output yang direkomendasikan.'
    }

    manifest.templates.push({
      ...entry,
      sourcePath,
      rawCopyPath,
      convertedPath,
      status,
      notes,
    })
  }

  await writeFile(join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))

  const placeholderGuide = [
    '# Placeholder Guide',
    '',
    'Gunakan placeholder berikut saat merapikan file `.docx` final:',
    '',
    ...placeholderSchema.map(item => `- \`${item.placeholder}\` = ${item.description}`),
    '',
    'Catatan:',
    '- Jangan ubah placeholder dengan format lain di dalam satu template.',
    '- Hindari memecah satu placeholder menjadi beberapa text run di Word agar engine templating lebih stabil.',
  ].join('\n')

  await writeFile(join(outputRoot, 'PLACEHOLDERS.md'), placeholderGuide)

  console.log(`Template manifest dibuat di: ${join(outputRoot, 'manifest.json')}`)
  console.log(`Folder raw sample: ${rawRoot}`)
  console.log(`Folder target docx: ${convertedRoot}`)
  console.log(sofficePath
    ? `Konversi otomatis memakai: ${sofficePath}`
    : 'LibreOffice headless tidak ditemukan. Workflow tetap disiapkan, tetapi konversi otomatis dilewati.')
}

main().catch((error) => {
  console.error('Gagal menyiapkan workflow konversi template kontrak.')
  console.error(error)
  process.exit(1)
})
