import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateAccess, type AccessRule, type AccessSubject, type Decision } from './evaluate'

export interface ZoneRow { id: string; code: string; name_ca: string; name_es: string; kind: string; capacity: number | null; color: string | null }
export interface Override { zone_id: string; allow: boolean; reason: string; until: string | null; id: string }

export async function loadAccessConfig(supabase: SupabaseClient) {
  const [zones, rules, settings] = await Promise.all([
    supabase.from('zones').select('id, code, name_ca, name_es, kind, capacity, color').eq('active', true).order('sort'),
    supabase.from('access_rules').select('*, zones(code)'),
    supabase.from('settings').select('value').eq('key', 'access').maybeSingle(),
  ])
  const zoneRows = (zones.data ?? []) as ZoneRow[]
  const ruleRows: AccessRule[] = (rules.data ?? []).map((r: Record<string, unknown>) => ({
    zone_code: (r.zones as { code: string }).code, audience: r.audience as AccessRule['audience'], membership_type_code: r.membership_type_code as string | null,
    weekdays: r.weekdays as number[], time_from: r.time_from as string | null, time_to: r.time_to as string | null, season_from: r.season_from as string | null,
    season_to: r.season_to as string | null, requires_booking: r.requires_booking as boolean, requires_pass_kind: r.requires_pass_kind as string | null, allow: r.allow as boolean,
  }))
  const cfg = (settings.data?.value ?? { debt_days: 30, block_on_debt: true }) as { debt_days: number; block_on_debt: boolean }
  return { zones: zoneRows, rules: ruleRows, cfg }
}

/** Reúne lo que la regla de acceso necesita saber de una persona. */
export async function loadSubject(supabase: SupabaseClient, personId: string, cfg: { debt_days: number; block_on_debt: boolean }, at = new Date()) {
  const nowIso = at.toISOString()
  const debtBefore = new Date(at.getTime() - cfg.debt_days * 86400000).toISOString().slice(0, 10)
  const [person, mem, debt, passes, bookings, overrides] = await Promise.all([
    supabase.from('people').select('status').eq('id', personId).single(),
    supabase.from('memberships').select('membership_types(code)').eq('person_id', personId).eq('status', 'active').limit(1).maybeSingle(),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('person_id', personId).in('status', ['overdue']).lte('due_on', debtBefore),
    supabase.from('passes').select('valid_until, uses_left, products(pass_kind)').eq('person_id', personId).eq('status', 'active'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('person_id', personId).eq('status', 'confirmed').lte('starts_at', nowIso).gt('ends_at', nowIso),
    supabase.from('access_overrides').select('id, zone_id, allow, reason, until').eq('person_id', personId),
  ])
  const code = ((mem.data as unknown as { membership_types: { code: string } | null } | null)?.membership_types?.code) ?? null
  const passKinds = ((passes.data ?? []) as unknown as { valid_until: string | null; uses_left: number | null; products: { pass_kind: string | null } | null }[])
    .filter((p) => (!p.valid_until || p.valid_until >= nowIso.slice(0, 10)) && (p.uses_left == null || p.uses_left > 0))
    .map((p) => p.products?.pass_kind).filter(Boolean) as string[]
  const subject: AccessSubject = {
    active: person.data?.status === 'active', is_member: Boolean(code), membership_type_code: code,
    has_debt: cfg.block_on_debt && (debt.count ?? 0) > 0, passes: passKinds, has_booking_now: (bookings.count ?? 0) > 0,
  }
  const live = ((overrides.data ?? []) as Override[]).filter((o) => !o.until || o.until >= nowIso.slice(0, 10))
  return { subject, overrides: live, allOverrides: (overrides.data ?? []) as Override[] }
}

/** Decisión final de una zona teniendo en cuenta las excepciones manuales. */
export function decideZone(
  rules: AccessRule[], zone: ZoneRow, subject: AccessSubject, overrides: Override[], at: Date, occupancy?: { current: number; capacity: number | null },
): Decision & { override?: Override } {
  const ov = overrides.find((o) => o.zone_id === zone.id)
  if (ov) return ov.allow ? { allowed: true, reason: 'ok', override: ov } : { allowed: false, reason: 'blocked', override: ov }
  return evaluateAccess(rules, zone.code, subject, at, occupancy)
}
