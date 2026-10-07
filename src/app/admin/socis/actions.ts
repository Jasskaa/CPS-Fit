'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'
import { cloneRoutine } from '@/lib/routines'

/** Alta por invitación (requiere service role): el socio recibe un email para fijar contraseña. */
export async function inviteMember(fd: FormData) {
  const { userId, profile } = await requireRole(['admin', 'trainer'])
  const parsed = z.object({ full_name: z.string().trim().min(1).max(80), email: z.string().email() }).safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { ok: false, error: 'Dades no vàlides' }
  if (!hasServiceRole()) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }
  const admin = createAdminClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name, locale: 'ca', consent: 'false' },
    redirectTo: `${origin}/auth/callback?next=/app`,
  })
  if (error || !data.user) return { ok: false, error: error?.message ?? 'Error' }
  await admin.from('profiles').update({ status: 'active' }).eq('id', data.user.id)
  if (profile.role === 'trainer') await admin.from('trainer_members').insert({ trainer_id: userId, member_id: data.user.id })
  await admin.from('audit_log').insert({ actor_id: userId, action: 'invite_member', entity: 'profile', entity_id: data.user.id })
  revalidatePath('/admin/socis')
  return { ok: true }
}

export async function setMemberStatus(memberId: string, status: 'pending' | 'active' | 'paused' | 'inactive') {
  await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  await supabase.from('profiles').update({ status }).eq('id', memberId)
  revalidatePath(`/admin/socis/${memberId}`)
  revalidatePath('/admin/socis')
}

export async function saveTrainerNotes(memberId: string, fd: FormData) {
  await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  await supabase.from('member_details').update({
    trainer_notes: String(fd.get('trainer_notes') ?? '').slice(0, 2000) || null,
    limitations: String(fd.get('limitations') ?? '').slice(0, 500) || null,
    goal: String(fd.get('goal') ?? '').slice(0, 120) || null,
  }).eq('member_id', memberId)
  revalidatePath(`/admin/socis/${memberId}`)
}

/** Asigna una rutina (plantilla o rutina existente) a uno o varios socios: crea una copia propia de cada socio. */
export async function assignRoutine(routineId: string, fd: FormData) {
  const { userId } = await requireRole(['admin', 'trainer'])
  const memberIds = fd.getAll('member').map(String)
  const start = String(fd.get('start') ?? '') || new Date().toISOString().slice(0, 10)
  const weeks = Math.min(52, Math.max(1, Number(fd.get('weeks') ?? 6) || 6))
  if (!memberIds.length) return { ok: false }
  const supabase = await createClient()
  const { data: src } = await supabase.from('routines').select('name').eq('id', routineId).single()
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  for (const memberId of memberIds) {
    await supabase.from('routine_assignments').update({ status: 'completed' }).eq('member_id', memberId).eq('status', 'active')
    const copy = await cloneRoutine(supabase, routineId, { ownerId: memberId, createdBy: userId, isTemplate: false, name: src?.name, parentId: routineId })
    const { error } = await supabase.from('routine_assignments').insert({ member_id: memberId, routine_id: copy, assigned_by: userId, start_date: start, end_date: end.toISOString().slice(0, 10) })
    if (error) return { ok: false }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, count: memberIds.length }
}

export async function endAssignment(assignmentId: string, memberId: string) {
  await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  await supabase.from('routine_assignments').update({ status: 'completed' }).eq('id', assignmentId)
  revalidatePath(`/admin/socis/${memberId}`)
}
