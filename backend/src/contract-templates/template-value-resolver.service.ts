import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Wrapper DB untuk kebutuhan resolve value template (settings koperasi).
 * Pure logic ada di template-value-resolver.helpers.ts agar bisa di-test tanpa DB.
 */
@Injectable()
export class TemplateValueResolverService {
  constructor(private prisma: PrismaService) {}

  /** Ambil settings koperasi untuk resolve placeholder settings.*. */
  async loadSettings(): Promise<Record<string, any>> {
    const rows = await this.prisma.appSetting.findMany()
    const out: Record<string, any> = {}
    for (const row of rows) {
      out[row.key] = row.value
    }
    return out
  }
}
