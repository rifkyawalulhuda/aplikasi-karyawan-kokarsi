/**
 * Cache in-memory sederhana dengan TTL.
 * Cocok untuk data yang jarang berubah seperti dashboard stats.
 */
export class SimpleCache<T> {
  private cache = new Map<string, { data: T; expiresAt: number }>()

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  set(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
