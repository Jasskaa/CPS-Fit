'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CloudOff, RefreshCw } from 'lucide-react'
import { pendingCount, syncOutbox } from '@/lib/offline'

/** Sincroniza entrenos pendientes al abrir la app y al recuperar la conexión. */
export function OutboxSync() {
  const t = useTranslations('member')
  const router = useRouter()
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!navigator.onLine) return
      const { sent, left } = await syncOutbox()
      if (!alive) return
      setPending(left)
      if (sent > 0) router.refresh()
    }
    setOnline(navigator.onLine)
    pendingCount().then((n) => alive && setPending(n)).catch(() => {})
    run()
    const on = () => { setOnline(true); run() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      alive = false
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [router])

  if (online && pending === 0) return null
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-text px-3 py-2 text-sm font-medium text-bg shadow-card">
      {online ? <RefreshCw size={16} className="animate-spin" aria-hidden /> : <CloudOff size={16} aria-hidden />}
      {online ? t('syncing', { n: pending }) : pending > 0 ? t('offlinePending', { n: pending }) : t('offline')}
    </div>
  )
}
