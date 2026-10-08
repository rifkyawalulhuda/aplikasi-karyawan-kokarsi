import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  IsString, IsInt, IsOptional, IsNotEmpty, IsBoolean, IsDateString, IsEnum, Min,
} from 'class-validator'
import { OrgPositionStatus } from '@prisma/client'
import { deleteUploadedFile } from '../shared/file-cleanup.util'
import { DAY_MS, startOfDay } from '../shared/date-utils'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { DashboardCacheService } from '../shared/dashboard-cache.service'

type Actor = { name: string; role: string }

export class CreateOrgPeriodDto {
  @IsString() @IsNotEmpty() name: string
  @IsDateString() startDate: string
  @IsOptional() @IsDateString() endDate?: string
  @IsOptional() @IsBoolean() isActive?: boolean
  @IsOptional() @IsString() notes?: string
}

export class CreateOrgPositionDto {
  @IsInt() periodId: number
  @IsOptional() @IsInt() parentId?: number | null
  @IsOptional() @IsInt() employeeId?: number | null
  @IsString() @IsNotEmpty() name: string
  @IsString() @IsNotEmpty() position: string
  @IsOptional() @IsString() unitUsaha?: string
  @IsOptional() @IsString() skNumber?: string
  @IsOptional() @IsDateString() skDate?: string
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
  @IsOptional() @IsEnum(OrgPositionStatus) status?: OrgPositionStatus
  @IsOptional() @IsInt() @Min(0) sortOrder?: number
  @IsOptional() @IsString() notes?: string
}

export class MoveOrgPositionDto {
  @IsOptional() @IsInt() parentId?: number | null
  @IsOptional() @IsInt() @Min(0) sortOrder?: number
}

