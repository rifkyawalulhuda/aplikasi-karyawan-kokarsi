import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { validateContentDefinition, collectAllPlaceholders, normalizeCustomPlaceholders, normalizeArticleHeadings } from './template-schema.validator'
import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../contracts/contract-document-definitions'
import { definitionToContentDefinition, definitionToFieldDefinitions } from './default-template-definition'
import { TemplateFieldsService } from './template-fields.service'
import { applyTemplateBindings, extractContractInputFields, normalizeVersionFieldDefinitions, ensureFieldDefinitionsForContent } from './template-field-bindings.helpers'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { isValidMasterField, isValidMasterSource } from './master-reference.registry'
import { MITRA_HEADER_CHROME } from '../contracts/mitra-layout.engine'
import { createMitraPdfBuffer, resolveMitraFonts, resolveMitraLogoPath } from '../contracts/mitra-document.renderer'
import { MITRA_PREVIEW_VALUES } from '../contracts/mitra-preview-sample'
import { PKWT_HEADER_CHROME } from '../contracts/pkwt-layout.engine'
import { createPkwtPdfBuffer, resolvePkwtFonts, resolvePkwtLogoPath } from '../contracts/pkwt-document.renderer'
import { PKWT_PREVIEW_VALUES, PKWT_PREVIEW_VALUES_EN } from '../contracts/pkwt-preview-sample'

interface CreateDraftDto {
  changeSummary?: string
  contentDefinition?: any
  fieldDefinitions?: any
  overrides?: Record<string, unknown>
}

interface UpdateDraftDto {
  contentDefinition?: any
  fieldDefinitions?: any
  changeSummary?: string
}

@Injectable()
export class ContractTemplateVersionsService {
  constructor(
    private prisma: PrismaService,
    private fieldsService: TemplateFieldsService,
    private activityLog: ActivityLogService,
  ) {}

  /** Daftar versi untuk satu template master. */
  async listVersions(templateId: number) {
    await this.ensureTemplate(templateId)
    return this.prisma.client.contractTemplateVersion.findMany({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
    })
  }

  async findOne(versionId: number) {
    const version = await this.prisma.client.contractTemplateVersion.findUnique({
      where: { id: versionId },
      include: { template: { select: { id: true, code: true, name: true, family: true } } },
    })
    if (!version) throw new NotFoundException('Versi template tidak ditemukan')
    return version
  }

  /**
   * Field dinamis (CONTRACT_INPUT) + status keterbitan template untuk form kontrak.
   *
   * Field dibaca dari `fieldDefinitions` versi efektif — sumber yang sama dengan yang
   * divalidasi `TemplateSnapshotService` saat kontrak dibuat/diperpanjang, sehingga yang
   * tampil di form persis sama dengan yang diwajibkan server
   * (lihat `template-field-bindings.helpers.ts`).
   *
   * `published=false` berarti template belum pernah punya versi PUBLISHED. Kontrak dari
   * template seperti itu TIDAK dapat snapshot (`TemplateSnapshotService` mengembalikan
   * null), sehingga PDF-nya jatuh ke definisi bawaan dan field dinamis yang diisi
   * petugas hilang tanpa pesan error. Karena itu modal kontrak memblokir submit-nya.
   */
  async getContractInputFields(templateId: number) {
    await this.ensureTemplate(templateId)
    // `getPublished()` bisa mengembalikan baris non-PUBLISHED (lihat catatan di sana).
    const version = await this.getPublished(templateId)
    return {
      published: version.status === 'PUBLISHED',
      fields: extractContractInputFields(version.fieldDefinitions),
    }
  }

