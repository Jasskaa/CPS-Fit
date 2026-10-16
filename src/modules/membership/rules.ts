// Reglas de tipos de socio (edad, antigüedad, pareja, jubilado) y cambios automáticos de categoría.
import { ageOn } from '@/lib/format'

export interface MembershipType {
  code: string
  min_age?: number | null
  max_age?: number | null
  needs_adult_link?: boolean
  needs_pair?: boolean
  min_seniority_years?: number | null
  retiree?: boolean
}

export interface Applicant {
  birth_date: string
  seniority_years?: number
  has_adult_link?: boolean
  has_pair?: boolean
  empadronat?: boolean
}

export interface RuleResult { ok: boolean; reasons: string[] }

/** Reglas por código de reason: age_min, age_max, adult_link, pair, seniority, retiree_age. */
export function checkEligibility(type: MembershipType, p: Applicant, on: Date = new Date()): RuleResult {
  const reasons: string[] = []
  const age = ageOn(p.birth_date, on)
  if (type.min_age != null && age < type.min_age) reasons.push('age_min')
  if (type.max_age != null && age > type.max_age) reasons.push('age_max')
  if (type.needs_adult_link && !p.has_adult_link) reasons.push('adult_link')
  if (type.needs_pair && !p.has_pair) reasons.push('pair')
  if (type.min_seniority_years != null && (p.seniority_years ?? 0) < type.min_seniority_years) reasons.push('seniority')
  if (type.retiree && age < 65) reasons.push('retiree_age')
  return { ok: reasons.length === 0, reasons }
}

/** Cambio automático de categoría por cumpleaños: Adherit→Jove a los 18, Jove→Individual a los 24. */
export function nextAutoType(currentCode: string, birth_date: string, on: Date = new Date()): string | null {
  const age = ageOn(birth_date, on)
  if (currentCode === 'adherit' && age >= 18) return 'jove'
  if (currentCode === 'jove' && age >= 24) return 'individual'
  return null
}

/** Cuota anual de un hogar: el titular paga una sola vez la cuota familiar, el resto no se factura. */
export function householdFeeCents(types: { code: string; annual_fee_cents: number; billable: boolean }[]): number {
  return types.filter((t) => t.billable).reduce((a, t) => a + t.annual_fee_cents, 0)
}

/** Cuota de entrada: solo altas nuevas (no menores adheridos). */
export function entryFeeCents(typeCode: string, entryFee: number): number {
  return typeCode === 'adherit' || typeCode === 'honor' ? 0 : entryFee
}
