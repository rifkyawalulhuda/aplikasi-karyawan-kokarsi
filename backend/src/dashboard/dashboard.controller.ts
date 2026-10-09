import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { DashboardService } from './dashboard.service'

@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /**
   * Data engagement dashboard (ulang tahun, anniversary, aktivitas, tugas, pengumuman).
   * Aktivitas hanya dikembalikan untuk role ADMIN.
   */
  @Get('engagement')
  getEngagement(@Request() req: any, @Query('month') month?: string) {
    const userId = Number(req.user?.sub)
    const role = String(req.user?.role ?? '')
    return this.service.getEngagement(userId, role, month ? Number(month) : undefined)
  }

  /** Tren bulanan + perbandingan dengan periode sebelumnya. */
  @Get('trends')
  getTrends(@Query('months') months?: string) {
    return this.service.getMonthlyTrends(months ? Number(months) : undefined)
  }
}
