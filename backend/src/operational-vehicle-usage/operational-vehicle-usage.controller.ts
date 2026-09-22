import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { CreateOperationalVehicleUsageDto } from './operational-vehicle-usage.dto'
import { OperationalVehicleUsageService } from './operational-vehicle-usage.service'

@UseGuards(AuthGuard('jwt'))
@Controller('operational-vehicle-usages')
export class OperationalVehicleUsageController {
  constructor(private readonly service: OperationalVehicleUsageService) {}

  @Get()
  findAll(@Query('month') month?: string, @Query('year') year?: string) {
    return this.service.findAll(month ? Number(month) : undefined, year ? Number(year) : undefined)
  }

  @Post()
  create(@Body() dto: CreateOperationalVehicleUsageDto, @Request() req: any) {
    return this.service.create(dto, this.actor(req))
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.cancel(id, this.actor(req))
  }

  private actor(req: any) {
    return {
      name: req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User',
      role: req.user?.role ?? 'UNKNOWN',
    }
  }
}
