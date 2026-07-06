import { Module } from '@nestjs/common'
import { ContractCronService } from './contract-cron.service'
import { PrismaModule } from '../prisma/prisma.module'
import { MailerooModule } from '../maileroo/maileroo.module'

@Module({
  imports: [PrismaModule, MailerooModule],
  providers: [ContractCronService],
})
export class ContractCronModule {}
