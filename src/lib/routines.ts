import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const exerciseItemSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  sets: z.number().int().min(1).max(20),
  reps_min: z.number().int().min(1).max(200).nullable(),
  reps_max: z.number().int().min(1).max(200).nullable(),
  duration_sec: z.number().int().min(1).max(14400).nullable(),
  target_weight: z.number().min(0).max(1000).nullable(),
  rest_sec: z.number().int().min(0).max(900),
  rpe: z.number().min(1).max(10).nullable(),
  set_type: z.enum(['normal', 'warmup', 'dropset', 'superset']),
  superset_group: z.number().int().min(1).max(20).nullable(),
  notes: z.string().max(500).nullable(),
})

export const routineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).nullable(),
  goal: z.string().max(120).nullable(),
  duration_weeks: z.number().int().min(1).max(52).nullable(),
  days: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        exercises: z.array(exerciseItemSchema).max(40),
      }),
    )
    .min(1)
    .max(7),
})
export type RoutinePayload = z.infer<typeof routineSchema>

interface CloneOpts {
  ownerId: string | null
  createdBy: string
  isTemplate: boolean
  name?: string
  parentId?: string | null
  version?: number
}

/** Copia profunda de una rutina (días y ejercicios) bajo las políticas RLS del usuario actual. */
export async function cloneRoutine(supabase: SupabaseClient, sourceId: string, o: CloneOpts) {
  const { data: src, error } = await supabase
    .from('routines')
    .select('*, routine_days(*, routine_exercises(*))')
    .eq('id', sourceId)
    .single()
  if (error || !src) throw new Error('source_not_found')

  const newId = crypto.randomUUID()
  const { error: rErr } = await supabase.from('routines').insert({
    id: newId, owner_id: o.ownerId, created_by: o.createdBy, name: o.name ?? src.name, description: src.description,
    goal: src.goal, is_template: o.isTemplate, duration_weeks: src.duration_weeks,
    parent_id: o.parentId === undefined ? src.id : o.parentId, version: o.version ?? 1,
  })
  if (rErr) throw new Error(rErr.message)

  type Day = { id: string; name: string; position: number; routine_exercises: Record<string, unknown>[] }
  const days = [...(src.routine_days as Day[])].sort((a, b) => a.position - b.position)
  if (days.length) {
    const dayRows = days.map((d) => ({ id: crypto.randomUUID(), routine_id: newId, position: d.position, name: d.name, src: d }))
    const { error: dErr } = await supabase.from('routine_days').insert(dayRows.map(({ src: _s, ...r }) => r))
    if (dErr) throw new Error(dErr.message)
    const exRows = dayRows.flatMap((d) =>
      d.src.routine_exercises.map((e) => ({ ...e, id: crypto.randomUUID(), day_id: d.id })),
    )
    if (exRows.length) {
      const { error: eErr } = await supabase.from('routine_exercises').insert(exRows)
      if (eErr) throw new Error(eErr.message)
    }
  }
  return newId
}

/** Guarda una rutina completa conservando los ids (así no se pierde el vínculo con el historial). */
export async function saveRoutineTree(supabase: SupabaseClient, p: RoutinePayload) {
  const { error } = await supabase
    .from('routines')
    .update({ name: p.name, description: p.description, goal: p.goal, duration_weeks: p.duration_weeks })
    .eq('id', p.id)
  if (error) throw new Error(error.message)

  const dayRows = p.days.map((d, i) => ({ id: d.id, routine_id: p.id, position: i + 1, name: d.name }))
  const { error: dErr } = await supabase.from('routine_days').upsert(dayRows, { onConflict: 'id' })
  if (dErr) throw new Error(dErr.message)

  const keepDays = p.days.map((d) => d.id)
  const { data: existing } = await supabase.from('routine_days').select('id').eq('routine_id', p.id)
  const stale = (existing ?? []).map((d) => d.id).filter((id) => !keepDays.includes(id))
  if (stale.length) await supabase.from('routine_days').delete().in('id', stale)

  const exRows = p.days.flatMap((d) => d.exercises.map((e, i) => ({ ...e, day_id: d.id, position: i + 1 })))
  if (exRows.length) {
    const { error: eErr } = await supabase.from('routine_exercises').upsert(exRows, { onConflict: 'id' })
    if (eErr) throw new Error(eErr.message)
  }
  const keepEx = exRows.map((e) => e.id)
  const { data: exExisting } = await supabase.from('routine_exercises').select('id').in('day_id', keepDays)
  const staleEx = (exExisting ?? []).map((e) => e.id).filter((id) => !keepEx.includes(id))
  if (staleEx.length) await supabase.from('routine_exercises').delete().in('id', staleEx)
}

/** Carga una rutina como payload editable (null si no existe o no hay acceso). */
export async function loadRoutinePayload(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from('routines')
    .select('*, routine_days(*, routine_exercises(*))')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  type Ex = RoutinePayload['days'][number]['exercises'][number] & { position: number }
  type Day = { id: string; name: string; position: number; routine_exercises: Ex[] }
  const payload: RoutinePayload = {
    id: data.id, name: data.name, description: data.description, goal: data.goal, duration_weeks: data.duration_weeks,
    days: [...(data.routine_days as Day[])]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({
        id: d.id, name: d.name,
        exercises: [...d.routine_exercises].sort((a, b) => a.position - b.position).map(({ position: _p, day_id: _d, ...e }: Ex & { day_id?: string }) => ({
          ...e,
          target_weight: e.target_weight === null ? null : Number(e.target_weight),
          rpe: e.rpe === null ? null : Number(e.rpe),
        })),
      })),
  }
  return { routine: data as Record<string, unknown> & { id: string; owner_id: string | null; is_template: boolean; version: number; archived: boolean; name: string }, payload }
}
