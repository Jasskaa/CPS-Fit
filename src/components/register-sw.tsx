'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const PRECACHE = ['/app', '/app/entreno', '/app/rutina', '/app/club']

export function RegisterSW() {
  const path = usePathname()
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Una vez dentro de la app del socio, se guardan las pantallas clave para usarlas sin cobertura.
        if (path.startsWith('/app') && !path.startsWith('/app/entreno')) reg.active?.postMessage({ type: 'precache', urls: PRECACHE })
      })
      .catch(() => {})
  }, [path])
  return null
}
