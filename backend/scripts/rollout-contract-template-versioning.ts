/**
 * Phase 6 rollout for contract template versioning.
 *
 * Safe to run repeatedly. By default it bootstraps missing published versions
 * and backfills only contracts that do not have an immutable snapshot yet.
 * Use --dry-run to inspect the work without changing the database.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CONTRACT_DOCUMENT_DEFINITIONS, mergeDefinition } from '../src/contracts/contract-document-definitions'
import { definitionToContentDefinition, definitionToFieldDefinitions } from '../src/contract-templates/default-template-definition'
import { resolvePlaceholders } from '../src/contract-templates/template-value-resolver.helpers'
import { validateContentDefinition } from '../src/contract-templates/template-schema.validator'

config({ path: resolve(__dirname, '../.env') })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL tidak ditemukan di environment')

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })) } as any)
const dryRun = process.argv.includes('--dry-run')

function definitionsOf(value: any): any[] {
  return Array.isArray(value) ? value : (value?.fields ?? [])
}

function fieldKeys(value: any): string[] {
  return definitionsOf(value).filter(field => field?.key).map(field =>
    field.sourceType === 'CONTRACT_INPUT'
      ? `custom.${String(field.key).replace(/^custom\./, '')}`
      : String(field.key),
  )
}

async function bootstrapVersions() {
  const templates = await prisma.contractTemplate.findMany()
  let created = 0
  for (const template of templates) {
    const existing = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: template.id, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    if (existing) continue

    const definition = CONTRACT_DOCUMENT_DEFINITIONS[template.templateKey]
    if (!definition) continue
    const merged = mergeDefinition(definition, template.contentOverrides as Record<string, any> | null)
    const contentDefinition = definitionToContentDefinition(merged)
    const fieldDefinitions = definitionToFieldDefinitions(merged)
    validateContentDefinition(contentDefinition, fieldDefinitions.map(field => field.key), template.family as any)
    if (!dryRun) {
      const latest = await prisma.contractTemplateVersion.findFirst({
        where: { templateId: template.id }, orderBy: { versionNumber: 'desc' },
      })
      await prisma.contractTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          status: 'PUBLISHED',
          contentDefinition: contentDefinition as any,
          fieldDefinitions: fieldDefinitions as any,
          changeSummary: 'Phase 6 rollout: versi publish awal dari template legacy',
          createdByName: 'Phase 6 rollout',
          publishedByName: 'Phase 6 rollout',
          publishedAt: new Date(),
        },
      })
    }
    created++
  }
  return created
}

async function backfillSnapshots() {
  const contracts: any[] = await prisma.contract.findMany({
    where: { templateId: { not: null }, OR: [{ templateVersionId: null }, { templateSnapshot: { equals: Prisma.JsonNull } }] } as any,
    include: {
      template: true,
      employee: { include: { jobRole: true, workLocation: true, department: true, taxStatus: true, jobLevel: true } },
    },
  })
  const settingsRows = await prisma.appSetting.findMany()
  const settings = Object.fromEntries(settingsRows.map(row => [row.key, row.value]))
  let updated = 0
  const unresolved: Array<{ contractId: number; keys: string[] }> = []

  for (const contract of contracts) {
    if (!contract.templateId || !contract.template) continue
    const version = await prisma.contractTemplateVersion.findFirst({
      where: { templateId: contract.templateId, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    })
    if (!version) continue

    const keys = fieldKeys(version.fieldDefinitions)
    const resolved = resolvePlaceholders(keys, {
      contract: {
        contractNo: contract.contractNo,
        startDate: new Date(contract.startDate),
        endDate: new Date(contract.endDate),
        signedDate: contract.signedDate ? new Date(contract.signedDate) : null,
        baseCompensation: contract.baseCompensation,
      },
      employee: contract.employee,
      templateData: (contract.templateData as Record<string, any> | null) ?? undefined,
      settings,
    })
    if (resolved.unknown.length) unresolved.push({ contractId: contract.id, keys: resolved.unknown })

    const snapshot = {
      templateId: contract.templateId,
      templateVersionNumber: version.versionNumber,
      family: contract.template.family,
      contentDefinition: version.contentDefinition,
      fieldDefinitions: version.fieldDefinitions,
      snapshottedAt: new Date().toISOString(),
      migration: 'phase-6-rollout',
    }
    if (!dryRun) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          templateVersionId: version.id,
          templateSnapshot: snapshot as any,
          resolvedTemplateData: resolved.resolved as any,
        },
      })
    }
    updated++
  }
  return { updated, unresolved }
}

async function verify() {
  const [templates, versions, contracts, snapshotted, unresolved] = await Promise.all([
    prisma.contractTemplate.count(),
    prisma.contractTemplateVersion.count(),
    prisma.contract.count({ where: { templateId: { not: null } } }),
    prisma.contract.count({ where: { templateSnapshot: { not: Prisma.JsonNull } } as any }),
    prisma.contract.count({ where: { templateId: { not: null }, templateSnapshot: { equals: Prisma.JsonNull } } as any }),
  ])
  return { templates, versions, contractsWithTemplate: contracts, contractsWithSnapshot: snapshotted, contractsWithoutSnapshot: unresolved }
}

async function main() {
  const createdVersions = await bootstrapVersions()
  const snapshots = await backfillSnapshots()
  const counts = dryRun ? { mode: 'dry-run' } : await verify()
  console.log(JSON.stringify({ dryRun, createdVersions, ...snapshots, counts }, null, 2))
  if (snapshots.unresolved.length) process.exitCode = 2
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())