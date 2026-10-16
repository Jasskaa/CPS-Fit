'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionCtx, ilikeSafe, personSearch } from '@/lib/ctx'
import { createClient } from '@/lib/supabase/server'
import { STAFF_ROLES } from '@/lib/permissions'
import { requireRole } from '@/lib/auth'
import { validIban } from '@/modules/billing/sepa'
import { checkEligibility, nextAutoType } from '@/modules/membership/rules'

type R = { ok: boolean; error?: string; id?: string }

/** Búsqueda rápida para la paleta de comandos (RLS limita lo que se ve). */
export async function searchPeopleAction(q: string): Promise<{ id: string; name: string; sub: string }[]> {
  await requireRole(STAFF_ROLES)
  const s = ilikeSafe(q)
  if (s.length < 2) return []
  const supabase = await createClient()
  const { data } = await personSearch(supabase.from('people').select('id, first_name, last_name, email, status'), s).order('last_name').limit(8)
  return (data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, sub: p.email ?? p.status }))
}

const personSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(100),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().trim().email().or(z.literal('')).optional(),
  phone: z.string().trim().max(30).optional(),
  national_id: z.string().trim().max(20).optional(),
  address: z.string().trim().max(200).optional(),
  postal_code: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(2000).optional(),
})

const nul = (v: string | undefined) => (v && v.length ? v : null)

/** Comprueba las reglas del tipo de socio (edad, pareja, adulto responsable, antigüedad) contra la persona y su hogar. */
async function eligibility(supabase: Awaited<ReturnType<typeof actionCtx>>['supabase'], typeCode: string, person: { birth_date: string; household_id: string | null; id?: string }, seniorityYears = 0) {
  const { data: ty } = await supabase.from('membership_types').select('code, min_age, max_age, needs_adult_link, needs_pair, min_seniority_years, retiree').eq('code', typeCode).single()
  if (!ty) return { ok: false, reasons: ['type'] }
  let adult = false, pair = false
  if (person.household_id) {
    const { data: hh } = await supabase.from('people').select('id, birth_date, household_role').eq('household_id', person.household_id)
    const others = (hh ?? []).filter((x) => x.id !== person.id)
    adult = others.some((x) => x.household_role === 'holder' || x.household_role === 'partner')
    pair = others.some((x) => x.household_role === 'partner' || x.household_role === 'holder')
  }
  return checkEligibility(ty, { birth_date: person.birth_date, seniority_years: seniorityYears, has_adult_link: adult, has_pair: pair })
}

export async function createPerson(fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('people')
  const p = personSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { ok: false, error: 'invalid' }
  const typeCode = String(fd.get('type_code') ?? '')
  const { data, error } = await supabase.from('people').insert({
    ...p.data, email: nul(p.data.email), phone: nul(p.data.phone), national_id: nul(p.data.national_id), address: nul(p.data.address),
    postal_code: nul(p.data.postal_code), notes: nul(p.data.notes), household_id: nul(String(fd.get('household_id') ?? '')),
    consent_at: fd.get('consent') ? new Date().toISOString() : null, consent_data: Boolean(fd.get('consent')),
  }).select('id').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'error' }
  if (typeCode) {
    const el = await eligibility(supabase, typeCode, { birth_date: p.data.birth_date, household_id: nul(String(fd.get('household_id') ?? '')), id: data.id })
    if (!el.ok) { await supabase.from('people').delete().eq('id', data.id); return { ok: false, error: `rule:${el.reasons.join(',')}` } }
    const { data: ty } = await supabase.from('membership_types').select('id').eq('code', typeCode).single()
    if (ty) await supabase.from('memberships').insert({ person_id: data.id, type_id: ty.id, status: 'active', started_on: new Date().toISOString().slice(0, 10), seniority_since: new Date().toISOString().slice(0, 10), approved_by: userId })
  }
  revalidatePath('/admin/persones')
  return { ok: true, id: data.id }
}

