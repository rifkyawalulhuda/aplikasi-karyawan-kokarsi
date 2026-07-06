import { Module } from '@nestjs/common'
import { MailerooService } from './maileroo.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [MailerooService],
  exports: [MailerooService],
})
export class MailerooModule {}
