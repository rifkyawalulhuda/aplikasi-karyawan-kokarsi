import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { HolidaysService } from './holidays.service'

@UseGuards(AuthGuard('jwt'))
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Get()
  getHolidays(@Query('start') start: string, @Query('end') end: string) {
    // Fallback defaults — jika tidak ada query param, ambil tahun berjalan
    const today = new Date()
    const year = today.getFullYear()
    const startDate = start ?? `${year}-01-01`
    const endDate = end ?? `${year}-12-31`
    return this.service.getHolidays(startDate, endDate)
  }
}
