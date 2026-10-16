'use server'

import { revalidatePath } from 'next/cache'
import { actionCtx, ilikeSafe } from '@/lib/ctx'
import { ageOn } from '@/lib/format'
import { verifyCardToken } from '@/modules/access/qr'
import { decideZone, loadAccessConfig, loadSubject } from '@/modules/access/server'

export interface AccessResult {
  ok: boolean
  allowed?: boolean
  reason?: string
  name?: string
  age?: number
  type?: string | null
  personId?: string
  zone?: string
  direction?: 'in' | 'out'
  error?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Valida una entrada/salida. `code` puede ser el token del QR, el número de carnet o el id de persona. */
export async function checkAccess(code: string, zoneId: string, direction: 'in' | 'out'): Promise<AccessResult> {
  const { supabase, userId } = await actionCtx('access')
  const clean = code.trim()
  if (!clean) return { ok: false, error: 'empty' }

  let personId: string | null = null
  let method = 'manual'
  if (clean.split('.').length === 3) {
    const secret = process.env.CARD_QR_SECRET
    if (!secret) return { ok: false, error: 'not_configured' }
    personId = await verifyCardToken(secret, clean)
    method = 'qr'
    if (!personId) return { ok: false, error: 'invalid_qr' }
  } else if (UUID.test(clean)) {
    personId = clean
  } else {
    const { data: card } = await supabase.from('cards').select('person_id, status').eq('number', clean).maybeSingle()
    if (card) { personId = card.person_id; method = 'card'; if (card.status !== 'active') return { ok: true, allowed: false, reason: 'blocked', personId: personId ?? undefined } }
  }
  if (!personId) return { ok: false, error: 'not_found' }

  const { data: person } = await supabase.from('people').select('id, first_name, last_name, birth_date').eq('id', personId).maybeSingle()
  if (!person) return { ok: false, error: 'not_found' }

  const cfg = await loadAccessConfig(supabase)
  const zone = cfg.zones.find((z) => z.id === zoneId)
  if (!zone) return { ok: false, error: 'zone' }
  const { subject, overrides } = await loadSubject(supabase, personId, cfg.cfg)
  const { data: pres } = await supabase.from('zone_presence').select('present').eq('zone_id', zoneId).maybeSingle()
  // Una salida nunca se deniega: siempre se registra.
  const d = direction === 'out'
    ? { allowed: true, reason: 'ok' as const }
    : decideZone(cfg.rules, zone, subject, overrides, new Date(), { current: pres?.present ?? 0, capacity: zone.capacity })

  await supabase.from('access_logs').insert({ person_id: personId, zone_id: zoneId, direction, allowed: d.allowed, reason: d.reason, method, operator_id: userId })
  revalidatePath('/admin/acces')
  return { ok: true, allowed: d.allowed, reason: d.reason, name: `${person.first_name} ${person.last_name}`, age: ageOn(person.birth_date), type: subject.membership_type_code, personId, zone: zone.code, direction }
}

/** Búsqueda para el modo manual de recepción. */
export async function findForReception(q: string) {
  const { supabase } = await actionCtx('access')
  const s = ilikeSafe(q)
  if (s.length < 2) return []
  const { data } = await supabase.from('people').select('id, first_name, last_name, birth_date').or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,national_id.ilike.%${s}%`).eq('status', 'active').order('last_name').limit(6)
  return (data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, age: ageOn(p.birth_date) }))
}
