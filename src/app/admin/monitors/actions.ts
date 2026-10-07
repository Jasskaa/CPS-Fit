'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/** Cambia el monitor de un socio (solo admin; RLS exige admin para insertar a otros monitores). */
export async function assignTrainer(memberId: string, fd: FormData) {
  await requireRole(['admin'])
  const trainer = String(fd.get('trainer') ?? '')
  if (!trainer) return
  const supabase = await createClient()
  await supabase.from('trainer_members').delete().eq('member_id', memberId)
  await supabase.from('trainer_members').insert({ trainer_id: trainer, member_id: memberId })
  revalidatePath('/admin', 'layout')
}

/** Valida un alta pendiente: la activa y la asigna a un monitor. */
export async function validateMember(memberId: string, fd: FormData) {
  const { userId } = await requireRole(['admin'])
  const trainer = String(fd.get('trainer') ?? '')
  if (!trainer) return
  const supabase = await createClient()
  await supabase.from('trainer_members').delete().eq('member_id', memberId)
  await supabase.from('trainer_members').insert({ trainer_id: trainer, member_id: memberId })
  await supabase.from('profiles').update({ status: 'active' }).eq('id', memberId)
  await supabase.from('audit_log').insert({ actor_id: userId, action: 'validate_member', entity: 'profile', entity_id: memberId })
  revalidatePath('/admin', 'layout')
}
