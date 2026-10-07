'use client'

import { useEffect } from 'react'
import { saveSnapshot } from '@/lib/offline'
import type { WorkoutSnapshot } from '@/lib/snapshot'

/** Guarda la rutina activa en el móvil para poder ver y entrenar sin conexión. */
export function SnapshotSaver({ snapshot }: { snapshot: WorkoutSnapshot }) {
  useEffect(() => {
    saveSnapshot(snapshot).catch(() => {})
  }, [snapshot])
  return null
}
