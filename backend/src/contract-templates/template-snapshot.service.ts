import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { resolvePlaceholders, ResolveContext } from './template-value-resolver.helpers'
import { BadRequestException } from '@nestjs/common'
import { ensureFieldDefinitionsForContent } from './template-field-bindings.helpers'

export interface SnapshotInput {
  templateId: number
  /** row employee beserta relasi (jobRole, workLocation, dsb.) */
  employee?: any
  contract: {
    contractNo: string
    startDate: Date
    endDate: Date
    signedDate?: Date | null
    baseCompensation?: number | null
  }
  /** nilai input custom (CONTRACT_INPUT) dari form — key tanpa prefix "custom." */
  templateData?: Record<string, any> | null
}

export interface SnapshotResult {
  templateVersionId: number
  templateSnapshot: {
    templateId: number
    templateVersionNumber: number
    family: string
    contentDefinition: any
    fieldDefinitions: any
    snapshottedAt: string
  }
  resolvedTemplateData: Record<string, { value: any; displayValue: string }>
}

/**
 * Builder snapshot template untuk kontrak. Dipanggil saat create/renew contract
 * BILA dto.templateId mengarah ke template yang memiliki versi PUBLISHED.
 * Kontrak tanpa template / template legacy tanpa versi publish → return null
 * (perilaku lama tetap berjalan).
 */
@Injectable()
export class TemplateSnapshotService {
  constructor(private prisma: PrismaService) {}

