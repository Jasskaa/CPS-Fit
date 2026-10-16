// Formato de dinero y fechas (zona horaria del club) y utilidades de edad.
export const CLUB_TZ = 'Europe/Madrid'

export function eur(cents: number | null | undefined, locale = 'ca'): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'ca-ES', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100)
}

export function fmtDate(d: string | Date, locale = 'ca', opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(d).toLocaleDateString(locale === 'es' ? 'es-ES' : 'ca-ES', { timeZone: CLUB_TZ, ...opts })
}

export function fmtTime(d: string | Date, locale = 'ca'): string {
  return new Date(d).toLocaleTimeString(locale === 'es' ? 'es-ES' : 'ca-ES', { timeZone: CLUB_TZ, hour: '2-digit', minute: '2-digit' })
}

export function fmtDateTime(d: string | Date, locale = 'ca'): string {
  return `${fmtDate(d, locale, { day: 'numeric', month: 'short' })} · ${fmtTime(d, locale)}`
}

/** Fecha y hora "de pared" del club para un instante (día de la semana 0 = domingo, hora fraccionaria). */
export function clubParts(d: Date | string, tz = CLUB_TZ) {
  const dt = typeof d === 'string' ? new Date(d) : d
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
  const p = Object.fromEntries(f.formatToParts(dt).map((x) => [x.type, x.value]))
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return { date: `${p.year}-${p.month}-${p.day}`, dow, hour: Number(p.hour) + Number(p.minute) / 60, hh: Number(p.hour), mm: Number(p.minute) }
}

/** Instante UTC a partir de una fecha local del club (YYYY-MM-DD) y una hora (HH:MM). */
export function clubInstant(date: string, time: string, tz = CLUB_TZ): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm))
  const asClub = clubParts(guess, tz)
  const diff = (hh + mm / 60 - asClub.hour) * 3600_000 + (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${asClub.date}T00:00:00Z`))
  return new Date(guess.getTime() + diff)
}

export function ageOn(birth: string | Date, on: Date = new Date()): number {
  const b = new Date(birth)
  let age = on.getFullYear() - b.getFullYear()
  const m = on.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--
  return age
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')
}
