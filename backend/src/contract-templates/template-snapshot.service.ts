import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { resolvePlaceholders, ResolveContext } from './template-value-resolver.helpers'
import { BadRequestException } from '@nestjs/common'

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

    const settingRows = await this.prisma.appSetting.findMany()
    const settings: Record<string, any> = {}
    for (const row of settingRows) settings[row.key] = row.value

    const ctx: ResolveContext = {
      contract: input.contract,
      employee: input.employee,
      templateData: input.templateData ?? undefined,
      settings,
    }

    const defKeys = this.collectFieldKeys(published.fieldDefinitions)
    const { resolved } = resolvePlaceholders(defKeys, ctx)

    const definitions = this.collectDefinitions(published.fieldDefinitions)
    for (const definition of definitions) {
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
      templateVersionId: published.id,
      templateSnapshot: {
        templateId: input.templateId,
        templateVersionNumber: published.versionNumber,
        family: published.template.family,
        contentDefinition: published.contentDefinition,
        fieldDefinitions: published.fieldDefinitions,
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
}
