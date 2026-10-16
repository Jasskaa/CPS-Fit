'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionCtx, ilikeSafe, personSearch } from '@/lib/ctx'
import { clubInstant } from '@/lib/format'

type R = { ok: boolean; error?: string; id?: string }
const nul = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s ? s : null }
const done = (error?: { message: string } | null, id?: string): R => (error ? { ok: false, error: error.message } : { ok: true, id })

export async function updateSection(id: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const { error } = await supabase.from('sections').update({
    description_ca: nul(fd.get('description_ca')), description_es: nul(fd.get('description_es')), email: nul(fd.get('email')),
    discount_pct: Math.min(100, Math.max(0, Number(fd.get('discount_pct')) || 0)),
  }).eq('id', id)
  revalidatePath(`/admin/seccions/${id}`)
  return done(error)
}

export async function createTeam(sectionId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const { data: season } = await supabase.from('seasons').select('id').eq('is_current', true).maybeSingle()
  const name = String(fd.get('name') ?? '').trim()
  if (!name || !season) return { ok: false, error: 'invalid' }
  const gender = String(fd.get('gender') ?? '')
  const { data, error } = await supabase.from('teams').insert({
    section_id: sectionId, season_id: season.id, name, category: nul(fd.get('category')), league: nul(fd.get('league')),
    gender: ['m', 'f', 'mixed'].includes(gender) ? gender : null,
  }).select('id').single()
  revalidatePath(`/admin/seccions/${sectionId}`)
  return done(error, data?.id)
}

export async function searchForTeam(q: string) {
  const { supabase } = await actionCtx('sections')
  const s = ilikeSafe(q)
  if (s.length < 2) return []
  const { data } = await personSearch(supabase.from('people').select('id, first_name, last_name, birth_date'), s).eq('status', 'active').order('last_name').limit(8)
  return (data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, birth: p.birth_date }))
}

export async function addTeamMember(teamId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const personId = z.string().uuid().safeParse(fd.get('person_id'))
  if (!personId.success) return { ok: false, error: 'invalid' }
  const role = ['player', 'coach', 'coordinator', 'staff'].includes(String(fd.get('role'))) ? String(fd.get('role')) : 'player'
  const shirt = Number(fd.get('shirt_number'))
  const { error } = await supabase.from('team_members').upsert({ team_id: teamId, person_id: personId.data, role, shirt_number: Number.isFinite(shirt) && shirt > 0 ? shirt : null })
  revalidatePath(`/admin/seccions/equip/${teamId}`)
  return done(error)
}

export async function removeTeamMember(teamId: string, personId: string): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('person_id', personId)
  revalidatePath(`/admin/seccions/equip/${teamId}`)
  return done(error)
}

export async function toggleTeamFlag(teamId: string, personId: string, flag: 'medical_ok' | 'photo_auth', value: boolean): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const { error } = await supabase.from('team_members').update({ [flag]: value }).eq('team_id', teamId).eq('person_id', personId)
  revalidatePath(`/admin/seccions/equip/${teamId}`)
  return done(error)
}

