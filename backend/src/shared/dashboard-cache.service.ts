import { Injectable } from '@nestjs/common'

/**
 * DashboardCacheService — singleton injectable untuk cache dashboard stats.
 *
 * Strategi: cache invalidasi cerdas (bukan TTL buta).
 * Cache di-set saat getDashboardStats() selesai query, dan di-invalidate
 * setiap kali ada mutasi data yang mempengaruhi dashboard:
 * - Employee: create, update, remove, offboard
 * - Contract: create, renew, update, remove
 * - WarningLetter: create, update, remove
 *
 * TTL fallback 5 menit tetap ada sebagai safety net.
 */
@Injectable()
export class DashboardCacheService {
  private cache: { data: any; expiresAt: number } | null = null
  private readonly TTL_MS = 5 * 60 * 1000 // 5 menit fallback

  get(): any | null {
    if (!this.cache) return null
    if (Date.now() > this.cache.expiresAt) {
      this.cache = null
      return null
    }
    return this.cache.data
  }

  set(data: any): void {
    this.cache = { data, expiresAt: Date.now() + this.TTL_MS }
  }

  invalidate(): void {
    this.cache = null
  }
}
