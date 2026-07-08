import { Module } from '@nestjs/common'
import { ContractCronService } from './contract-cron.service'
import { PrismaModule } from '../prisma/prisma.module'
import { MailerooModule } from '../maileroo/maileroo.module'
import { VendorContractsModule } from '../vendor-contracts/vendor-contracts.module'

@Module({
  imports: [PrismaModule, MailerooModule, VendorContractsModule],
  providers: [ContractCronService],
})
export class ContractCronModule {}
