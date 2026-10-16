'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface OccZone { id: string; name: string; capacity: number | null; color: string | null; present: number }

/** Aforo en directo: parte de los datos del servidor y se actualiza por Supabase Realtime. */
export function LiveOccupancy({ initial, compact = false, label }: { initial: OccZone[]; compact?: boolean; label: string }) {
  const [zones, setZones] = useState(initial)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('zone_presence_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zone_presence' }, (payload) => {
        const row = payload.new as { zone_id?: string; present?: number }
        if (row?.zone_id) setZones((zs) => zs.map((z) => (z.id === row.zone_id ? { ...z, present: row.present ?? 0 } : z)))
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [])
  return (
    <ul className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`} aria-label={label} aria-live="polite">
      {zones.map((z) => {
        const pct = z.capacity ? Math.min(100, Math.round((z.present / z.capacity) * 100)) : 0
        const tone = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warn)' : 'var(--primary)'
        return (
          <li key={z.id} className="rounded-xl border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{z.name}</span>
              <span className="font-display text-2xl font-extrabold tnum">{z.present}<span className="text-sm font-semibold text-muted">{z.capacity ? ` / ${z.capacity}` : ''}</span></span>
            </div>
            {z.capacity ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={z.name}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: tone }} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
