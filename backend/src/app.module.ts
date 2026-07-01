import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { EmployeesModule } from './employees/employees.module'
import { ContractsModule } from './contracts/contracts.module'
import { LookupsModule } from './lookups/lookups.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    ContractsModule,
    LookupsModule,
    UsersModule,
  ],
})
export class AppModule {}
