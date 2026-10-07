import type { SupabaseClient } from '@supabase/supabase-js'
import { bestSet, estimate1RM, volume } from '@/lib/training'
import type { Measurement } from '@/lib/types'

export interface SessionRow { id: string; started_at: string; ended_at: string | null; day_name: string | null }
export interface Point { s: string; d: string; e: string; w: number; e1: number; v: number }
export interface PRRow { id: string; name: string; value: number; at: string }
export interface PhotoRow { id: string; path: string; taken_at: string }

export interface ProgressData {
  sessions: SessionRow[]
  sessionVolume: Record<string, { vol: number; sets: number }>
  points: Point[]
  names: Record<string, string>
  prs: PRRow[]
  measurements: Measurement[]
  photos: PhotoRow[]
}

/** Datos de progreso de un socio (válido para el propio socio y para su monitor, según RLS). */
export async function loadProgressData(supabase: SupabaseClient, memberId: string, locale: string, months = 6): Promise<ProgressData> {
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const [sessionsRes, setsRes, prsRes, measRes, exRes, photosRes] = await Promise.all([
    supabase.from('workout_sessions').select('id, started_at, ended_at, day_name').eq('member_id', memberId).gte('started_at', since.toISOString()).order('started_at', { ascending: false }),
    supabase.from('workout_sets').select('session_id, exercise_id, weight, reps, completed, workout_sessions!inner(member_id, started_at)').eq('workout_sessions.member_id', memberId).gte('workout_sessions.started_at', since.toISOString()).limit(8000),
    supabase.from('personal_records').select('id, exercise_id, kind, value, achieved_at').eq('member_id', memberId).eq('kind', 'e1rm').order('achieved_at', { ascending: false }).limit(20),
    supabase.from('body_measurements').select('*').eq('member_id', memberId).order('measured_at'),
    supabase.from('exercises').select('id, name_ca, name_es'),
    supabase.from('progress_photos').select('id, storage_path, taken_at').eq('member_id', memberId).order('taken_at', { ascending: false }).limit(30),
  ])

  const names: Record<string, string> = Object.fromEntries((exRes.data ?? []).map((e) => [e.id, locale === 'es' ? e.name_es : e.name_ca]))
  const sessions = (sessionsRes.data ?? []) as SessionRow[]
  const dateOf = new Map(sessions.map((s) => [s.id, s.started_at]))

  const groups = new Map<string, { s: string; e: string; sets: { weight: number | null; reps: number | null; completed: boolean }[] }>()
  for (const r of (setsRes.data ?? []) as unknown as { session_id: string; exercise_id: string; weight: number | null; reps: number | null; completed: boolean }[]) {
    const k = `${r.session_id}|${r.exercise_id}`
    const g = groups.get(k) ?? { s: r.session_id, e: r.exercise_id, sets: [] }
    g.sets.push({ weight: r.weight === null ? null : Number(r.weight), reps: r.reps, completed: r.completed })
    groups.set(k, g)
  }
  const points: Point[] = []
  const sessionVolume: Record<string, { vol: number; sets: number }> = {}
  for (const g of groups.values()) {
    const d = dateOf.get(g.s)
    if (!d) continue
    const best = bestSet(g.sets)
    const vol = volume(g.sets)
    const sv = (sessionVolume[g.s] ??= { vol: 0, sets: 0 })
    sv.vol += vol
    sv.sets += g.sets.length
    points.push({ s: g.s, d, e: g.e, w: best?.weight ?? 0, e1: best ? estimate1RM(best.weight, best.reps) : 0, v: vol })
  }

  return {
    sessions, sessionVolume, points, names,
    prs: (prsRes.data ?? []).map((p) => ({ id: p.id, name: names[p.exercise_id] ?? '—', value: Number(p.value), at: p.achieved_at })),
    measurements: (measRes.data ?? []) as Measurement[],
    photos: (photosRes.data ?? []).map((p) => ({ id: p.id, path: p.storage_path, taken_at: p.taken_at })),
  }
}
