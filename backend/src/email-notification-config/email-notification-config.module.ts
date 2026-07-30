import { Module } from '@nestjs/common'
import { EmailNotificationConfigService } from './email-notification-config.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [EmailNotificationConfigService],
  exports: [EmailNotificationConfigService],
})
export class EmailNotificationConfigModule {}
