import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'

export function useDatePicker() {
  const dfLong = new DateFormatter('id-ID', { dateStyle: 'long' })

  function toCalDate(s: string | undefined | null): CalendarDate | null {
    if (!s) return null
    const clean = s.slice(0, 10) // strip ISO timestamp jika ada
    const [y, m, d] = clean.split('-').map(Number)
    if (!y || !m || !d) return null
    return new CalendarDate(y, m, d)
  }

  function fromCalDate(c: CalendarDate | null): string {
    if (!c) return ''
    return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`
  }

  function formatDisplay(c: CalendarDate | null): string {
    if (!c) return ''
    return dfLong.format(c.toDate(getLocalTimeZone()))
  }

  return { dfLong, toCalDate, fromCalDate, formatDisplay, getLocalTimeZone }
}