export async function createTeamEvent(teamId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const p = z.object({ kind: z.enum(['training', 'match', 'trip', 'other']), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')) }).safeParse(Object.fromEntries(fd))
  if (!p.success) return { ok: false, error: 'invalid' }
  const { data, error } = await supabase.from('team_events').insert({
    team_id: teamId, kind: p.data.kind, title: nul(fd.get('title')), starts_at: clubInstant(p.data.date, p.data.start).toISOString(),
    ends_at: p.data.end ? clubInstant(p.data.date, p.data.end).toISOString() : null, location: nul(fd.get('location')), opponent: nul(fd.get('opponent')),
    is_home: fd.get('is_home') === 'on' ? true : fd.get('is_home') === 'away' ? false : null,
  }).select('id').single()
  if (!error && data) {
    // Convocatoria: todos los jugadores quedan "pendientes de confirmar".
    const { data: roster } = await supabase.from('team_members').select('person_id').eq('team_id', teamId).eq('role', 'player')
    if (roster?.length) await supabase.from('team_attendance').insert(roster.map((r) => ({ event_id: data.id, person_id: r.person_id })))
  }
  revalidatePath(`/admin/seccions/equip/${teamId}`)
  return done(error, data?.id)
}

export async function setAttendance(teamId: string, eventId: string, personId: string, status: string): Promise<R> {
  const { supabase } = await actionCtx('sections')
  if (!['unknown', 'yes', 'no', 'maybe', 'present', 'absent'].includes(status)) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('team_attendance').upsert({ event_id: eventId, person_id: personId, status })
  revalidatePath(`/admin/seccions/equip/${teamId}`)
  return done(error)
}

export async function saveScore(teamId: string, eventId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const n = (k: string) => { const v = fd.get(k); return v === '' || v == null ? null : Math.max(0, Math.round(Number(v))) }
  const { error } = await supabase.from('team_events').update({ score_for: n('score_for'), score_against: n('score_against') }).eq('id', eventId)
  revalidatePath(`/admin/seccions/equip/${teamId}`)
  return done(error)
}

// ───────── Esdeveniments del club ─────────

export async function createClubEvent(fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const p = z.object({ title_ca: z.string().trim().min(2).max(140), kind: z.enum(['event', 'campus', 'course', 'race', 'casal']), starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(Object.fromEntries(fd))
  if (!p.success) return { ok: false, error: 'invalid' }
  const slug = `${p.data.title_ca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${p.data.starts_on.slice(0, 4)}`
  const cents = (k: string) => Math.round(Number(String(fd.get(k) ?? '0').replace(',', '.')) * 100) || 0
  const { data, error } = await supabase.from('club_events').insert({
    slug, kind: p.data.kind, title_ca: p.data.title_ca, title_es: nul(fd.get('title_es')) ?? p.data.title_ca, description_ca: nul(fd.get('description_ca')), location: nul(fd.get('location')),
    starts_on: p.data.starts_on, ends_on: nul(fd.get('ends_on')), capacity: Number(fd.get('capacity')) || null, price_member_cents: cents('price_member'), price_non_member_cents: cents('price_non_member'),
    section_id: nul(fd.get('section_id')),
  }).select('id').single()
  revalidatePath('/admin/seccions')
  return done(error, data?.id)
}

export async function toggleRegistration(eventId: string, open: boolean): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const { error } = await supabase.from('club_events').update({ registration_open: open }).eq('id', eventId)
  revalidatePath(`/admin/seccions/esdeveniment/${eventId}`)
  return done(error)
}

export async function registerPerson(eventId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const personId = z.string().uuid().safeParse(fd.get('person_id'))
  if (!personId.success) return { ok: false, error: 'invalid' }
  const { data: ev } = await supabase.from('club_events').select('capacity, price_member_cents, price_non_member_cents, title_ca').eq('id', eventId).single()
  if (!ev) return { ok: false, error: 'not_found' }
  const { count } = await supabase.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'registered')
  const status = ev.capacity && (count ?? 0) >= ev.capacity ? 'waitlist' : 'registered'
  const { data: mem } = await supabase.from('memberships').select('id').eq('person_id', personId.data).eq('status', 'active').limit(1).maybeSingle()
  const price = mem ? ev.price_member_cents : ev.price_non_member_cents
  let invoiceId: string | null = null
  if (status === 'registered' && price > 0) {
    const { data: inv } = await supabase.from('invoices').insert({ person_id: personId.data, kind: 'other', status: 'pending', source: 'event', notes: ev.title_ca }).select('id').single()
    if (inv) { invoiceId = inv.id; await supabase.from('invoice_lines').insert({ invoice_id: inv.id, description: `Inscripció: ${ev.title_ca}`, qty: 1, unit_cents: price }) }
  }
  const { error } = await supabase.from('event_registrations').insert({ event_id: eventId, person_id: personId.data, status, invoice_id: invoiceId })
  revalidatePath(`/admin/seccions/esdeveniment/${eventId}`)
  return done(error)
}

export async function saveResult(eventId: string, regId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const parseTime = (s: string) => { const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/); return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null }
  const { error } = await supabase.from('event_registrations').update({
    bib: Number(fd.get('bib')) || null, result_seconds: parseTime(String(fd.get('time') ?? '')), result_position: Number(fd.get('position')) || null,
  }).eq('id', regId)
  revalidatePath(`/admin/seccions/esdeveniment/${eventId}`)
  return done(error)
}

export async function cancelRegistration(eventId: string, regId: string): Promise<R> {
  const { supabase } = await actionCtx('sections')
  const { error } = await supabase.from('event_registrations').update({ status: 'cancelled' }).eq('id', regId)
  revalidatePath(`/admin/seccions/esdeveniment/${eventId}`)
  return done(error)
}
