import { Injectable, Logger } from '@nestjs/common'

export interface HolidayItem {
  date: string
  name: string
  type: string
}

interface CacheEntry {
  data: HolidayItem[]
  fetchedAt: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 jam

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name)
  private readonly cache = new Map<number, CacheEntry>()

  async getHolidays(start: string, end: string): Promise<HolidayItem[]> {
    const apiKey = process.env.HOLIDAY_API_KEY
    if (!apiKey) {
      this.logger.debug('HOLIDAY_API_KEY not set, skipping holiday fetch')
      return []
    }

    // Kumpulkan tahun yang dicakup range
    const startYear = new Date(start).getFullYear()
    const endYear = new Date(end).getFullYear()
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)

    const allHolidays: HolidayItem[] = []

    for (const year of years) {
      const cached = this.cache.get(year)
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        allHolidays.push(...cached.data)
        continue
      }

      try {
        const yearStart = `${year}-01-01`
        const yearEnd = `${year}-12-31`
        const url = new URL('https://use.api.co.id/holidays/indonesia/')
        url.searchParams.set('start_date', yearStart)
        url.searchParams.set('end_date', yearEnd)
        // Hanya Public Holiday dan National Holiday
        url.searchParams.append('type[]', 'Public Holiday')
        url.searchParams.append('type[]', 'National Holiday')

        const res = await fetch(url.toString(), {
          headers: { 'x-api-co-id': apiKey },
        })

        if (!res.ok) {
          this.logger.warn(`Holiday API returned ${res.status} for year ${year}`)
          continue
        }

        const json: any = await res.json()
        const items: HolidayItem[] = (json?.data ?? []).map((h: any) => ({
          date: h.date as string,
          name: h.name as string,
          type: h.type as string,
        }))

        this.cache.set(year, { data: items, fetchedAt: Date.now() })
        allHolidays.push(...items)
      } catch (err: any) {
        this.logger.error(`Failed to fetch holidays for year ${year}: ${err?.message}`)
      }
    }

    // Filter ke range yang diminta
    return allHolidays.filter(h => h.date >= start && h.date <= end)
  }
}
