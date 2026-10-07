import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
  Request,
  Sse,
  MessageEvent,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { NotificationsService, NotificationPreferenceInput } from './notifications.service'

interface AuthUser {
  sub: number
  kind: string
}

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('unread') unread?: string,
    @Query('q') q?: string,
    @Request() req?: any,
  ) {
    const user: AuthUser | undefined = req?.user
    return this.service.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
      category: category || undefined,
      severity: severity || undefined,
      unread: unread === 'true' || unread === '1',
      q: q || undefined,
      userId: user?.sub,
      userType: user?.kind,
    })
  }

  @Get('summary')
  getSummary(@Request() req: any) {
    return this.service.getSummary(req.user?.sub, req.user?.kind)
  }

  @Get('count')
  getCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user?.sub, req.user?.kind).then(count => ({ count }))
  }

  @Get('preferences')
  getPreferences(@Request() req: any) {
    return this.service.getPreference(req.user?.sub, req.user?.kind)
  }

  @Put('preferences')
  updatePreferences(@Body() body: NotificationPreferenceInput, @Request() req: any) {
    return this.service.updatePreference(req.user?.sub, req.user?.kind, body ?? {})
  }

  @Post('read-all')
  markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user?.sub, req.user?.kind)
  }

  @Post('mark-many')
  markMany(@Body() body: { ids?: number[]; isRead?: boolean }, @Request() req: any) {
    return this.service.markMany(
      body?.ids ?? [],
      body?.isRead ?? true,
      req.user?.sub,
      req.user?.kind,
    )
  }

  @Post('dismiss-many')
  dismissMany(@Body() body: { ids?: number[] }, @Request() req: any) {
    return this.service.dismissMany(body?.ids ?? [], req.user?.sub, req.user?.kind)
  }

  @Delete('all')
  deleteAll(@Request() req: any) {
    return this.service.deleteAll(req.user?.sub, req.user?.kind)
  }

  @Post(':id/read')
  markOneRead(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.markOneRead(id, req.user?.sub, req.user?.kind)
  }

  @Post(':id/unread')
  markUnread(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.markUnread(id, req.user?.sub, req.user?.kind)
  }

  @Post(':id/dismiss')
  dismiss(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.dismiss(id, req.user?.sub, req.user?.kind)
  }

  @Post(':id/undo-dismiss')
  undoDismiss(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.undoDismiss(id, req.user?.sub, req.user?.kind)
  }

  @Post(':id/pin')
  setPinned(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { pinned?: boolean },
    @Request() req: any,
  ) {
    return this.service.setPinned(id, body?.pinned ?? true, req.user?.sub, req.user?.kind)
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
