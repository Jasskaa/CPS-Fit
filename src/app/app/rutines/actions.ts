'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cloneRoutine, routineSchema, saveRoutineTree, type RoutinePayload } from '@/lib/routines'

async function me() {
  const s = await getSessionProfile()
  if (!s || s.profile.role !== 'member') redirect('/login')
  return s
}

/** Crea una rutina propia vacía y abre el editor. */
export async function createOwnRoutine(formData: FormData) {
  const { userId } = await me()
  const supabase = await createClient()
  const name = String(formData.get('name') ?? '').trim().slice(0, 80) || 'La meva rutina'
  const id = crypto.randomUUID()
  const { error } = await supabase.from('routines').insert({ id, owner_id: userId, created_by: userId, name })
  if (error) throw new Error(error.message)
  await supabase.from('routine_days').insert({ routine_id: id, position: 1, name: 'Dia A' })
  redirect(`/app/rutines/${id}`)
}

/** Duplica una rutina (p. ej. la del monitor) como propia. */
export async function duplicateAsOwn(sourceId: string) {
  const { userId } = await me()
  const supabase = await createClient()
  const { data: src } = await supabase.from('routines').select('name').eq('id', sourceId).single()
  const id = await cloneRoutine(supabase, sourceId, { ownerId: userId, createdBy: userId, isTemplate: false, name: `${src?.name ?? 'Rutina'} (còpia)`, parentId: sourceId })
  redirect(`/app/rutines/${id}`)
}

export async function saveOwnRoutine(payload: RoutinePayload) {
  const { userId } = await me()
  const parsed = routineSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const supabase = await createClient()
  const { data: own } = await supabase.from('routines').select('id').eq('id', parsed.data.id).eq('owner_id', userId).maybeSingle()
  if (!own) return { ok: false, error: 'forbidden' }
  try {
    await saveRoutineTree(supabase, parsed.data)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  revalidatePath('/app', 'layout')
  return { ok: true }
}

/** Marca una rutina como la activa: cierra la asignación vigente y crea una nueva. */
export async function activateRoutine(routineId: string) {
  const { userId } = await me()
  const supabase = await createClient()
  await supabase.from('routine_assignments').update({ status: 'cancelled' }).eq('member_id', userId).eq('status', 'active')
  const { error } = await supabase.from('routine_assignments').insert({ member_id: userId, routine_id: routineId, assigned_by: userId })
  if (error) throw new Error(error.message)
  revalidatePath('/app', 'layout')
}

export async function deleteOwnRoutine(routineId: string) {
  const { userId } = await me()
  const supabase = await createClient()
  await supabase.from('routines').delete().eq('id', routineId).eq('owner_id', userId).eq('created_by', userId)
  revalidatePath('/app', 'layout')
  redirect('/app/rutines')
}
