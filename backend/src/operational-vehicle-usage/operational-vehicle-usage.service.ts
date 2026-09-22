import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { OperationalVehicleUsageStatus } from '@prisma/client'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { PrismaService } from '../prisma/prisma.service'
import { DashboardCacheService } from '../shared/dashboard-cache.service'
import { CreateOperationalVehicleUsageDto } from './operational-vehicle-usage.dto'

interface Actor { name: string; role: string }

@Injectable()
export class OperationalVehicleUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly dashboardCache: DashboardCacheService,
  ) {}

  async findAll(month?: number, year?: number) {
    const where: any = {}
    if (month !== undefined || year !== undefined) {
      if (!Number.isInteger(month) || !Number.isInteger(year) || month! < 1 || month! > 12 || year! < 2000 || year! > 3000) {
        throw new BadRequestException('Filter bulan dan tahun tidak valid')
      }
      where.usedAt = {
        gte: new Date(Date.UTC(year!, month! - 1, 1)),
        lt: new Date(Date.UTC(year!, month!, 1)),
      }
    }
    return this.prisma.operationalVehicleUsage.findMany({ where, orderBy: [{ usedAt: 'desc' }, { id: 'desc' }] })
  }

  async create(dto: CreateOperationalVehicleUsageDto, actor: Actor) {
    const created = await this.prisma.operationalVehicleUsage.create({
      data: {
        usedAt: new Date(dto.usedAt),
        vehicleNumber: dto.vehicleNumber,
        driver: dto.driver.trim(),
        destination: dto.destination.trim(),
        user: dto.user.trim(),
        requester: dto.requester.trim(),
        createdByName: actor.name,
        createdByRole: actor.role,
      },
    })
    void this.activityLog.log({
      module: 'Pemakaian Kendaraan',
      action: 'CREATE',
      targetLabel: `${created.vehicleNumber} - ${created.destination}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: `Waktu: ${created.usedAt.toISOString()}`,
    })
    this.dashboardCache.invalidate()
    return created
  }

  async cancel(id: number, actor: Actor) {
    const existing = await this.prisma.operationalVehicleUsage.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Catatan pemakaian kendaraan tidak ditemukan')
    if (existing.status === OperationalVehicleUsageStatus.BATAL) {
      throw new BadRequestException('Catatan pemakaian kendaraan sudah berstatus Batal')
    }

    const cancelledAt = new Date()
    const result = await this.prisma.operationalVehicleUsage.updateMany({
      where: { id, status: null },
      data: {
        status: OperationalVehicleUsageStatus.BATAL,
        cancelledAt,
        cancelledByName: actor.name,
        cancelledByRole: actor.role,
      },
    })
    if (result.count !== 1) throw new BadRequestException('Catatan sudah dibatalkan oleh pengguna lain')

    void this.activityLog.log({
      module: 'Pemakaian Kendaraan',
      action: 'UPDATE',
      targetLabel: `${existing.vehicleNumber} - ${existing.destination}`,
      performedBy: actor.name,
      performedByRole: actor.role,
      detail: 'Status diubah menjadi Batal',
    })
    this.dashboardCache.invalidate()
    return this.prisma.operationalVehicleUsage.findUnique({ where: { id } })
  }
}
