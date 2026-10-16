'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** Refresca los datos del servidor cuando cambia una tabla (Supabase Realtime, respeta RLS). */
export function RefreshOnChange({ tables, debounceMs = 800 }: { tables: string[]; debounceMs?: number }) {
  const router = useRouter()
  const key = tables.join(',')
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => router.refresh(), debounceMs) }
    let ch = supabase.channel(`refresh_${key.replace(/,/g, '_')}`)
    for (const table of key.split(',')) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump)
    ch.subscribe()
    return () => { clearTimeout(timer); void supabase.removeChannel(ch) }
  }, [router, key, debounceMs])
  return null
}
