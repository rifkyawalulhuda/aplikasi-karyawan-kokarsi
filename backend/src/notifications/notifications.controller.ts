import { Controller, Get, Post, Delete, Param, Query, ParseIntPipe, UseGuards, Request, Sse, MessageEvent } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { NotificationsService } from './notifications.service'

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findAll(@Query('limit') limit?: string, @Request() req?: any) {
    return this.service.findAll(
      limit ? parseInt(limit) : 10,
      req?.user?.sub,
      req?.user?.kind,
    )
  }

  @Get('count')
  getCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user?.sub, req.user?.kind).then(count => ({ count }))
  }

  @Post('read-all')
  markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user?.sub, req.user?.kind)
  }

  @Delete('all')
  deleteAll(@Request() req: any) {
    return this.service.deleteAll(req.user?.sub, req.user?.kind)
  }

  @Post(':id/read')
  markOneRead(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.markOneRead(id, req.user?.sub, req.user?.kind)
  }

  @UseGuards(AuthGuard('jwt-cookie'))
  @Sse('stream')
  stream(@Request() req: any): Observable<MessageEvent> {
    return this.service.subscribe(req.user?.sub, req.user?.kind)
  }

  // Endpoint khusus untuk testing manual — trigger generate notifications tanpa menunggu cron
  @Post('trigger')
  triggerGenerate() {
    return this.service.generateNotifications()
  }
}
