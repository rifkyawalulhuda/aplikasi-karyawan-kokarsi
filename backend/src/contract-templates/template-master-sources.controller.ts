import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PrismaService } from '../prisma/prisma.service'
import { MASTER_REFERENCE_REGISTRY, isValidMasterSource } from './master-reference.registry'

/**
 * Read-only endpoint untuk master reference picker di editor template.
 * Data tidak diekspos langsung dari tabel; hanya field yang di-allowlist.
 */
@UseGuards(AuthGuard('jwt'))
@Controller('template-master-sources')
export class TemplateMasterSourcesController {
  constructor(private prisma: PrismaService) {}

  /** Daftar semua master source yang tersedia + field-nya. */
  @Get()
  listSources() {
    return Object.entries(MASTER_REFERENCE_REGISTRY).map(([key, cfg]) => ({
      key,
      label: cfg.label,
      fields: cfg.fields,
      searchable: cfg.searchable,
    }))
  }

  /**
   * Daftar record dari satu master source untuk dropdown picker.
   * Hanya field yang di-allowlist yang dikembalikan.
   */
  @Get(':source/records')
  async listRecords(@Param('source') source: string, @Query('q') q?: string) {
    if (!isValidMasterSource(source)) {
      return []
    }
    const cfg = MASTER_REFERENCE_REGISTRY[source]
    const model = (this.prisma.client as any)[cfg.prismaModel]
    if (!model) return []

    const select: Record<string, any> = { id: true }
    for (const f of cfg.fields) {
      const parts = f.key.split('.')
      if (parts.length === 1) select[parts[0]] = true
      else select[parts[0]] = { select: { [parts[1]]: true } }
    }

    const searchable = cfg.searchable[0]
    const where = q && searchable ? { [searchable]: { contains: q, mode: 'insensitive' } } : {}

    const rows = await model.findMany({
      where,
      select,
      take: 50,
      orderBy: { [searchable ?? 'id']: 'asc' },
    })

    // Map ke bentuk { id, label } — label dari field pertama yang ada
    const labelField = cfg.fields[0]?.key
    return rows.map((row: any) => ({
      id: row.id,
      label: labelField ? this.resolvePath(row, labelField) : String(row.id),
    }))
  }

  private resolvePath(obj: any, path: string): string {
    return path.split('.').reduce((acc, part) => (acc == null ? '' : acc[part]), obj) ?? ''
  }
}
