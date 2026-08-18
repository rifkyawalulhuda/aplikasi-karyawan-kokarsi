import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface CreateActivityLogDto {
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  module: string
  targetLabel: string
  performedBy: string
  performedByRole: string
  detail?: string
}

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(dto: CreateActivityLogDto): Promise<void> {
    try {
      await this.prisma.activityLog.create({ data: dto })
    } catch {
      // log gagal tidak boleh merusak operasi utama
    }
  }

  async findAll(query: {
    module?: string
    action?: string
    performedBy?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  }) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 50, 200)
    const skip = (page - 1) * limit

    const where: any = {}
    if (query.module) where.module = query.module
    if (query.action) where.action = query.action
    if (query.performedBy) {
      where.performedBy = { contains: query.performedBy, mode: 'insensitive' }
    }
    if (query.from || query.to) {
      where.timestamp = {}
      if (query.from) where.timestamp.gte = new Date(query.from)
      if (query.to) {
        const to = new Date(query.to)
        to.setHours(23, 59, 59, 999)
        where.timestamp.lte = to
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ])

    return { data, total, page, limit }
  }

  async purge(beforeDate: Date): Promise<{ deleted: number }> {
    const result = await this.prisma.activityLog.deleteMany({
      where: { timestamp: { lt: beforeDate } },
    })
    return { deleted: result.count }
  }

  async getModules(): Promise<string[]> {
    const rows = await this.prisma.activityLog.findMany({
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    })
    return rows.map(r => r.module)
  }
}
