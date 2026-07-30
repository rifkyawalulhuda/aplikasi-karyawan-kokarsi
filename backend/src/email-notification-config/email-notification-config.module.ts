import { Module } from '@nestjs/common'
import { EmailNotificationConfigService } from './email-notification-config.service'
import { EmailNotificationConfigController } from './email-notification-config.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [EmailNotificationConfigController],
  providers: [EmailNotificationConfigService],
  exports: [EmailNotificationConfigService],
})
export class EmailNotificationConfigModule {}
