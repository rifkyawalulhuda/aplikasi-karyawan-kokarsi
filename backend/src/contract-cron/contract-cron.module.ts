import { Module } from '@nestjs/common'
import { ContractCronService } from './contract-cron.service'
import { PrismaModule } from '../prisma/prisma.module'
import { MailerooModule } from '../maileroo/maileroo.module'
import { VendorContractsModule } from '../vendor-contracts/vendor-contracts.module'
import { LegalKoperasiModule } from '../legal-koperasi/legal-koperasi.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { EmailNotificationConfigModule } from '../email-notification-config/email-notification-config.module'

@Module({
  imports: [PrismaModule, MailerooModule, VendorContractsModule, LegalKoperasiModule, NotificationsModule, EmailNotificationConfigModule],
  providers: [ContractCronService],
})
export class ContractCronModule {}
