// Evaluación de acceso: función pura. Decide verde/rojo con un motivo legible para recepción.
import { clubParts } from '@/lib/format'

export interface AccessRule {
  zone_code: string
  audience: 'member' | 'non_member' | 'pass_holder'
  membership_type_code?: string | null
  weekdays: number[]
  time_from?: string | null
  time_to?: string | null
  season_from?: string | null
  season_to?: string | null
  requires_booking?: boolean
  requires_pass_kind?: string | null
  allow: boolean
}

export interface AccessSubject {
  active: boolean
  is_member: boolean
  membership_type_code?: string | null
  has_debt: boolean
  blocked?: boolean
  passes?: string[]
  has_booking_now?: boolean
}

export type Reason = 'ok' | 'inactive' | 'blocked' | 'debt' | 'no_rule' | 'denied' | 'closed' | 'needs_booking' | 'needs_pass' | 'capacity'
export interface Decision { allowed: boolean; reason: Reason }

const toH = (t?: string | null) => (t ? Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 : null)

export function evaluateAccess(rules: AccessRule[], zone: string, who: AccessSubject, at: Date, occupancy?: { current: number; capacity: number | null }): Decision {
  if (!who.active) return { allowed: false, reason: 'inactive' }
  if (who.blocked) return { allowed: false, reason: 'blocked' }
  if (who.has_debt && zone !== 'reception') return { allowed: false, reason: 'debt' }
  const { date, dow, hour } = clubParts(at)
  const zoneRules = rules.filter((r) => r.zone_code === zone)
  const applicable = zoneRules.filter((r) => {
    const aud = who.is_member ? r.audience === 'member' : r.audience === 'non_member'
    const pass = r.audience === 'pass_holder' && (who.passes ?? []).includes(r.requires_pass_kind ?? '')
    if (!aud && !pass) return false
    if (r.membership_type_code && r.membership_type_code !== who.membership_type_code) return false
    return true
  })
  if (applicable.length === 0) return { allowed: false, reason: zoneRules.length ? 'denied' : 'no_rule' }
  const open = applicable.filter((r) => {
    if (!r.weekdays.includes(dow)) return false
    const f = toH(r.time_from), t = toH(r.time_to)
    if (f != null && hour < f) return false
    if (t != null && hour >= t) return false
    if (r.season_from && date < r.season_from) return false
    if (r.season_to && date > r.season_to) return false
    return true
  })
  if (open.length === 0) return { allowed: false, reason: 'closed' }
  const winner = open.find((r) => !r.allow)
  if (winner) return { allowed: false, reason: 'denied' }
  const ok = open.find((r) => !r.requires_booking || who.has_booking_now)
  if (!ok) return { allowed: false, reason: 'needs_booking' }
  if (occupancy && occupancy.capacity != null && occupancy.current >= occupancy.capacity) return { allowed: false, reason: 'capacity' }
  return { allowed: true, reason: 'ok' }
}
