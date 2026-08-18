import { Controller, Get, Delete, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ActivityLogService } from './activity-log.service'

@UseGuards(AuthGuard('jwt'))
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private service: ActivityLogService) {}

  private checkAdmin(req: any) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Hanya ADMIN yang dapat mengakses log aktivitas')
    }
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('performedBy') performedBy?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkAdmin(req)
    return this.service.findAll({
      module,
      action,
      performedBy,
      from,
      to,
      page: page ? +page : 1,
      limit: limit ? +limit : 50,
    })
  }

  @Get('modules')
  getModules(@Request() req: any) {
    this.checkAdmin(req)
    return this.service.getModules()
  }

  @Delete('purge')
  purge(@Request() req: any, @Query('before') before?: string) {
    this.checkAdmin(req)
    const beforeDate = before ? new Date(before) : new Date()
    return this.service.purge(beforeDate)
  }
}
