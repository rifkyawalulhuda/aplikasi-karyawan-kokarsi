import { Controller, Get, Post, Param, Query, ParseIntPipe, UseGuards, Sse, MessageEvent } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { NotificationsService } from './notifications.service'

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.service.findAll(limit ? parseInt(limit) : 10)
  }

  @Get('count')
  getCount() {
    return this.service.getUnreadCount().then(count => ({ count }))
  }

  @Post('read-all')
  markAllRead() {
    return this.service.markAllRead()
  }

  @Post(':id/read')
  markOneRead(@Param('id', ParseIntPipe) id: number) {
    return this.service.markOneRead(id)
  }

  @UseGuards(AuthGuard('jwt-cookie'))
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.service.subscribe()
  }

  // Endpoint khusus untuk testing manual — trigger generate notifications tanpa menunggu cron
  @Post('trigger')
  triggerGenerate() {
    return this.service.generateNotifications()
  }
}
