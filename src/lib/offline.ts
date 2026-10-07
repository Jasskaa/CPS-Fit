'use client'

// Almacenamiento local (IndexedDB) para trabajar sin cobertura:
//  · snapshot: rutina activa + referencias de la última vez
//  · draft:    entreno en curso (sobrevive a recargas / cierre de la app)
//  · outbox:   entrenos terminados pendientes de enviar al servidor
import { openDB, type DBSchema } from 'idb'
import type { WorkoutSnapshot } from '@/lib/snapshot'

export interface DraftSet { weight: number | null; reps: number | null; duration_sec: number | null; done: boolean; type: string }
export interface DraftExercise { reId: string; exerciseId: string; name: string; skipped: boolean; note: string; sets: DraftSet[] }
export interface Draft {
  id: string
  routineId: string
  dayId: string
  dayName: string
  startedAt: string
  exercises: DraftExercise[]
}
export interface OutboxItem {
  id: string
  routineId: string
  dayId: string
  dayName: string
  startedAt: string
  endedAt: string
  notes: string | null
  sets: { exercise_id: string; set_index: number; set_type: string; weight: number | null; reps: number | null; duration_sec: number | null; completed: boolean }[]
}

interface Schema extends DBSchema {
  kv: { key: string; value: unknown }
  outbox: { key: string; value: OutboxItem }
}

const db = () =>
  openDB<Schema>('cpsfit', 1, {
    upgrade(d) {
      d.createObjectStore('kv')
      d.createObjectStore('outbox', { keyPath: 'id' })
    },
  })

export async function saveSnapshot(s: WorkoutSnapshot) {
  await (await db()).put('kv', s, 'snapshot')
}
export async function loadSnapshot(): Promise<WorkoutSnapshot | null> {
  return ((await (await db()).get('kv', 'snapshot')) as WorkoutSnapshot) ?? null
}
export async function saveDraft(d: Draft | null) {
  const x = await db()
  if (d) await x.put('kv', d, 'draft')
  else await x.delete('kv', 'draft')
}
export async function loadDraft(): Promise<Draft | null> {
  return ((await (await db()).get('kv', 'draft')) as Draft) ?? null
}
export async function enqueue(item: OutboxItem) {
  await (await db()).put('outbox', item)
}
export async function pendingCount() {
  return (await db()).count('outbox')
}

/** Envía los entrenos pendientes. Es idempotente (el servidor ignora ids repetidos). */
export async function syncOutbox(): Promise<{ sent: number; left: number }> {
  const x = await db()
  const items = await x.getAll('outbox')
  let sent = 0
  for (const item of items) {
    try {
      const res = await fetch('/api/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
      if (res.ok || res.status === 409 || res.status === 422) {
        await x.delete('outbox', item.id)
        sent++
      } else if (res.status === 401) break
    } catch {
      break // sin red: se reintentará
    }
  }
  return { sent, left: await x.count('outbox') }
}
