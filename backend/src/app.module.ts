import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { EmployeesModule } from './employees/employees.module'
import { ContractsModule } from './contracts/contracts.module'
import { LookupsModule } from './lookups/lookups.module'
import { UsersModule } from './users/users.module'
import { WarningLettersModule } from './warning-letters/warning-letters.module'
import { ContractTemplatesModule } from './contract-templates/contract-templates.module'
import { SettingsModule } from './settings/settings.module'
import { ContractCronModule } from './contract-cron/contract-cron.module'
import { EmployeeDocumentsModule } from './employee-documents/employee-documents.module'
import { VendorContractsModule } from './vendor-contracts/vendor-contracts.module'
import { LegalKoperasiModule } from './legal-koperasi/legal-koperasi.module'
import { NotificationsModule } from './notifications/notifications.module'
import { AkteDokumenModule } from './akte-dokumen/akte-dokumen.module'
import { EmailNotificationConfigModule } from './email-notification-config/email-notification-config.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    ContractsModule,
    LookupsModule,
    UsersModule,
    WarningLettersModule,
    ContractTemplatesModule,
    SettingsModule,
    ContractCronModule,
    EmployeeDocumentsModule,
    VendorContractsModule,
    LegalKoperasiModule,
    NotificationsModule,
    AkteDokumenModule,
    EmailNotificationConfigModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
