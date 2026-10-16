'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionCtx, ilikeSafe, personSearch } from '@/lib/ctx'
import { clubInstant } from '@/lib/format'

type R = { ok: boolean; error?: string; id?: string; created?: number; skipped?: string[] }

export async function findPeopleForBooking(q: string) {
  const { supabase } = await actionCtx('bookings')
  const s = ilikeSafe(q)
  if (s.length < 2) return []
  const { data } = await personSearch(supabase.from('people').select('id, first_name, last_name, email, memberships(status)'), s).neq('status', 'left').order('last_name').limit(8)
  return (data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, sub: p.email ?? '', member: (p.memberships as { status: string }[]).some((m) => m.status === 'active') }))
}

const createSchema = z.object({
  resource_id: z.string().uuid(),
  person_id: z.string().uuid().optional().or(z.literal('')),
  kind: z.enum(['booking', 'block', 'class', 'training', 'match', 'rental']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  minutes: z.coerce.number().int().min(30).max(480),
  title: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  open_match: z.string().optional(),
  repeat_weeks: z.coerce.number().int().min(0).max(52).default(0),
  pay: z.enum(['later', 'cash', 'card']).default('later'),
})

/** Crea una reserva (o bloqueo / clase / alquiler), opcionalmente recurrente, con extras y cobro inmediato. */
export async function createBooking(fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('bookings')
  const parsed = createSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const v = parsed.data
  const needsPerson = v.kind === 'booking' || v.kind === 'rental'
  if (needsPerson && !v.person_id) return { ok: false, error: 'person_required' }
  const extras = fd.getAll('extra').map(String).filter(Boolean) // "productId:qty"
  const seriesId = v.repeat_weeks > 0 ? crypto.randomUUID() : null
  const { data: resRow } = await supabase.from('resources').select('capacity').eq('id', v.resource_id).single()
  const capacity = resRow?.capacity ?? 1
  let created = 0
  const skipped: string[] = []
  let firstId: string | undefined

  for (let w = 0; w <= v.repeat_weeks; w++) {
    const d = new Date(`${v.date}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 7 * w)
    const day = d.toISOString().slice(0, 10)
    const starts = clubInstant(day, v.start)
    const ends = new Date(starts.getTime() + v.minutes * 60_000)
    // En recursos con aforo (sauna, clases) cada reserva ocupa una plaza libre.
    let seat = 1
    if (capacity > 1) {
      const { data: used } = await supabase.from('bookings').select('seat').eq('resource_id', v.resource_id).in('status', ['confirmed', 'blocked']).lt('starts_at', ends.toISOString()).gt('ends_at', starts.toISOString())
      const taken = new Set((used ?? []).map((u) => u.seat))
      while (taken.has(seat) && seat <= capacity) seat++
      if (seat > capacity) { skipped.push(`${day}: ple`); continue }
    }
    const { data: b, error } = await supabase.from('bookings').insert({
      resource_id: v.resource_id, person_id: v.person_id || null, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      kind: v.kind, status: v.kind === 'block' ? 'blocked' : 'confirmed', title: v.title || null, notes: v.notes || null,
      open_match: Boolean(v.open_match), players_needed: v.open_match ? 3 : null, series_id: seriesId, created_by: userId, seat,
    }).select('id').single()
    if (error || !b) { skipped.push(`${day}: ${error?.message.includes('no_overlap') ? 'ocupat' : error?.message ?? 'error'}`); continue }
    created++
    firstId ??= b.id
    if (needsPerson) {
      for (const e of extras) {
        const [pid, qty] = e.split(':')
        if (pid) await supabase.from('booking_extras').insert({ booking_id: b.id, product_id: pid, qty: Math.max(1, Number(qty) || 1) })
      }
      if (v.pay !== 'later') {
        const { data: inv } = await supabase.rpc('invoice_booking', { p_booking: b.id })
        if (inv) {
          const { data: i } = await supabase.from('invoices').select('total_cents').eq('id', inv).single()
          if (i && i.total_cents > 0) await supabase.from('payments').insert({ invoice_id: inv, person_id: v.person_id, method: v.pay, amount_cents: i.total_cents, status: 'succeeded', paid_at: new Date().toISOString(), created_by: userId })
        }
      }
    }
  }
  revalidatePath('/admin/reserves')
  if (!created) return { ok: false, error: skipped[0] ?? 'error' }
  return { ok: true, id: firstId, created, skipped }
}

/** Mueve una reserva a otra pista/hora (arrastrar y soltar). La base de datos impide solapes. */
export async function moveBooking(id: string, resourceId: string, date: string, start: string): Promise<R> {
  const { supabase } = await actionCtx('bookings')
  const { data: b } = await supabase.from('bookings').select('starts_at, ends_at, kind').eq('id', id).single()
  if (!b) return { ok: false, error: 'not_found' }
  const dur = new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()
  const starts = clubInstant(date, start)
  const { error } = await supabase.from('bookings').update({ resource_id: resourceId, starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + dur).toISOString() }).eq('id', id)
  revalidatePath('/admin/reserves')
  return error ? { ok: false, error: error.message.includes('no_overlap') ? 'ocupat' : error.message } : { ok: true }
}

export async function cancelBooking(id: string, reason?: string, refund = false): Promise<R> {
  const { supabase } = await actionCtx('bookings')
  const { data: b } = await supabase.from('bookings').select('invoice_id, person_id').eq('id', id).single()
  const { error } = await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason || null }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  if (b?.invoice_id) {
    const { data: inv } = await supabase.from('invoices').select('status, total_cents').eq('id', b.invoice_id).single()
    if (inv?.status === 'pending' || inv?.status === 'overdue') await supabase.from('invoices').update({ status: 'void' }).eq('id', b.invoice_id)
    if (inv?.status === 'paid' && refund) {
      await supabase.from('payments').update({ status: 'refunded' }).eq('invoice_id', b.invoice_id).eq('status', 'succeeded')
    }
  }
  revalidatePath('/admin/reserves')
  return { ok: true }
}

export async function markNoShow(id: string): Promise<R> {
  const { supabase } = await actionCtx('bookings')
  const { error } = await supabase.from('bookings').update({ status: 'no_show' }).eq('id', id)
  revalidatePath('/admin/reserves')
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Cobra una reserva pendiente: factura si hace falta y registra el pago. */
export async function collectBooking(id: string, method: 'cash' | 'card'): Promise<R> {
  const { supabase, userId } = await actionCtx('bookings')
  const { data: b } = await supabase.from('bookings').select('person_id').eq('id', id).single()
  if (!b?.person_id) return { ok: false, error: 'person_required' }
  const { data: invId, error } = await supabase.rpc('invoice_booking', { p_booking: id })
  if (error || !invId) return { ok: false, error: error?.message ?? 'error' }
  const { data: inv } = await supabase.from('invoices').select('total_cents, status').eq('id', invId).single()
  if (inv && inv.status !== 'paid' && inv.total_cents > 0) {
    const { error: pe } = await supabase.from('payments').insert({ invoice_id: invId, person_id: b.person_id, method, amount_cents: inv.total_cents, status: 'succeeded', paid_at: new Date().toISOString(), created_by: userId })
    if (pe) return { ok: false, error: pe.message }
  }
  revalidatePath('/admin/reserves')
  return { ok: true, id: invId }
}

export async function removeWaiting(id: string): Promise<R> {
  const { supabase } = await actionCtx('bookings')
  await supabase.from('booking_waitlist').delete().eq('id', id)
  revalidatePath('/admin/reserves')
  return { ok: true }
}

export async function updatePricePerHour(id: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('settings')
  const price = Math.round(Number(String(fd.get('price')).replace(',', '.')) * 100)
  if (!Number.isFinite(price) || price < 0 || price > 100000) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('pricing_rules').update({ price_cents_hour: price }).eq('id', id)
  revalidatePath('/admin/reserves')
  return error ? { ok: false, error: error.message } : { ok: true }
}
