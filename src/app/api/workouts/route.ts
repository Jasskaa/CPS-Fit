import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { bestSet } from '@/lib/training'

const schema = z.object({
  id: z.string().uuid(),
  routineId: z.string().uuid().nullable().optional(),
  dayId: z.string().uuid().nullable().optional(),
  dayName: z.string().max(80).nullable().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  notes: z.string().max(1000).nullable().optional(),
  sets: z
    .array(
      z.object({
        exercise_id: z.string().uuid(),
        set_index: z.number().int().min(1).max(50),
        set_type: z.enum(['normal', 'warmup', 'dropset', 'superset']).default('normal'),
        weight: z.number().min(0).max(1000).nullable(),
        reps: z.number().int().min(0).max(1000).nullable(),
        duration_sec: z.number().int().min(0).max(86400).nullable(),
        completed: z.boolean(),
      }),
    )
    .max(300),
})

// Recibe un entreno terminado (también desde la cola offline). Idempotente por id de sesión.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims?.sub
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 422 })
  const w = parsed.data

  const { error: sErr } = await supabase.from('workout_sessions').insert({
    id: w.id, member_id: userId, routine_id: w.routineId ?? null, day_id: w.dayId ?? null,
    day_name: w.dayName ?? null, started_at: w.startedAt, ended_at: w.endedAt, notes: w.notes ?? null,
  })
  if (sErr) return NextResponse.json({ error: sErr.code === '23505' ? 'duplicate' : 'db' }, { status: sErr.code === '23505' ? 409 : 500 })

  if (w.sets.length) {
    const { error } = await supabase.from('workout_sets').insert(w.sets.map((s) => ({ ...s, session_id: w.id })))
    if (error) {
      await supabase.from('workout_sessions').delete().eq('id', w.id)
      return NextResponse.json({ error: 'db' }, { status: 500 })
    }
  }

  // Récords personales: se comparan con los máximos guardados.
  const byExercise = new Map<string, typeof w.sets>()
  for (const s of w.sets) byExercise.set(s.exercise_id, [...(byExercise.get(s.exercise_id) ?? []), s])
  const ids = [...byExercise.keys()]
  const prs: { exercise_id: string; kind: 'weight' | 'e1rm'; value: number }[] = []
  if (ids.length) {
    const { data: existing } = await supabase.from('personal_records').select('exercise_id, kind, value').eq('member_id', userId).in('exercise_id', ids)
    const max = (ex: string, kind: string) =>
      Math.max(0, ...(existing ?? []).filter((p) => p.exercise_id === ex && p.kind === kind).map((p) => Number(p.value)))
    for (const [ex, sets] of byExercise) {
      const best = bestSet(sets)
      if (!best) continue
      if (best.weight > max(ex, 'weight')) prs.push({ exercise_id: ex, kind: 'weight', value: best.weight })
      if (best.e1rm > max(ex, 'e1rm')) prs.push({ exercise_id: ex, kind: 'e1rm', value: best.e1rm })
    }
    if (prs.length) {
      await supabase.from('personal_records').insert(prs.map((p) => ({ ...p, member_id: userId, session_id: w.id, achieved_at: w.endedAt })))
    }
  }
  return NextResponse.json({ ok: true, prs })
}
