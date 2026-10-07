import type { SupabaseClient } from '@supabase/supabase-js'
import { nextDayIndex } from '@/lib/training'
import type { Exercise, SetKind } from '@/lib/types'

export interface SnapshotExercise {
  id: string // routine_exercise id
  exercise_id: string
  name: string
  muscle: string
  equipment: string
  sets: number
  reps_min: number | null
  reps_max: number | null
  duration_sec: number | null
  target_weight: number | null
  rest_sec: number
  rpe: number | null
  set_type: SetKind
  notes: string | null
  media_url: string | null
  tips: string | null
  is_timed: boolean
}
export interface SnapshotDay { id: string; name: string; exercises: SnapshotExercise[] }
export interface LastSet { weight: number | null; reps: number | null; duration_sec: number | null }
export interface WorkoutSnapshot {
  userId: string
  units: 'kg' | 'lb'
  savedAt: string
  routine: { id: string; name: string; weeks: number | null; startDate: string | null; endDate: string | null; days: SnapshotDay[] } | null
  nextDayId: string | null
  last: Record<string, LastSet[]>
  prev: Record<string, { maxWeight: number; maxE1rm: number }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export function pickName(e: Pick<Exercise, 'name_ca' | 'name_es'>, locale: string) {
  return locale === 'es' ? e.name_es : e.name_ca
}

export async function buildSnapshot(supabase: SupabaseClient, userId: string, locale: string, units: 'kg' | 'lb'): Promise<WorkoutSnapshot> {
  const empty: WorkoutSnapshot = { userId, units, savedAt: new Date().toISOString(), routine: null, nextDayId: null, last: {}, prev: {} }

  const { data: assignment } = await supabase
    .from('routine_assignments')
    .select('routine_id, start_date, end_date')
    .eq('member_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!assignment) return empty

  const { data: r } = await supabase
    .from('routines')
    .select('id, name, duration_weeks, routine_days(id, name, position, routine_exercises(*, exercises(*)))')
    .eq('id', assignment.routine_id)
    .single()
  if (!r) return empty

  const days: SnapshotDay[] = ((r.routine_days ?? []) as Row[])
    .sort((a, b) => a.position - b.position)
    .map((d) => ({
      id: d.id,
      name: d.name,
      exercises: ((d.routine_exercises ?? []) as Row[])
        .sort((a, b) => a.position - b.position)
        .map((re) => {
          const ex = re.exercises as Exercise
          return {
            id: re.id, exercise_id: re.exercise_id, name: pickName(ex, locale), muscle: ex.primary_muscle, equipment: ex.equipment,
            sets: re.sets, reps_min: re.reps_min, reps_max: re.reps_max, duration_sec: re.duration_sec,
            target_weight: re.target_weight, rest_sec: re.rest_sec, rpe: re.rpe, set_type: re.set_type, notes: re.notes,
            media_url: ex.media_url, tips: locale === 'es' ? ex.tips_es : ex.tips_ca, is_timed: ex.is_timed,
          }
        }),
    }))

  const exIds = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.exercise_id)))]

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, day_id, routine_id, started_at')
    .eq('member_id', userId)
    .order('started_at', { ascending: false })
    .limit(40)
  const last: Record<string, LastSet[]> = {}
  if (sessions?.length && exIds.length) {
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('session_id, exercise_id, set_index, weight, reps, duration_sec')
      .in('session_id', sessions.map((s) => s.id))
      .in('exercise_id', exIds)
      .order('set_index')
    const order = new Map(sessions.map((s, i) => [s.id, i]))
    const bestSession = new Map<string, number>()
    for (const s of (sets ?? []) as Row[]) {
      const rank = order.get(s.session_id)!
      const cur = bestSession.get(s.exercise_id)
      if (cur === undefined || rank < cur) {
        bestSession.set(s.exercise_id, rank)
        last[s.exercise_id] = []
      }
      if (bestSession.get(s.exercise_id) === rank) last[s.exercise_id].push({ weight: s.weight, reps: s.reps, duration_sec: s.duration_sec })
    }
  }

  const prev: WorkoutSnapshot['prev'] = {}
  if (exIds.length) {
    const { data: prs } = await supabase.from('personal_records').select('exercise_id, kind, value').eq('member_id', userId).in('exercise_id', exIds)
    for (const p of (prs ?? []) as Row[]) {
      const cur = (prev[p.exercise_id] ??= { maxWeight: 0, maxE1rm: 0 })
      if (p.kind === 'weight') cur.maxWeight = Math.max(cur.maxWeight, Number(p.value))
      if (p.kind === 'e1rm') cur.maxE1rm = Math.max(cur.maxE1rm, Number(p.value))
    }
  }

  const lastOfRoutine = sessions?.find((s) => s.routine_id === r.id)
  const dayIds = days.map((d) => d.id)
  const nextDayId = dayIds.length ? dayIds[nextDayIndex(dayIds, lastOfRoutine?.day_id ?? null)] : null

  return {
    userId, units, savedAt: new Date().toISOString(),
    routine: { id: r.id, name: r.name, weeks: r.duration_weeks, startDate: assignment.start_date, endDate: assignment.end_date, days },
    nextDayId, last, prev,
  }
}
