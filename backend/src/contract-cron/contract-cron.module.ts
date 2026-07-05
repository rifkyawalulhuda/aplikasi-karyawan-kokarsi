import { Module } from '@nestjs/common'
import { ContractCronService } from './contract-cron.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [ContractCronService],
})
export class ContractCronModule {}
