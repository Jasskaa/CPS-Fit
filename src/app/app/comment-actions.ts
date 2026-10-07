'use server'

import { revalidatePath } from 'next/cache'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/** Añade un comentario al hilo de un socio (RLS: solo el socio o su monitor/admin). */
export async function addComment(memberId: string, routineId: string | null, body: string) {
  const session = await getSessionProfile()
  const text = body.trim().slice(0, 2000)
  if (!session || !text) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('comments').insert({ member_id: memberId, author_id: session.userId, routine_id: routineId, body: text })
  revalidatePath('/app', 'layout')
  revalidatePath('/admin', 'layout')
  return { ok: !error }
}

export async function resolveComment(id: string, resolved: boolean) {
  const supabase = await createClient()
  await supabase.from('comments').update({ resolved }).eq('id', id)
  revalidatePath('/admin', 'layout')
}
