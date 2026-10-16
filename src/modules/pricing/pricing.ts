// Motor de precios de reservas. Refleja la función SQL private.booking_base_price (la base de datos es la fuente de verdad;
// este código sirve para mostrar el precio al instante en la interfaz y está testeado contra los mismos casos).
import { clubParts } from '@/lib/format'

export type Audience = 'member' | 'non_member'

export interface PricingRule {
  resource_kind: string
  audience: Audience
  weekdays: number[]
  hour_from: number
  hour_to: number
  price_cents_hour: number
  valid_from?: string | null
  valid_to?: string | null
}

export interface Slice { start: Date; cents: number; rate: number }

export const SLOT_MIN = 30

/** Precio por tramos de 30 min según la franja del reloj del club. El precio lo decide quien reserva (socio / no socio). */
export function priceSlices(rules: PricingRule[], kind: string, audience: Audience, start: Date, end: Date): Slice[] {
  const out: Slice[] = []
  for (let t = start.getTime(); t < end.getTime(); t += SLOT_MIN * 60_000) {
    const s = new Date(t)
    const { date, dow, hour } = clubParts(s)
    const rule = rules.find(
      (r) =>
        r.resource_kind === kind && r.audience === audience && r.weekdays.includes(dow) && hour >= r.hour_from && hour < r.hour_to &&
        (!r.valid_from || date >= r.valid_from) && (!r.valid_to || date <= r.valid_to),
    )
    const rate = rule?.price_cents_hour ?? 0
    out.push({ start: s, cents: Math.round(rate * (SLOT_MIN / 60)), rate })
  }
  return out
}

export function bookingPriceCents(rules: PricingRule[], kind: string, audience: Audience, start: Date, end: Date): number {
  return Math.round(priceSlices(rules, kind, audience, start, end).reduce((a, s) => a + s.rate * (SLOT_MIN / 60), 0))
}

/** Desglose agrupado por tarifa horaria: [{ rate, minutes, cents }] para explicar el precio al usuario. */
export function priceBreakdown(rules: PricingRule[], kind: string, audience: Audience, start: Date, end: Date) {
  const by = new Map<number, number>()
  for (const s of priceSlices(rules, kind, audience, start, end)) by.set(s.rate, (by.get(s.rate) ?? 0) + SLOT_MIN)
  return [...by.entries()].map(([rate, minutes]) => ({ rate, minutes, cents: Math.round(rate * (minutes / 60)) }))
}

export interface ExtraLine { qty: number; unit_cents: number }
export const extrasTotal = (lines: ExtraLine[]) => lines.reduce((a, l) => a + l.qty * l.unit_cents, 0)

/** Cancelación: ¿se puede cancelar sin penalización? */
export function canCancel(start: Date, now: Date, cancelHours: number): boolean {
  return start.getTime() - now.getTime() >= cancelHours * 3600_000
}
