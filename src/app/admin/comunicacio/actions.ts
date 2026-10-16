'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionCtx } from '@/lib/ctx'

type R = { ok: boolean; error?: string; id?: string; count?: number }
const nul = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s ? s : null }
const done = (error?: { message: string } | null, id?: string): R => (error ? { ok: false, error: error.message } : { ok: true, id })
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

// ───────── Noticias ─────────
export async function saveNews(id: string | null, fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('comms')
  const p = z.object({ title_ca: z.string().trim().min(2).max(160), status: z.enum(['draft', 'scheduled', 'published']), category: z.string().trim().min(2).max(30), audience: z.enum(['all', 'members']) }).safeParse(Object.fromEntries(fd))
  if (!p.success) return { ok: false, error: 'invalid' }
  const row = {
    title_ca: p.data.title_ca, title_es: nul(fd.get('title_es')) ?? p.data.title_ca, excerpt_ca: nul(fd.get('excerpt_ca')), excerpt_es: nul(fd.get('excerpt_es')) ?? nul(fd.get('excerpt_ca')),
    body_ca: nul(fd.get('body_ca')), body_es: nul(fd.get('body_es')) ?? nul(fd.get('body_ca')), category: p.data.category, audience: p.data.audience, status: p.data.status,
    pinned: fd.get('pinned') === 'on', published_at: nul(fd.get('published_at')) ? new Date(String(fd.get('published_at'))).toISOString() : p.data.status === 'published' ? new Date().toISOString() : null, cover_url: nul(fd.get('cover_url')),
  }
  const q = id ? supabase.from('news').update(row).eq('id', id).select('id').single() : supabase.from('news').insert({ ...row, slug: `${slugify(p.data.title_ca)}-${Date.now().toString(36).slice(-4)}`, author_id: userId }).select('id').single()
  const { data, error } = await q
  revalidatePath('/admin/comunicacio')
  return done(error, data?.id)
}
export async function deleteNews(id: string): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const { error } = await supabase.from('news').delete().eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}

// ───────── Avisos segmentados ─────────
export async function createAnnouncement(fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('comms')
  const p = z.object({ title_ca: z.string().trim().min(2).max(140), body_ca: z.string().trim().min(2).max(1000), audience: z.enum(['all', 'members', 'section', 'team']) }).safeParse(Object.fromEntries(fd))
  if (!p.success) return { ok: false, error: 'invalid' }
  const ref = p.data.audience === 'section' ? nul(fd.get('section_ref')) : p.data.audience === 'team' ? nul(fd.get('team_ref')) : null
  if ((p.data.audience === 'section' || p.data.audience === 'team') && !ref) return { ok: false, error: 'invalid' }
  const { data: a, error } = await supabase.from('announcements').insert({
    title_ca: p.data.title_ca, title_es: nul(fd.get('title_es')) ?? p.data.title_ca, body_ca: p.data.body_ca, body_es: nul(fd.get('body_es')) ?? p.data.body_ca,
    audience: p.data.audience, audience_ref: ref, pinned: fd.get('pinned') === 'on', ends_at: nul(fd.get('ends_at')) ? new Date(String(fd.get('ends_at'))).toISOString() : null, created_by: userId,
  }).select('id').single()
  if (error || !a) return done(error)
  // Notificación simulada (push) a la audiencia segmentada.
  let people: string[] = []
  if (p.data.audience === 'all') { const { data } = await supabase.from('people').select('id').eq('status', 'active').limit(2000); people = (data ?? []).map((x) => x.id) }
  else if (p.data.audience === 'members') { const { data } = await supabase.from('memberships').select('person_id').eq('status', 'active').limit(2000); people = [...new Set((data ?? []).map((x) => x.person_id))] }
  else if (p.data.audience === 'team') { const { data } = await supabase.from('team_members').select('person_id').eq('team_id', ref!); people = (data ?? []).map((x) => x.person_id) }
  else { const { data } = await supabase.from('team_members').select('person_id, teams!inner(section_id)').eq('teams.section_id', ref!); people = [...new Set((data ?? []).map((x) => x.person_id))] }
  if (people.length && fd.get('notify') === 'on') {
    for (let i = 0; i < people.length; i += 500) await supabase.from('notifications').insert(people.slice(i, i + 500).map((pid) => ({ person_id: pid, channel: 'push', title: p.data.title_ca, body: p.data.body_ca.slice(0, 200), url: '/app' })))
  }
  revalidatePath('/admin/comunicacio')
  return { ok: true, id: a.id, count: fd.get('notify') === 'on' ? people.length : 0 }
}
export async function deleteAnnouncement(id: string): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}

