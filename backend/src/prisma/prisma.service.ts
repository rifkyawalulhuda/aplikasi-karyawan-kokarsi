import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: 'localhost',
      port: 5434,
      user: 'postgres',
      password: 'kokarsi2026',
      database: 'kokarsi_karyawan',
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
  get contract() { return this.client.contract }
  get contractDocument() { return this.client.contractDocument }
  get workLocation() { return this.client.workLocation }
  get jobRole() { return this.client.jobRole }
  get jobLevel() { return this.client.jobLevel }
  get taxStatus() { return this.client.taxStatus }

  $connect() { return this.client.$connect() }
  $disconnect() { return this.client.$disconnect() }

  async onModuleInit() {
    await this.client.$connect()
  }

  async onModuleDestroy() {
    await this.client.$disconnect()
  }
}