  /** Buat draft baru dari versi PUBLISHED terakhir (atau dari definisi hard-code via migrasi). */
  async createDraft(
    templateId: number,
    dto: CreateDraftDto,
    actor: { name: string },
  ) {
    await this.ensureTemplate(templateId)
    await this.ensureNoOpenDraft(templateId)

    const lastVersion = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    const latestVersion = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId }, orderBy: { versionNumber: 'desc' },
    })
    const nextNumber = (latestVersion?.versionNumber ?? 0) + 1
    let contentDefinition = dto.contentDefinition ?? lastVersion?.contentDefinition
    let fieldDefinitions = dto.fieldDefinitions ?? lastVersion?.fieldDefinitions
    // Template lama hasil migrasi mungkin belum memiliki snapshot versi.
    // Dalam kondisi itu, bootstrap draft dari definisi bawaan agar editor
    // dapat membuat draft tanpa harus mengirim seluruh contentDefinition.
    // Override legacy ikut di-merge: `contentOverrides` adalah satu-satunya
    // tempat konten hasil edit admin pada template legacy disimpan, jadi
    // mengabaikannya di titik ini akan menghilangkan konten tersebut secara
    // permanen (lihat Risk "Perubahan legacy override hilang"). Ini satu-satunya
    // konsumen `contentOverrides` yang masih tersisa setelah DoD #10.
    if ((!contentDefinition && !lastVersion) || (dto.overrides && !dto.contentDefinition)) {
      const template = await this.prisma.client.contractTemplate.findUnique({ where: { id: templateId } })
      const base = template ? CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey] : undefined
      if (!base) {
        throw new BadRequestException(
          `Definisi bawaan untuk template key "${template?.templateKey ?? '-'}" tidak ditemukan. `
          + 'Kirim contentDefinition lengkap atau gunakan template key yang terdaftar.',
        )
      }
      // Prioritas: override yang dikirim editor > override legacy tersimpan.
      // Konsisten dengan scripts/rollout-contract-template-versioning.ts.
      const overrides = dto.overrides ?? template?.contentOverrides
      const merged = overrides ? mergeDefinition(base, overrides as any) : base
      contentDefinition = definitionToContentDefinition(merged)
      fieldDefinitions = definitionToFieldDefinitions(merged)
    }
    if (!contentDefinition || !fieldDefinitions) {
      throw new BadRequestException('Definisi template tidak lengkap untuk membuat draft')
    }

    // Binding katalog (checkbox "wajib diisi" per template) di-overlay terakhir
    // supaya snapshot draft = kontrak kerja sesungguhnya antara template dan
    // field dinamisnya.
    const bindings = await this.fieldsService.findTemplateBindings(templateId)
    const boundFieldDefinitions = applyTemplateBindings(fieldDefinitions, bindings, {
      catalogContractInputKeys: await this.fieldsService.findContractInputCatalogKeys(),
    })
    // Selaraskan placeholder field dinamis tanpa prefix `custom.` sejak awal.
    normalizeCustomPlaceholders(contentDefinition, await this.fieldsService.findContractInputCatalogKeys())
    // Rapikan judul pasal yang melebihi 2 baris (mis. dari tempel-teks) sebelum
    // draft disimpan, supaya draft baru tidak mewarisi judul yang merusak
    // tata letak PDF.
    normalizeArticleHeadings(contentDefinition)

    return this.prisma.client.contractTemplateVersion.create({
      data: {
        templateId,
        versionNumber: nextNumber,
        status: 'DRAFT',
        contentDefinition: contentDefinition as any,
        fieldDefinitions: boundFieldDefinitions as any,
        changeSummary: dto.changeSummary,
        createdByName: actor.name,
      },
    })
  }

  /** Update draft — hanya boleh saat masih DRAFT. */
  async updateDraft(versionId: number, dto: UpdateDraftDto, actor: { name: string }) {
    const version = await this.findOne(versionId)
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Hanya versi DRAFT yang dapat diubah')
    }
    // Binding katalog tetap jadi sumber kebenaran field dinamis: kalau editor
    // mengirim fieldDefinitions, field yang ter-bind di template ikut
    // diselaraskan (ditambahkan bila belum ada, `required` mengikuti checkbox).
    // Partial update (fieldDefinitions tidak dikirim) tidak menyentuh kolom itu.
    const fieldDefinitions = dto.fieldDefinitions === undefined
      ? undefined
      : applyTemplateBindings(
        dto.fieldDefinitions,
        await this.fieldsService.findTemplateBindings(version.templateId),
        { catalogContractInputKeys: await this.fieldsService.findContractInputCatalogKeys() },
      )
    // Selaraskan placeholder field dinamis tanpa prefix `custom.` (mis. dari
    // editor lama) supaya draft tidak menyimpan sintaks yang ditolak publish.
    let nextContent = dto.contentDefinition
    if (nextContent !== undefined) {
      nextContent = JSON.parse(JSON.stringify(nextContent))
      normalizeCustomPlaceholders(nextContent, await this.fieldsService.findContractInputCatalogKeys())
      // Judul pasal dibatasi 2 baris. Editor sudah mencegah Enter ke-3, tapi
      // tempel-teks (paste) dapat membawa `\n\n` / 3+ baris tanpa lewat jalur
      // itu; normalisasi di sini menjaga draft tetap aman bagi tata letak PDF.
      normalizeArticleHeadings(nextContent)
    }
    return this.prisma.client.contractTemplateVersion.update({
      where: { id: versionId },
      data: {
        contentDefinition: nextContent !== undefined ? (nextContent as any) : undefined,
        fieldDefinitions: fieldDefinitions !== undefined ? (fieldDefinitions as any) : undefined,
        changeSummary: dto.changeSummary,
      },
    })
  }

  /**
   * Publish atomic:
   * 1. validasi schema + placeholder
   * 2. archive versi PUBLISHED lama
   * 3. set versi ini PUBLISHED
   * Semua dalam satu transaction.
   */
  async publish(versionId: number, actor: { name: string }) {
    const version = await this.findOne(versionId)
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Hanya versi DRAFT yang dapat dipublish')
    }

    const template = await this.prisma.client.contractTemplate.findUnique({
      where: { id: version.templateId },
    })
    if (!template) throw new NotFoundException('Template tidak ditemukan')

    // Kumpulkan field keys valid: system + custom yang direferensikan fieldDefinitions
    const catalogRows = await this.prisma.client.templateFieldDefinition.findMany({
      where: { isActive: true },
      select: { key: true, label: true, dataType: true, sourceType: true, sourceConfig: true, options: true },
    })
    const validKeys = new Set(catalogRows.map(f => f.key))

    // Binding katalog di-overlay terakhir, sama seperti createDraft/updateDraft.
    // `fieldDefinitions` versi adalah snapshot yang dibekukan saat publish dan
    // jadi sumber yang dibaca `GET /fields` + `TemplateSnapshotService`; tanpa
    // overlay di sini field ter-bind (mis. ktp_issued_date untuk MITRA) tidak
    // pernah masuk versi PUBLISHED walaupun barisnya ada di katalog template.
    const bindings = await this.fieldsService.findTemplateBindings(version.templateId)
    const fieldDefinitions = applyTemplateBindings(
      normalizeVersionFieldDefinitions(version.fieldDefinitions),
      bindings,
      { catalogContractInputKeys: await this.fieldsService.findContractInputCatalogKeys() },
    )

    this.validateFieldDefinitions(fieldDefinitions, validKeys)
    // Perbaiki placeholder field dinamis yang ditulis tanpa prefix `custom.`
    // (mis. `{{ktp_issued_date}}` → `{{custom.ktp_issued_date}}`). Versi lama
    // dapat memuat sintaks ini dari editor sebelum perbaikan; tanpa normalisasi,
    // publish gagal dengan "sintaks {{...}} rusak".
    const customKeys = await this.fieldsService.findContractInputCatalogKeys()
    const contentDefinition = JSON.parse(JSON.stringify(version.contentDefinition ?? {}))
    const fixedCount = normalizeCustomPlaceholders(contentDefinition, customKeys)
    // Judul pasal >2 baris (mis. dari tempel-teks) juga dirapikan sebelum
    // snapshot dibekukan, supaya dokumen yang dirender selalu sesuai asumsi
    // tata letak.
    const fixedHeadings = normalizeArticleHeadings(contentDefinition)

    // Pastikan fieldDefinitions mencakup SETIAP placeholder SYSTEM di konten.
    // Placeholder SYSTEM yang tidak terdaftar tidak di-resolve saat kontrak
    // dibuat → tercetak `...............`. CONTRACT_INPUT tetap harus di-bind
    // eksplisit (lihat ensureFieldDefinitionsForContent).
    ensureFieldDefinitionsForContent(contentDefinition, fieldDefinitions, catalogRows)

    this.addPlaceholderKeysFromDefinitions(contentDefinition, fieldDefinitions, validKeys)

    validateContentDefinition(contentDefinition, [...validKeys], template.family as any)

    const now = new Date()
    const published = await this.prisma.client.$transaction(async tx => {
      // Archive versi published lama
      await tx.contractTemplateVersion.updateMany({
        where: { templateId: version.templateId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      })
      return tx.contractTemplateVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          publishedByName: actor.name,
          fieldDefinitions: fieldDefinitions as any,
          // Simpan konten yang sudah dinormalisasi agar snapshot konsisten.
          ...(fixedCount > 0 || fixedHeadings > 0 ? { contentDefinition: contentDefinition as any } : {}),
        },
      })
    })
    await this.activityLog.log({ action: 'UPDATE', module: 'Template Kontrak', targetLabel: `Versi ${version.versionNumber}`, performedBy: actor.name, performedByRole: 'ADMIN', detail: `Publish template ${template.code}` })
    return published
  }

  /** Validasi draft tanpa mengubah status atau data database. */
  async preview(versionId: number, contentDefinitionOverride?: unknown) {
    const version = await this.findOne(versionId)
    const catalog = await this.prisma.client.templateFieldDefinition.findMany({ where: { isActive: true }, select: { key: true } })
    const validKeys = new Set(catalog.map(field => field.key))
    // Binding katalog ikut di-overlay supaya hasil preview sama dengan yang akan
    // dibekukan `publish()` — tanpa ini placeholder {{custom.ktp_issued_date}}
    // dilaporkan "tidak dikenal" padahal publish-nya valid.
    const fieldDefinitions = applyTemplateBindings(
      normalizeVersionFieldDefinitions(version.fieldDefinitions),
      await this.fieldsService.findTemplateBindings(version.templateId),
    )
    this.validateFieldDefinitions(fieldDefinitions, validKeys)
    // Sama seperti publish(): perbaiki placeholder tanpa prefix `custom.` agar
    // pratinjau tidak melaporkan "sintaks rusak" untuk data lama.
    const previewContent = JSON.parse(JSON.stringify(contentDefinitionOverride ?? version.contentDefinition ?? {}))
    normalizeCustomPlaceholders(previewContent, await this.fieldsService.findContractInputCatalogKeys())
    normalizeArticleHeadings(previewContent)
    this.addPlaceholderKeysFromDefinitions(previewContent, fieldDefinitions, validKeys)
    const result = validateContentDefinition(previewContent, [...validKeys], version.template.family as any)
    return { versionId: version.id, templateId: version.templateId, valid: true, ...result }
  }

  /**
   * Render PDF pratinjau untuk versi template.
   *
   * Memakai MESIN YANG SAMA dengan generate kontrak:
   *  - MITRA → `createMitraPdfBuffer` → `renderMitraLayout` + `renderMitraSignature`
   *  - PKWT  → `createPkwtPdfBuffer`  → `renderPkwtLayout` (bilingual, row-locked)
   * sehingga hasil pratinjau 1:1 dengan dokumen yang dihasilkan nanti. Data
   * placeholder memakai contoh (`MITRA_PREVIEW_VALUES` / `PKWT_PREVIEW_VALUES`)
   * karena versi template belum terikat kontrak.
   *
   * Stateless: `contentDefinition` dari body dipakai bila ada (agar editan yang
   * BELUM disimpan ikut terlihat); DB tidak pernah ditulis.
   *
   * Keluarga yang didukung: MITRA dan PKWT. Keluarga lain belum punya mesin
   * layout master, jadi ditolak dengan pesan jelas.
   */
  async renderPreviewPdf(
    versionId: number,
    dto: { contentDefinition?: Record<string, unknown> },
  ): Promise<Buffer> {
    const version = await this.findOne(versionId)
    const family = version.template.family
    if (family !== 'MITRA' && family !== 'PKWT') {
      throw new BadRequestException(
        'Pratinjau PDF baru tersedia untuk template Perjanjian Kemitraan (MITRA) dan Kesepakatan Kerja Waktu Tertentu (PKWT).',
      )
    }

    // Salin dulu supaya normalisasi judul pasal di bawah tidak menyentuh objek
    // milik `version`; hasil pratinjau harus sama dengan yang akan dirender
    // setelah draft disimpan.
    const content = JSON.parse(JSON.stringify((dto.contentDefinition ?? version.contentDefinition) ?? {})) as any
    normalizeArticleHeadings(content)
    const blocks: any[] = content?.languages?.id ?? []
    if (!Array.isArray(blocks) || blocks.length === 0) {
      throw new BadRequestException('Konten template kosong — tidak ada yang bisa dipratinjau.')
    }

    return version.template.family === 'PKWT'
      ? this.renderPkwtPreview(blocks, content)
      : this.renderMitraPreview(blocks)
  }

  /** Pratinjau MITRA — mesin yang sama dengan generate (`createMitraPdfBuffer`). */
  private renderMitraPreview(blocks: any[]): Promise<Buffer> {
    const assetRoot = resolve(process.cwd(), 'assets')
    const logoPath = resolveMitraLogoPath(assetRoot)
    const values = { ...MITRA_PREVIEW_VALUES }
    const numberLabel = `${MITRA_HEADER_CHROME.numberPrefix} ${values['contract.contractNo']}`
    const dateLabel = `${MITRA_HEADER_CHROME.datePrefix} ${values['contract.signedDate'] ?? values['contract.startDate']}`

    return createMitraPdfBuffer({
      blocks,
      values,
      numberLabel,
      dateLabel,
      logoPath: existsSync(logoPath) ? logoPath : undefined,
      fonts: resolveMitraFonts(),
    })
  }

  /**
   * Pratinjau PKWT — mesin yang sama dengan generate (`createPkwtPdfBuffer`).
   *
   * PKWT bilingual: kolom kiri `languages.id`, kolom kanan `languages.en`, baris
   * terkunci oleh engine. Kedua kolom memakai nilai contoh yang sama KECUALI
   * placeholder ber-label per-bahasa (mis. `employee.gender` → "Laki-laki" di
   * kiri, "Male" di kanan) — lihat `PKWT_PREVIEW_VALUES_EN`.
   */
  private renderPkwtPreview(blocks: any[], content: any): Promise<Buffer> {
    const assetRoot = resolve(process.cwd(), 'assets')
    const logoPath = resolvePkwtLogoPath(assetRoot)
    const values = { ...PKWT_PREVIEW_VALUES }
    const valuesEn = { ...PKWT_PREVIEW_VALUES_EN }
    const numberLabel = `${PKWT_HEADER_CHROME.numberPrefix} ${values['contract.contractNo']}`

    return createPkwtPdfBuffer({
      blocks,
      blocksEn: content?.languages?.en ?? [],
      values,
      valuesEn,
      orgLines: [...PKWT_HEADER_CHROME.org],
      addressLines: [...PKWT_HEADER_CHROME.address],
      contactLine: PKWT_HEADER_CHROME.contactLine,
      numberLabel,
      logoPath: existsSync(logoPath) ? logoPath : undefined,
      fonts: resolvePkwtFonts(),
      signature: {
        leftTitle: PKWT_HEADER_CHROME.signature.leftTitle,
        rightTitle: PKWT_HEADER_CHROME.signature.rightTitle,
        leftName: values['employee.fullName'],
        leftRole: values['employee.jobRole'],
        rightName: values['settings.cooperativeChairmanName'],
        rightRole: PKWT_HEADER_CHROME.signature.rightRoleLabel,
      },
    })
  }

  /** Rollback: aktifkan kembali versi ARCHIVED tertentu sebagai PUBLISHED. */
  async rollback(versionId: number, actor: { name: string }) {
    const version = await this.findOne(versionId)
    if (version.status !== 'ARCHIVED') {
      throw new BadRequestException('Rollback hanya dapat dilakukan pada versi ARCHIVED')
    }
    const catalog = await this.prisma.client.templateFieldDefinition.findMany({ where: { isActive: true }, select: { key: true } })
    const validKeys = new Set(catalog.map(field => field.key))
    // Versi ARCHIVED bisa jadi dibuat sebelum binding katalog ditulis (seed lama),
    // jadi overlay binding juga diterapkan di sini agar rollback tidak
    // mengaktifkan kembali versi tanpa field dinamis.
    const fieldDefinitions = applyTemplateBindings(
      normalizeVersionFieldDefinitions(version.fieldDefinitions),
      await this.fieldsService.findTemplateBindings(version.templateId),
      { catalogContractInputKeys: await this.fieldsService.findContractInputCatalogKeys() },
    )
    this.validateFieldDefinitions(fieldDefinitions, validKeys)
    this.addPlaceholderKeysFromDefinitions(version.contentDefinition, fieldDefinitions, validKeys)
    validateContentDefinition(version.contentDefinition, [...validKeys], version.template.family as any)
    const published = await this.prisma.client.$transaction(async tx => {
      await tx.contractTemplateVersion.updateMany({
        where: { templateId: version.templateId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      })
      return tx.contractTemplateVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: new Date(), publishedByName: actor.name, fieldDefinitions: fieldDefinitions as any },
      })
    })
    await this.activityLog.log({ action: 'UPDATE', module: 'Template Kontrak', targetLabel: `Versi ${version.versionNumber}`, performedBy: actor.name, performedByRole: 'ADMIN', detail: `Rollback template ${version.template.code}` })
    return published
  }

  /**
   * Hapus versi ARCHIVED atau DRAFT.
   *
   * Aturan:
   *  - Versi PUBLISHED tidak boleh dihapus (harus ada versi terbit aktif).
   *  - Versi yang masih dipakai kontrak (`contracts.templateVersionId`) tidak
   *    boleh dihapus — FK-nya `SET NULL`, jadi menghapusnya akan menghilangkan
   *    jejak audit "kontrak ini dulu pakai versi berapa". Konsisten dengan
   *    penolakan hapus template yang masih dipakai (`contract-templates.service`).
   *
   * Menghapus DRAFT juga membebaskan `ensureNoOpenDraft()` yang tadinya
   * memblokir pembuatan draft baru tanpa jalan keluar.
   */
  async deleteVersion(versionId: number, actor: { name: string }) {
    const version = await this.findOne(versionId)

    if (version.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Versi yang sedang terbit (PUBLISHED) tidak dapat dihapus. Terbitkan versi lain dulu bila ingin menggantinya.',
      )
    }
    if (version.status !== 'ARCHIVED' && version.status !== 'DRAFT') {
      throw new BadRequestException(`Versi berstatus ${version.status} tidak dapat dihapus`)
    }

    const usedByContracts = await this.prisma.client.contract.count({
      where: { templateVersionId: versionId },
    })
    if (usedByContracts > 0) {
      throw new BadRequestException(
        `Versi ini dipakai oleh ${usedByContracts} kontrak, tidak bisa dihapus.`,
      )
    }

    const deleted = await this.prisma.client.contractTemplateVersion.delete({ where: { id: versionId } })
    await this.activityLog.log({
      action: 'DELETE',
      module: 'Template Kontrak',
      targetLabel: `Versi ${version.versionNumber}`,
      performedBy: actor.name,
      performedByRole: 'ADMIN',
      detail: `Hapus versi ${version.status} template ${version.template.code}`,
    })
    return deleted
  }

  /** Versi PUBLISHED aktif untuk sebuah template. */
  async getPublished(templateId: number) {    const published = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    if (published) return published

    const template = await this.prisma.client.contractTemplate.findUnique({ where: { id: templateId } })
    if (!template) throw new NotFoundException('Template tidak ditemukan')

    // Template yang sudah PUNYA versi (tapi belum ada yang PUBLISHED — mis. admin
    // baru menyimpan draft) tidak boleh di-bootstrap. Bootstrap di bawah selalu
    // menulis `versionNumber: 1` dan akan menabrak unique (templateId,
    // versionNumber) milik draft tersebut, sehingga editor template maupun modal
    // kontrak gagal total dengan P2002. Versi terbaru yang ada dipakai sebagai
    // versi efektif: draft tidak pernah ikut tervalidasi atau tercetak ke kontrak
    // (`TemplateSnapshotService` tetap hanya membaca versi PUBLISHED), jadi ini
    // murni agar UI dapat dibuka — tanpa menerbitkan versi apa pun diam-diam.
    const latest = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
    })
    if (latest) return latest

    // Template yang dibuat sebelum versioning belum mempunyai snapshot. Seed
    // secara lazy agar editor tetap dapat dibuka setelah migrasi deployment.
    const definition = CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey]
    if (!definition) throw new NotFoundException('Definisi bawaan template tidak ditemukan')

    const contentDefinition = definitionToContentDefinition(definition)
    // Binding katalog ikut di-overlay — jalur bootstrap lazy ini juga menerbitkan
    // versi PUBLISHED langsung, jadi tanpa overlay ini template legacy yang belum
    // punya snapshot akan terbit tanpa field dinamisnya (form kontrak kosong
    // padahal admin sudah mencentang field wajib di katalog).
    const fieldDefinitions = applyTemplateBindings(
      definitionToFieldDefinitions(definition),
      await this.fieldsService.findTemplateBindings(templateId),
    )
    // Placeholder {{custom.xxx}} yang dirujuk konten harus dianggap valid, sama
    // seperti di publish()/preview() — kalau tidak, bootstrap versi legacy untuk
    // template MITRA gagal validasi (mis. {{custom.ktp_issued_date}}).
    const validKeys = new Set(fieldDefinitions.map(field => field.key))
    this.addPlaceholderKeysFromDefinitions(contentDefinition, fieldDefinitions, validKeys)
    validateContentDefinition(contentDefinition, [...validKeys], template.family)
    try {
      return await this.prisma.client.contractTemplateVersion.create({
        data: {
          templateId,
          versionNumber: 1,
          status: 'PUBLISHED',
          contentDefinition: contentDefinition as any,
          fieldDefinitions: fieldDefinitions as any,
          changeSummary: 'Versi awal dibuat saat editor template dibuka',
          createdByName: 'System',
          publishedByName: 'System',
          publishedAt: new Date(),
        },
      })
    } catch (error: any) {
      // Dua request bersamaan (mis. editor template + modal kontrak) sama-sama
      // melihat "belum ada versi" lalu sama-sama menulis v1. Yang kalah balapan
      // cukup memakai versi yang sudah dibuat pemenangnya.
      if (error?.code !== 'P2002') throw error
      const winner = await this.prisma.client.contractTemplateVersion.findFirst({
        where: { templateId },
        orderBy: { versionNumber: 'desc' },
      })
      if (!winner) throw error
      return winner
    }
  }

  private async ensureTemplate(templateId: number) {
    const t = await this.prisma.client.contractTemplate.findUnique({ where: { id: templateId } })
    if (!t) throw new NotFoundException('Template tidak ditemukan')
  }

  private async ensureNoOpenDraft(templateId: number) {
    const draft = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId, status: 'DRAFT' },
    })
    if (draft) {
      throw new BadRequestException(
        `Masih ada draft terbuka (v${draft.versionNumber}). Selesaikan atau hapus terlebih dahulu.`,
      )
    }
  }

  private definitionArray(value: any): any[] {
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.fields)) return value.fields
    throw new BadRequestException('fieldDefinitions harus berupa array atau object { fields: [] }')
  }

  /**
   * Tambahkan key valid untuk placeholder `{{custom.xxx}}` yang dirujuk konten.
   *
   * `applyTemplateBindings()` membuang prefix `custom.` (resolver mengharapkan
   * key polos), sedangkan blok konten menulis `{{custom.xxx}}`. Tanpa jembatan
   * ini `validateContentDefinition()` melaporkan placeholder sebagai "tidak
   * terdaftar di katalog field" — mis. `{{custom.ktp_issued_date}}` pada paragraf
   * identitas PIHAK KEDUA — sehingga publish maupun bootstrap versi gagal.
   *
   * Dipakai oleh `getPublished()` (bootstrap lazy), `publish()`, dan `preview()`.
   */
  private addPlaceholderKeysFromDefinitions(
    contentDefinition: unknown,
    fieldDefinitions: Array<{ key?: unknown }>,
    validKeys: Set<string>,
  ): void {
    for (const placeholder of collectAllPlaceholders(contentDefinition)) {
      const isReferenced = fieldDefinitions.some(
        (definition: any) => placeholder === definition.key || placeholder === `custom.${definition.key}`,
      )
      if (isReferenced) validKeys.add(placeholder)
    }
  }

  private validateFieldDefinitions(value: any, catalog: Set<string>) {
    const definitions = this.definitionArray(value)
    const keys = new Set<string>()
    for (const definition of definitions) {
      if (!definition || typeof definition.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(definition.key)) {
        throw new BadRequestException('Setiap field definition harus memiliki key yang valid')
      }
      if (keys.has(definition.key)) throw new BadRequestException(`Duplicate field key: ${definition.key}`)
      keys.add(definition.key)
      if (definition.sourceType === 'SYSTEM' && !catalog.has(definition.key)) {
        throw new BadRequestException(`Field system "${definition.key}" tidak terdaftar di katalog`)
      }
      if (definition.sourceType === 'CONTRACT_INPUT' && definition.key.includes('.')) {
        throw new BadRequestException(`Field CONTRACT_INPUT "${definition.key}" tidak boleh memakai namespace system`)
      }
      if (!['SYSTEM', 'CONTRACT_INPUT', 'MASTER_REFERENCE'].includes(definition.sourceType)) {
        throw new BadRequestException(`Source field tidak valid untuk "${definition.key}"`)
      }
      if (!['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MASTER_REFERENCE'].includes(definition.dataType)) {
        throw new BadRequestException(`Tipe field tidak valid untuk "${definition.key}"`)
      }
      if (definition.sourceType === 'MASTER_REFERENCE' || definition.dataType === 'MASTER_REFERENCE') {
        const config = definition.sourceConfig ?? {}
        const master = config.master
        const field = config.field ?? config.labelField
        if (!isValidMasterSource(master) || !isValidMasterField(master, field)) {
          throw new BadRequestException(`Master reference tidak valid untuk "${definition.key}"`)
        }
        if (definition.dataType !== 'MASTER_REFERENCE') {
          throw new BadRequestException(`Field master "${definition.key}" harus bertipe MASTER_REFERENCE`)
        }
      }
      // MASTER_REFERENCE belum punya jalur resolve di `template-value-resolver.helpers.ts`.
      // Artinya field seperti ini tidak akan pernah punya nilai saat kontrak dibuat:
      // kalau `required`, pembuatan kontrak SELALU gagal dengan pesan yang
      // membingungkan; kalau opsional, PDF diam-diam kosong. Karena itu versi yang
      // memuatnya ditolak di publish/preview/rollback, bukan dibiarkan terbit.
      // Definisi bawaan (`definitionToFieldDefinitions`) tidak pernah menghasilkan
      // MASTER_REFERENCE, jadi hanya fieldDefinitions yang ditulis manual yang
      // terkena aturan ini.
      if (definition.sourceType === 'MASTER_REFERENCE') {
        throw new BadRequestException(
          `Field master reference "${definition.key}" belum didukung pada dokumen kontrak. `
          + 'Ubah menjadi input manual (CONTRACT_INPUT) atau hapus dari fieldDefinitions.',
        )
      }
      if (definition.dataType === 'DROPDOWN' && (!Array.isArray(definition.options) || definition.options.length === 0)) {
        throw new BadRequestException(`Field DROPDOWN "${definition.key}" memerlukan opsi`)
      }
    }
  }
}
