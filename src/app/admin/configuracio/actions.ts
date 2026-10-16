'use server'

import { revalidatePath } from 'next/cache'
import { actionCtx } from '@/lib/ctx'
import { validIban } from '@/modules/billing/sepa'

type R = { ok: boolean; error?: string }
const num = (v: FormDataEntryValue | null, d = 0) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : d }
const str = (v: FormDataEntryValue | null) => String(v ?? '').trim()

async function merge(key: string, patch: Record<string, unknown>): Promise<R> {
  const { supabase } = await actionCtx('settings')
  const { data: cur } = await supabase.from('settings').select('value').eq('key', key).maybeSingle()
  const { error } = await supabase.from('settings').upsert({ key, value: { ...((cur?.value as object) ?? {}), ...patch }, updated_at: new Date().toISOString() })
  revalidatePath('/admin/configuracio')
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function saveClub(fd: FormData): Promise<R> {
  return merge('club', { name: str(fd.get('name')), email: str(fd.get('email')), phone: str(fd.get('phone')), address: str(fd.get('address')), whatsapp: str(fd.get('whatsapp')), reception: str(fd.get('reception')), booking_url: str(fd.get('booking_url')) })
}

export async function saveBilling(fd: FormData): Promise<R> {
  const iban = str(fd.get('iban')).replace(/\s+/g, '').toUpperCase()
  if (!validIban(iban)) return { ok: false, error: 'IBAN no vàlid' }
  return merge('billing', { iban, creditor_id: str(fd.get('creditor_id')), creditor_name: str(fd.get('creditor_name')), entry_fee_cents: Math.round(num(fd.get('entry_fee')) * 100), due_days: Math.max(0, Math.round(num(fd.get('due_days'), 15))), example: false })
}

export async function saveAccess(fd: FormData): Promise<R> {
  return merge('access', { debt_days: Math.max(0, Math.round(num(fd.get('debt_days'), 30))), block_on_debt: fd.get('block_on_debt') === 'on' })
}

export async function saveBookingsCfg(fd: FormData): Promise<R> {
  return merge('bookings', { waitlist: fd.get('waitlist') === 'on', no_show_strikes: Math.max(1, Math.round(num(fd.get('no_show_strikes'), 3))) })
}

export async function saveMembershipType(id: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('settings')
  const fee = Math.round(num(fd.get('fee')) * 100)
  if (fee < 0) return { ok: false, error: 'invalid' }
  const { error } = await supabase.from('membership_types').update({ annual_fee_cents: fee, active: fd.get('active') === 'on' }).eq('id', id)
  revalidatePath('/admin/configuracio')
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function saveZone(id: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('settings')
  const cap = Math.max(0, Math.round(num(fd.get('capacity'))))
  const { error } = await supabase.from('zones').update({ capacity: cap || null }).eq('id', id)
  revalidatePath('/admin/configuracio')
  return error ? { ok: false, error: error.message } : { ok: true }
}

const ROLES = ['admin', 'board', 'reception', 'trainer', 'coordinator', 'coach', 'member']
export async function setUserRole(profileId: string, fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('settings')
  const role = str(fd.get('role'))
  if (!ROLES.includes(role)) return { ok: false, error: 'invalid' }
  if (profileId === userId && role !== 'admin') return { ok: false, error: 'self' }
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId)
  revalidatePath('/admin/configuracio')
  return error ? { ok: false, error: error.message } : { ok: true }
}