  async buildSnapshot(input: SnapshotInput): Promise<SnapshotResult | null> {
    const published = await this.prisma.client.contractTemplateVersion.findFirst({
      where: { templateId: input.templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
      include: { template: { select: { family: true } } },
    })
    if (!published) return null

    return this.resolveSnapshot(input, {
      templateVersionId: published.id,
      versionNumber: published.versionNumber,
      family: published.template.family,
      contentDefinition: published.contentDefinition,
      fieldDefinitions: published.fieldDefinitions,
    })
  }

  /**
   * Bangun ulang snapshot dari KONTEN yang sudah ada (konten beku kontrak),
   * bukan dari versi PUBLISHED terkini. Dipakai jalur perbaikan data: kontrak
   * lama yang `resolvedTemplateData`-nya tidak lengkap diperbaiki memakai
   * konten snapshot-nya sendiri, sehingga dokumen tetap sama.
   *
   * Mengembalikan `null` bila tidak ada versi PUBLISHED untuk template tsb.
   */
  async rebuildWithContent(input: SnapshotInput, contentDefinition: unknown, fieldDefinitions: unknown): Promise<SnapshotResult | null> {
    const tpl = await this.prisma.client.contractTemplate.findUnique({ where: { id: input.templateId } })
    if (!tpl) return null
    return this.resolveSnapshot(input, {
      templateVersionId: 0,
      versionNumber: 0,
      family: tpl.family,
      contentDefinition,
      fieldDefinitions,
    })
  }

  /** Inti resolusi snapshot — dipakai `buildSnapshot` & `rebuildWithContent`. */
  private async resolveSnapshot(
    input: SnapshotInput,
    source: {
      templateVersionId: number
      versionNumber: number
      family: string
      contentDefinition: unknown
      fieldDefinitions: unknown
    },
  ): Promise<SnapshotResult> {
    const settingRows = await this.prisma.appSetting.findMany()
    const settings: Record<string, any> = {}
    for (const row of settingRows) settings[row.key] = row.value

    const definitions = this.collectDefinitions(source.fieldDefinitions)
    // Normalisasi + validasi bentuk dulu supaya nilai salah ketik gagal di sini
    // (pesan jelas, kontrak tidak dibuat) alih-alih tercetak salah di PDF.
    const templateData = this.normalizeContractInputValues(definitions, input.templateData)

    const ctx: ResolveContext = {
      contract: input.contract,
      employee: input.employee,
      templateData,
      settings,
    }

    // `fieldDefinitions` versi mungkin TIDAK mencakup semua placeholder yang
    // dipakai konten (mis. placeholder yang disisipkan editor lama tanpa
    // memperbarui daftar field). Tanpa penambahan ini, key tersebut tidak
    // di-resolve dan tercetak sebagai `...............` di PDF — padahal
    // pratinjau (memakai data contoh) terlihat lengkap. Lihat
    // `ensureFieldDefinitionsForContent`.
    const catalog = await this.prisma.client.templateFieldDefinition.findMany({
      where: { isActive: true },
      select: { key: true, label: true, dataType: true, sourceType: true, sourceConfig: true, options: true },
    })
    const allDefinitions = ensureFieldDefinitionsForContent(
      source.contentDefinition,
      this.collectDefinitions(source.fieldDefinitions),
      catalog,
    )

    const defKeys = this.collectFieldKeys(allDefinitions)
    const { resolved } = resolvePlaceholders(defKeys, ctx)

    for (const definition of allDefinitions) {
      const inputKey = String(definition.key).replace(/^custom\./, '')
      const key = definition.sourceType === 'CONTRACT_INPUT' ? `custom.${inputKey}` : definition.key
      if (!definition.required) continue
      if (definition.sourceType === 'CONTRACT_INPUT' && (input.templateData?.[inputKey] == null || input.templateData[inputKey] === '')) {
        throw new BadRequestException(`Field wajib "${definition.label ?? definition.key}" belum diisi`)
      }
      if (definition.sourceType !== 'CONTRACT_INPUT' && (resolved[key] == null || resolved[key].displayValue === '')) {
        throw new BadRequestException(`Nilai field wajib "${definition.label ?? definition.key}" tidak tersedia`)
      }
    }

    return {
      templateVersionId: source.templateVersionId,
      templateSnapshot: {
        templateId: input.templateId,
        templateVersionNumber: source.versionNumber,
        family: source.family,
        contentDefinition: source.contentDefinition,
        fieldDefinitions: allDefinitions,
        snapshottedAt: new Date().toISOString(),
      },
      resolvedTemplateData: resolved,
    }
  }

  private collectFieldKeys(fieldDefinitions: any): string[] {
    const keys: string[] = []
    if (Array.isArray(fieldDefinitions)) {
      for (const d of fieldDefinitions) if (d?.key) keys.push(d.sourceType === 'CONTRACT_INPUT' ? `custom.${String(d.key).replace(/^custom\./, '')}` : d.key)
    } else if (fieldDefinitions && Array.isArray((fieldDefinitions as any).fields)) {
      for (const d of (fieldDefinitions as any).fields) if (d?.key) keys.push(d.sourceType === 'CONTRACT_INPUT' ? `custom.${String(d.key).replace(/^custom\./, '')}` : d.key)
    }
    return keys
  }

  private collectDefinitions(fieldDefinitions: any): any[] {
    if (Array.isArray(fieldDefinitions)) return fieldDefinitions
    return fieldDefinitions?.fields ?? []
  }

  /**
   * Menormalkan & memvalidasi nilai input CONTRACT_INPUT dari form/dto.
   *
   * Tujuan: nilai yang disimpan di `templateData` (dan karena itu dicetak ke PDF)
   * hanya boleh berasal dari field yang memang ada di versi PUBLISHED, dengan
   * bentuk yang sesuai `dataType`-nya. Tanpa ini:
   *  - nilai `Date` tersimpan apa adanya lalu dites `typeof !== 'string'` di
   *    resolver → PDF berisi `[object Object]`;
   *  - nilai `"12/03/2026"` (DD/MM/YYYY, format yang tampil di UI) lolos ke
   *    resolver, gagal di-parse `new Date()`, dan muncul sebagai "Invalid Date";
   *  - field CONTRACT_INPUT yang tidak dikenal hanya memicu peringatan
   *    `unknown` di `resolvePlaceholders()` — tidak pernah masuk placeholder,
   *    jadi kontrak tersimpan dengan data yang diam-diam hilang.
   *
   * Nilai di luar field `CONTRACT_INPUT` sengaja TIDAK dibuang: `templateData`
   * ikut di-echo apa adanya oleh API dan nilai lama/tak terpakai tidak boleh
   * hilang hanya karena versi template berubah.
   */
  private normalizeContractInputValues(
    definitions: any[],
    templateData: Record<string, any> | null | undefined,
  ): Record<string, any> | undefined {
    if (templateData == null) return undefined

    const byKey = new Map<string, any>()
    for (const definition of definitions) {
      if (definition?.sourceType !== 'CONTRACT_INPUT' || !definition.key) continue
      byKey.set(String(definition.key).replace(/^custom\./, ''), definition)
    }

    const result: Record<string, any> = { ...templateData }
    for (const [key, raw] of Object.entries(templateData)) {
      const definition = byKey.get(key)
      if (!definition) continue
      const label = definition.label ?? key
      if (raw == null || raw === '') continue

      switch (definition.dataType) {
        case 'DATE': {
          const parsed = raw instanceof Date ? raw : this.parseDateInput(raw)
          if (!parsed) {
            throw new BadRequestException(
              `Nilai field "${label}" bukan tanggal yang valid (format yang diterima: YYYY-MM-DD)`,
            )
          }
          // Disimpan sebagai `Date` (bukan string ISO) karena
          // `resolvePlaceholders()` hanya memformat nilai yang benar-benar
          // `instanceof Date`; string akan dicetak mentah apa adanya.
          result[key] = parsed
          break
        }
        case 'NUMBER': {
          const num = typeof raw === 'number' ? raw : Number(String(raw).trim())
          if (!Number.isFinite(num)) {
            throw new BadRequestException(`Nilai field "${label}" harus berupa angka`)
          }
          result[key] = num
          break
        }
        case 'DROPDOWN': {
          // Opsi katalog bisa berupa nilai langsung ('PAGI') atau objek
          // ({ label, value }) — keduanya harus dibandingkan berdasarkan nilainya.
          const options = this.dropdownOptionValues(definition.options)
          // Hanya divalidasi bila opsi terdefinisi — field DROPDOWN tanpa opsi
          // tidak boleh menolak semua nilai.
          if (options.length > 0 && !options.some(option => String(option) === String(raw))) {
            throw new BadRequestException(
              `Nilai field "${label}" harus salah satu dari: ${options.join(', ')}`,
            )
          }
          result[key] = String(raw)
          break
        }
        default: {
          if (typeof raw === 'object' && !(raw instanceof Date)) {
            throw new BadRequestException(`Nilai field "${label}" harus berupa teks`)
          }
          result[key] = raw instanceof Date ? raw.toISOString() : String(raw)
          break
        }
      }
    }
    return result
  }

  /**
   * Nilai opsi DROPDOWN yang boleh dipilih. Menerima nilai langsung (`'PAGI'`)
   * maupun objek (`{ label, value }`) seperti yang dipakai editor template.
   */
  private dropdownOptionValues(options: unknown): string[] {
    if (!Array.isArray(options)) return []
    return options
      .map((option) => {
        if (option && typeof option === 'object') {
          const entry = option as { value?: unknown; label?: unknown }
          return entry.value ?? entry.label
        }
        return option
      })
      .filter(option => option != null)
      .map(String)
  }

  /**
   * Terima `YYYY-MM-DD` (nilai `<input type="date">`), ISO datetime, dan
   * `DD/MM/YYYY` (format tampilan Indonesia). String lain ditolak supaya tidak
   * berakhir sebagai "Invalid Date" di dokumen.
   *
   * Tanggal dibentuk sebagai tengah malam **waktu lokal**: `formatIndonesianDate`
   * membaca `getDate()/getMonth()/getFullYear()` (lokal), jadi `Date.UTC` akan
   * menggeser tanggal satu hari ke belakang untuk zona WIB.
   */
  private parseDateInput(raw: any): Date | null {
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw
    const text = String(raw).trim()
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text)
    if (dmy) {
      const [, day, month, year] = dmy
      const parsed = new Date(Number(year), Number(month) - 1, Number(day))
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
}
