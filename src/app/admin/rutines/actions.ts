'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cloneRoutine, routineSchema, saveRoutineTree, type RoutinePayload } from '@/lib/routines'

export async function createTemplate(fd: FormData) {
  const { userId } = await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  const name = String(fd.get('name') ?? '').trim().slice(0, 80) || 'Nova plantilla'
  const id = crypto.randomUUID()
  const { error } = await supabase.from('routines').insert({ id, owner_id: null, created_by: userId, name, is_template: true, duration_weeks: 6 })
  if (error) throw new Error(error.message)
  await supabase.from('routine_days').insert({ routine_id: id, position: 1, name: 'Dia A' })
  redirect(`/admin/rutines/${id}`)
}

export async function saveAdminRoutine(payload: RoutinePayload, opts: { newVersion: boolean }) {
  const { userId } = await requireRole(['admin', 'trainer'])
  const parsed = routineSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const supabase = await createClient()
  const { data: cur } = await supabase.from('routines').select('id, owner_id, is_template, version, name').eq('id', parsed.data.id).maybeSingle()
  if (!cur) return { ok: false, error: 'not_found' }
  try {
    if (opts.newVersion) {
      // Se conserva una copia archivada de la versión anterior; la rutina original (y sus asignaciones) pasa a la nueva versión.
      const snap = await cloneRoutine(supabase, cur.id, { ownerId: cur.owner_id, createdBy: userId, isTemplate: false, name: `${cur.name} · v${cur.version}`, parentId: cur.id, version: cur.version })
      await supabase.from('routines').update({ archived: true, is_template: false }).eq('id', snap)
    }
    await saveRoutineTree(supabase, parsed.data)
    if (opts.newVersion) await supabase.from('routines').update({ version: cur.version + 1 }).eq('id', cur.id)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function duplicateRoutineAction(id: string) {
  const { userId } = await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  const { data: src } = await supabase.from('routines').select('name, is_template, owner_id').eq('id', id).single()
  const copy = await cloneRoutine(supabase, id, { ownerId: src?.is_template ? null : src?.owner_id ?? null, createdBy: userId, isTemplate: Boolean(src?.is_template), name: `${src?.name ?? 'Rutina'} (còpia)`, parentId: id })
  redirect(`/admin/rutines/${copy}`)
}

export async function setArchived(id: string, archived: boolean) {
  await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  await supabase.from('routines').update({ archived }).eq('id', id)
  revalidatePath('/admin/rutines')
}