// ───────── Bandeja de mensajes ─────────
export async function replyMessage(id: string, fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('comms')
  const body = String(fd.get('body') ?? '').trim()
  if (body.length < 2) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('message_replies').insert({ message_id: id, author_id: userId, body })
  if (error) return done(error)
  const { data: m } = await supabase.from('messages').select('person_id, subject, status').eq('id', id).single()
  if (m?.status === 'new') await supabase.from('messages').update({ status: 'open', assigned_to: userId }).eq('id', id)
  if (m?.person_id) await supabase.from('notifications').insert({ person_id: m.person_id, channel: 'push', title: 'Resposta del club', body: body.slice(0, 160), url: '/app/club' })
  revalidatePath('/admin/comunicacio')
  return { ok: true }
}
export async function setMessageStatus(id: string, status: 'new' | 'open' | 'closed'): Promise<R> {
  const { supabase, userId } = await actionCtx('comms')
  const { error } = await supabase.from('messages').update({ status, assigned_to: userId }).eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}

// ───────── Encuestas ─────────
export async function createPoll(fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const question = String(fd.get('question_ca') ?? '').trim()
  const options = String(fd.get('options') ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8)
  if (question.length < 3 || options.length < 2) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('polls').insert({ question_ca: question, question_es: nul(fd.get('question_es')) ?? question, options, closes_at: nul(fd.get('closes_at')) ? new Date(String(fd.get('closes_at'))).toISOString() : null })
  revalidatePath('/admin/comunicacio')
  return done(error)
}
export async function deletePoll(id: string): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const { error } = await supabase.from('polls').delete().eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}

// ───────── Incidencias y tareas ─────────
export async function createTask(fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('comms')
  const p = z.object({ title: z.string().trim().min(3).max(160), kind: z.enum(['incident', 'maintenance', 'task']), priority: z.enum(['low', 'normal', 'high', 'urgent']) }).safeParse(Object.fromEntries(fd))
  if (!p.success) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('facility_tasks').insert({ ...p.data, description: nul(fd.get('description')), zone_id: nul(fd.get('zone_id')), due_on: nul(fd.get('due_on')), reported_by: userId })
  revalidatePath('/admin/comunicacio')
  return done(error)
}
export async function setTaskStatus(id: string, status: 'open' | 'in_progress' | 'resolved'): Promise<R> {
  const { supabase, userId } = await actionCtx('comms')
  const { error } = await supabase.from('facility_tasks').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null, assigned_to: userId }).eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}
export async function setInventoryQty(id: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const qty = Math.max(0, Math.round(Number(fd.get('qty'))))
  const { error } = await supabase.from('inventory_items').update({ qty }).eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}

// ───────── Historia y galería ─────────
export async function saveHistory(fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const year = Number(fd.get('year')), title = String(fd.get('title_ca') ?? '').trim()
  if (!year || title.length < 2) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('club_history').insert({ year, title_ca: title, title_es: nul(fd.get('title_es')) ?? title, body_ca: nul(fd.get('body_ca')), body_es: nul(fd.get('body_es')) ?? nul(fd.get('body_ca')) })
  revalidatePath('/admin/comunicacio')
  return done(error)
}
export async function deleteHistory(id: string): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const { error } = await supabase.from('club_history').delete().eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}
export async function addPhoto(fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const url = String(fd.get('url') ?? '').trim()
  if (!/^https?:\/\//.test(url)) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('gallery_photos').insert({ url, album: nul(fd.get('album')) ?? 'General', caption: nul(fd.get('caption')), taken_on: nul(fd.get('taken_on')) })
  revalidatePath('/admin/comunicacio')
  return done(error)
}
export async function deletePhoto(id: string): Promise<R> {
  const { supabase } = await actionCtx('comms')
  const { error } = await supabase.from('gallery_photos').delete().eq('id', id)
  revalidatePath('/admin/comunicacio')
  return done(error)
}