export async function updatePerson(id: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('people')
  const p = personSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('people').update({
    ...p.data, email: nul(p.data.email), phone: nul(p.data.phone), national_id: nul(p.data.national_id), address: nul(p.data.address),
    postal_code: nul(p.data.postal_code), notes: nul(p.data.notes), marketing_ok: Boolean(fd.get('marketing_ok')),
  }).eq('id', id)
  revalidatePath(`/admin/persones/${id}`)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function setPersonStatus(id: string, status: 'active' | 'paused' | 'left' | 'prospect'): Promise<R> {
  const { supabase } = await actionCtx('people')
  const { error } = await supabase.from('people').update({ status }).eq('id', id)
  revalidatePath(`/admin/persones/${id}`)
  revalidatePath('/admin/persones')
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Cambia el tipo de socio: cierra la membresía vigente y abre una nueva. */
export async function changeMembership(personId: string, fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('people')
  const typeCode = String(fd.get('type') ?? '')
  const today = new Date().toISOString().slice(0, 10)
  const { data: ty } = await supabase.from('membership_types').select('id').eq('code', typeCode).single()
  if (!ty) return { ok: false, error: 'type' }
  const { data: cur } = await supabase.from('memberships').select('id, seniority_since, billable').eq('person_id', personId).eq('status', 'active').maybeSingle()
  const { data: who } = await supabase.from('people').select('birth_date, household_id').eq('id', personId).single()
  if (who) {
    const years = cur?.seniority_since ? (Date.now() - new Date(cur.seniority_since).getTime()) / 31557600000 : 0
    const el = await eligibility(supabase, typeCode, { ...who, id: personId }, years)
    if (!el.ok) return { ok: false, error: `rule:${el.reasons.join(',')}` }
  }
  if (cur) await supabase.from('memberships').update({ status: 'ended', ended_on: today }).eq('id', cur.id)
  const { error } = await supabase.from('memberships').insert({ person_id: personId, type_id: ty.id, status: 'active', started_on: today, seniority_since: cur?.seniority_since ?? today, billable: cur?.billable ?? true, approved_by: userId })
  revalidatePath(`/admin/persones/${personId}`)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function addAccessOverride(personId: string, fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('access')
  const parsed = z.object({ zone_id: z.string().uuid(), allow: z.enum(['true', 'false']), reason: z.string().trim().min(2).max(200), until: z.string().optional() }).safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('access_overrides').insert({ person_id: personId, zone_id: parsed.data.zone_id, allow: parsed.data.allow === 'true', reason: parsed.data.reason, until: nul(parsed.data.until), created_by: userId })
  revalidatePath(`/admin/persones/${personId}`)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function removeAccessOverride(personId: string, id: string): Promise<R> {
  const { supabase } = await actionCtx('access')
  await supabase.from('access_overrides').delete().eq('id', id)
  revalidatePath(`/admin/persones/${personId}`)
  return { ok: true }
}

/** Domiciliación bancaria: el IBAN solo lo gestiona administración. */
export async function saveBankAccount(personId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('settings')
  const iban = String(fd.get('iban') ?? '').replace(/\s+/g, '').toUpperCase()
  if (!validIban(iban)) return { ok: false, error: 'iban' }
  const holder = String(fd.get('holder_name') ?? '').trim()
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('bank_accounts').upsert({ person_id: personId, iban, holder_name: holder || null, mandate_id: `CPS-${personId.slice(0, 8).toUpperCase()}`, mandate_signed_on: today })
  revalidatePath(`/admin/persones/${personId}`)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Solicitudes de alta: aprobar crea la membresía y activa a la persona. */
export async function decideRequest(id: string, approve: boolean, reason?: string): Promise<R> {
  const { supabase, userId } = await actionCtx('people')
  const { data: rq } = await supabase.from('membership_requests').select('*').eq('id', id).single()
  if (!rq) return { ok: false, error: 'not_found' }
  if (approve) {
    const today = new Date().toISOString().slice(0, 10)
    const applicant = rq.applicant as { first_name?: string; last_name?: string; birth_date?: string; email?: string; phone?: string }
    if (applicant?.first_name && applicant?.last_name && applicant?.birth_date) {
      const { data: person } = await supabase.from('people').insert({ first_name: applicant.first_name, last_name: applicant.last_name, birth_date: applicant.birth_date, email: applicant.email ?? null, phone: applicant.phone ?? null, status: 'active' }).select('id').single()
      const { data: ty } = await supabase.from('membership_types').select('id').eq('code', rq.type_code).single()
      if (person && ty) await supabase.from('memberships').insert({ person_id: person.id, type_id: ty.id, status: 'active', started_on: today, seniority_since: today, approved_by: userId })
    }
  }
  await supabase.from('membership_requests').update({ status: approve ? 'approved' : 'rejected', decided_by: userId, decided_at: new Date().toISOString(), reason: reason ?? null }).eq('id', id)
  revalidatePath('/admin/persones')
  return { ok: true }
}

/** Cambios automáticos de categoría por cumpleaños: Adherit→Jove a los 18 y Jove→Individual a los 24. */
export async function applyAutoTypeChanges(): Promise<R & { count?: number }> {
  const { supabase, userId } = await actionCtx('people')
  const { data: mems } = await supabase.from('memberships').select('id, person_id, seniority_since, billable, membership_types(code), people(birth_date)').eq('status', 'active')
  const { data: types } = await supabase.from('membership_types').select('id, code')
  const today = new Date().toISOString().slice(0, 10)
  let count = 0
  for (const m of mems ?? []) {
    const code = (m.membership_types as unknown as { code: string }).code
    const next = nextAutoType(code, (m.people as unknown as { birth_date: string }).birth_date)
    const target = next && types?.find((x) => x.code === next)
    if (!target) continue
    await supabase.from('memberships').update({ status: 'ended', ended_on: today }).eq('id', m.id)
    await supabase.from('memberships').insert({ person_id: m.person_id, type_id: target.id, status: 'active', started_on: today, seniority_since: m.seniority_since, billable: m.billable, approved_by: userId })
    count++
  }
  revalidatePath('/admin/persones')
  return { ok: true, count }
}

export async function previewAutoTypeChanges(): Promise<number> {
  const { supabase } = await actionCtx('people')
  const { data: mems } = await supabase.from('memberships').select('membership_types(code), people(birth_date)').eq('status', 'active')
  return (mems ?? []).filter((m) => nextAutoType((m.membership_types as unknown as { code: string }).code, (m.people as unknown as { birth_date: string }).birth_date)).length
}
