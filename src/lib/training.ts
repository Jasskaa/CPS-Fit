// Lógica pura de entrenamiento (testeada con Vitest).

export interface SetLike {
  weight: number | null
  reps: number | null
  completed?: boolean
}

/** 1RM estimado (Epley). Para 1 rep devuelve el propio peso. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return round1(weight)
  return round1(weight * (1 + reps / 30))
}

/** Volumen = suma de peso × repeticiones de las series completadas. */
export function volume(sets: SetLike[]): number {
  return Math.round(
    sets.reduce((acc, s) => (s.completed === false ? acc : acc + (s.weight ?? 0) * (s.reps ?? 0)), 0),
  )
}

export function bestSet(sets: SetLike[]): { weight: number; reps: number; e1rm: number } | null {
  let best: { weight: number; reps: number; e1rm: number } | null = null
  for (const s of sets) {
    if (s.completed === false || !s.weight || !s.reps) continue
    const e = estimate1RM(s.weight, s.reps)
    if (!best || e > best.e1rm) best = { weight: s.weight, reps: s.reps, e1rm: e }
  }
  return best
}

export type PRKind = 'weight' | 'e1rm' | 'volume'

/** Detecta récords personales de una sesión comparando con los máximos anteriores. */
export function detectPRs(
  current: SetLike[],
  previous: { maxWeight: number; maxE1rm: number } | null,
): PRKind[] {
  const best = bestSet(current)
  if (!best) return []
  if (!previous) return ['weight', 'e1rm']
  const out: PRKind[] = []
  if (best.weight > previous.maxWeight) out.push('weight')
  if (best.e1rm > previous.maxE1rm) out.push('e1rm')
  return out
}

/** Ancla un valor de peso en kg para mostrarlo en la unidad elegida. */
export function toDisplayWeight(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? round1(kg * 2.20462) : round1(kg)
}
export function fromDisplayWeight(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? Math.round((value / 2.20462) * 100) / 100 : value
}

export function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Texto de objetivo de una serie: "8–12 reps", "10 reps", "45 s" o "10 min". */
export function targetLabel(e: { reps_min: number | null; reps_max: number | null; duration_sec: number | null }): string {
  if (e.duration_sec) return e.duration_sec >= 120 && e.duration_sec % 60 === 0 ? `${e.duration_sec / 60} min` : `${e.duration_sec} s`
  if (e.reps_min && e.reps_max && e.reps_min !== e.reps_max) return `${e.reps_min}–${e.reps_max} reps`
  return `${e.reps_min ?? e.reps_max ?? '—'} reps`
}

// ── Fechas / constancia ──
export function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // lunes = 0
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - day)
  return x
}

export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Racha de semanas consecutivas (hasta la actual o la anterior) con al menos `min` entrenos. */
export function weeklyStreak(sessionDates: (Date | string)[], now = new Date(), min = 1): number {
  const perWeek = new Map<string, number>()
  for (const s of sessionDates) {
    const k = dayKey(startOfWeek(new Date(s)))
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1)
  }
  let cursor = startOfWeek(now)
  // La semana en curso aún puede completarse: si no llega al mínimo, empezamos en la anterior.
  if ((perWeek.get(dayKey(cursor)) ?? 0) < min) cursor.setDate(cursor.getDate() - 7)
  let streak = 0
  while ((perWeek.get(dayKey(cursor)) ?? 0) >= min) {
    streak++
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

/** Día de la rutina que toca hoy: el siguiente al último entrenado (rotación). */
export function nextDayIndex(dayIds: string[], lastDayId: string | null): number {
  if (dayIds.length === 0) return 0
  const i = lastDayId ? dayIds.indexOf(lastDayId) : -1
  return (i + 1) % dayIds.length
}

/** Adherencia: entrenos hechos / esperados desde el inicio de la asignación. */
export function adherence(done: number, daysPerWeek: number, startDate: Date, now = new Date()): number {
  const weeks = Math.max(1, (now.getTime() - startDate.getTime()) / (7 * 86400000))
  const expected = Math.max(1, Math.round(weeks * daysPerWeek))
  return Math.min(100, Math.round((done / expected) * 100))
}
