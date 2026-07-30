import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL belum diset. Periksa backend/.env atau environment saat menjalankan backend.')
    }

    pool = new Pool({
      connectionString,
    })
  }
  return pool
}

function createPrisma(): PrismaClient {
  const adapter = new PrismaPg(getPool())
  return new PrismaClient({ adapter } as any)
}

const globalPrisma = createPrisma()

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = globalPrisma

  // Proxy semua property ke client
  get employee() { return this.client.employee }
  get masterAdmin() { return this.client.masterAdmin }
  get userAccount() { return this.client.userAccount }
  get contract() { return this.client.contract }
  get contractTemplate() { return this.client.contractTemplate }
  get contractDocument() { return this.client.contractDocument }
  get appSetting() { return (this.client as any).appSetting }
  get contractType() { return this.client.contractType }
  get department() { return this.client.department }
  get employeeOffboarding() { return this.client.employeeOffboarding }
  get employeeStatusHistory() { return this.client.employeeStatusHistory }
  get workLocation() { return this.client.workLocation }
  get jobRole() { return this.client.jobRole }
  get jobLevel() { return this.client.jobLevel }
  get taxStatus() { return this.client.taxStatus }
  get warningLetter() { return this.client.warningLetter }
  get documentType() { return this.client.documentType }
  get employeeDocument() { return this.client.employeeDocument }
  get company() { return this.client.company }
  get vendorContract() { return this.client.vendorContract }
  get legalKoperasi() { return this.client.legalKoperasi }
  get notification() { return this.client.notification }
  get akteDokumen() { return this.client.akteDokumen }
  get emailNotificationRecipient() { return this.client.emailNotificationRecipient }
  get emailNotificationSentLog() { return this.client.emailNotificationSentLog }
  get emailNotificationConfigLog() { return this.client.emailNotificationConfigLog }

  $connect() { return this.client.$connect() }
  $disconnect() { return this.client.$disconnect() }
  $transaction(...args: Parameters<PrismaClient['$transaction']>) {
    return (this.client.$transaction as any)(...args)
  }

  async onModuleInit() {
    await this.client.$connect()
  }

  async onModuleDestroy() {
    await this.client.$disconnect()
  }
}
