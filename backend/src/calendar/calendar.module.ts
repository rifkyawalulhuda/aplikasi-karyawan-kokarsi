import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { SharedModule } from '../shared/shared.module'
import { CalendarController } from './calendar.controller'
import { CalendarService } from './calendar.service'
import { AgendaNotificationService } from './agenda-notification.service'

@Module({
  imports: [PrismaModule, NotificationsModule, SharedModule],
  controllers: [CalendarController],
  providers: [CalendarService, AgendaNotificationService],
  exports: [CalendarService],
})
export class CalendarModule {}
