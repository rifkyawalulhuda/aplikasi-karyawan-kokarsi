import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
  ],
})
export class AppModule {}