@Injectable()
export class OrgStructureService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private dashboardCache: DashboardCacheService,
  ) {}

  // ── Status helper ────────────────────────────────────────────────────────
  private computeStatus(endDate: Date | null, explicit?: OrgPositionStatus): OrgPositionStatus {
    if (!endDate) return explicit ?? 'AKTIF'
    const today = startOfDay(new Date()).getTime()
    const end = startOfDay(endDate).getTime()
    const daysLeft = Math.ceil((end - today) / DAY_MS)
    if (daysLeft < 0) return 'EXPIRED'
    if (daysLeft <= 30) return 'AKAN_BERAKHIR'
    return 'AKTIF'
  }

  // ── Periods ──────────────────────────────────────────────────────────────
  async findAllPeriods() {
    return this.prisma.orgPeriod.findMany({
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      include: { _count: { select: { nodes: true } } },
    })
  }

  async createPeriod(dto: CreateOrgPeriodDto, actor: Actor) {
    const period = await this.prisma.orgPeriod.create({
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
      },
    })
    void this.activityLog.log({
      module: 'Struktur Organisasi',
      action: 'CREATE',
      targetLabel: `Periode ${period.name}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Periode kepengurusan dibuat`,
    })
    return period
  }

  async updatePeriod(id: number, dto: CreateOrgPeriodDto, actor: Actor) {
    const existing = await this.prisma.orgPeriod.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Periode tidak ditemukan')
    const period = await this.prisma.orgPeriod.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: dto.isActive ?? existing.isActive,
        notes: dto.notes ?? null,
      },
    })
    void this.activityLog.log({
      module: 'Struktur Organisasi',
      action: 'UPDATE',
      targetLabel: `Periode ${period.name}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Periode kepengurusan diperbarui`,
    })
    return period
  }

  async removePeriod(id: number, actor: Actor) {
    const existing = await this.prisma.orgPeriod.findUnique({
      where: { id },
      include: { _count: { select: { nodes: true } } },
    })
    if (!existing) throw new NotFoundException('Periode tidak ditemukan')
    const deleted = await this.prisma.orgPeriod.delete({ where: { id } })
    void this.activityLog.log({
      module: 'Struktur Organisasi',
      action: 'DELETE',
      targetLabel: `Periode ${existing.name}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Periode dihapus beserta ${existing._count.nodes} jabatan`,
    })
    return deleted
  }

  // ── Nodes ────────────────────────────────────────────────────────────────
  private include = {
    employee: { select: { id: true, employeeNo: true, fullName: true, fotoKaryawan: true } },
  }

  async findAllNodes(periodId: number) {
    return this.prisma.orgPosition.findMany({
      where: { periodId },
      include: this.include,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  async getTree(periodId: number) {
    const nodes = await this.findAllNodes(periodId)
    return this.buildTree(nodes)
  }

  private buildTree(nodes: any[]): any[] {
    const map = new Map<number, any>()
    const roots: any[] = []
    for (const node of nodes) {
      map.set(node.id, { ...node, children: [] })
    }
    for (const node of nodes) {
      const copy = map.get(node.id)!
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(copy)
      } else {
        roots.push(copy)
      }
    }
    const sortRecursive = (list: any[]) => {
      list.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, 'id'))
      for (const item of list) sortRecursive(item.children)
    }
    sortRecursive(roots)
    return roots
  }

  async findOneNode(id: number) {
    const node = await this.prisma.orgPosition.findUnique({ where: { id }, include: this.include })
    if (!node) throw new NotFoundException('Jabatan tidak ditemukan')
    return node
  }

  private async assertPeriodExists(periodId: number) {
    const period = await this.prisma.orgPeriod.findUnique({ where: { id: periodId } })
    if (!period) throw new NotFoundException('Periode tidak ditemukan')
  }

  private async assertParentValid(periodId: number, parentId: number | null | undefined, selfId?: number) {
    if (parentId === null || parentId === undefined) return
    if (selfId && parentId === selfId) {
      throw new BadRequestException('Atasan tidak boleh menunjuk ke dirinya sendiri')
    }
    const parent = await this.prisma.orgPosition.findUnique({ where: { id: parentId } })
    if (!parent) throw new NotFoundException('Atasan tidak ditemukan')
    if (parent.periodId !== periodId) {
      throw new BadRequestException('Atasan harus berada dalam periode yang sama')
    }
    if (selfId) {
      const descendants = await this.collectDescendantIds(selfId)
      if (descendants.has(parentId)) {
        throw new BadRequestException('Atasan tidak boleh berasal dari bawahannya sendiri (siklus)')
      }
    }
  }

  private async collectDescendantIds(rootId: number): Promise<Set<number>> {
    const result = new Set<number>()
    const queue = [rootId]
    while (queue.length) {
      const current = queue.shift()!
      const children = await this.prisma.orgPosition.findMany({
        where: { parentId: current },
        select: { id: true },
      })
      for (const child of children) {
        if (!result.has(child.id)) {
          result.add(child.id)
          queue.push(child.id)
        }
      }
    }
    return result
  }

  async createNode(dto: CreateOrgPositionDto, actor: Actor) {
    await this.assertPeriodExists(dto.periodId)
    await this.assertParentValid(dto.periodId, dto.parentId ?? null)

    const endDate = dto.endDate ? new Date(dto.endDate) : null
    const status = this.computeStatus(endDate, dto.status)

    const node = await this.prisma.orgPosition.create({
      data: {
        periodId: dto.periodId,
        parentId: dto.parentId ?? null,
        employeeId: dto.employeeId ?? null,
        name: dto.name,
        position: dto.position,
        unitUsaha: dto.unitUsaha,
        skNumber: dto.skNumber,
        skDate: dto.skDate ? new Date(dto.skDate) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: endDate ?? undefined,
        status,
        sortOrder: dto.sortOrder ?? 0,
        notes: dto.notes,
      },
      include: this.include,
    })
    void this.activityLog.log({
      module: 'Struktur Organisasi',
      action: 'CREATE',
      targetLabel: `${node.name} — ${node.position}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Jabatan ditambahkan${node.unitUsaha ? ` | Unit: ${node.unitUsaha}` : ''}`,
    })
    return node
  }

  async updateNode(id: number, dto: CreateOrgPositionDto, actor: Actor) {
    const existing = await this.findOneNode(id)
    await this.assertPeriodExists(dto.periodId)
    await this.assertParentValid(dto.periodId, dto.parentId ?? null, id)

    const endDate = dto.endDate ? new Date(dto.endDate) : null
    const status = this.computeStatus(endDate, dto.status)

    const node = await this.prisma.orgPosition.update({
      where: { id },
      data: {
        periodId: dto.periodId,
        parentId: dto.parentId ?? null,
        employeeId: dto.employeeId ?? null,
        name: dto.name,
        position: dto.position,
        unitUsaha: dto.unitUsaha ?? null,
        skNumber: dto.skNumber ?? null,
        skDate: dto.skDate ? new Date(dto.skDate) : null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate,
        status,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        notes: dto.notes ?? null,
      },
      include: this.include,
    })
    void this.activityLog.log({
      module: 'Struktur Organisasi',
      action: 'UPDATE',
      targetLabel: `${node.name} — ${node.position}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Jabatan diperbarui`,
    })
    return node
  }

  async moveNode(id: number, dto: MoveOrgPositionDto, actor: Actor) {
    const existing = await this.findOneNode(id)
    await this.assertParentValid(existing.periodId, dto.parentId ?? null, id)
    const node = await this.prisma.orgPosition.update({
      where: { id },
      data: {
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
      },
      include: this.include,
    })
    void this.activityLog.log({
      module: 'Struktur Organisasi',
      action: 'UPDATE',
      targetLabel: `${node.name} — ${node.position}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Posisi dalam bagan dipindahkan`,
    })
    return node
  }

  async removeNode(id: number, actor: Actor) {
    const node = await this.findOneNode(id)
    const childCount = await this.prisma.orgPosition.count({ where: { parentId: id } })
    if (childCount > 0) {
      throw new ConflictException('Jabatan ini masih memiliki bawahan. Pindahkan atau hapus bawahannya terlebih dahulu.')
    }
    deleteUploadedFile(node.photoUrl)
    const deleted = await this.prisma.orgPosition.delete({ where: { id } })
    void this.activityLog.log({
      module: 'Struktur Organisasi',
      action: 'DELETE',
      targetLabel: `${node.name} — ${node.position}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Jabatan dihapus`,
    })
    return deleted
  }

  async updatePhoto(id: number, photoUrl: string) {
    const existing = await this.findOneNode(id)
    const updated = await this.prisma.orgPosition.update({
      where: { id },
      data: { photoUrl },
      include: this.include,
    })
    if (existing.photoUrl && existing.photoUrl !== photoUrl) {
      deleteUploadedFile(existing.photoUrl)
    }
    return updated
  }
}
