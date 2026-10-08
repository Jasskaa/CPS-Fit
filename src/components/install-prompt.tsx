'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Download, PlusSquare, Share, X } from 'lucide-react'
import { Emblem } from '@/components/ui'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const KEY = 'cps-install-dismissed'

/** Invita a instalar la PWA: botón nativo en Android/Chrome y guía de 3 pasos en iOS (Safari). */
export function InstallPrompt({ dismissible = true }: { dismissible?: boolean }) {
  const t = useTranslations('install')
  const [event, setEvent] = useState<BIPEvent | null>(null)
  const [mode, setMode] = useState<'hidden' | 'native' | 'ios' | 'installed'>('hidden')
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return setMode('installed')
    try {
      const d = Number(localStorage.getItem(KEY) ?? 0)
      if (dismissible && d && Date.now() - d < 7 * 86400_000) return
    } catch {}
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)
    if (ios) setMode('ios')
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as BIPEvent); setMode('native') }
    const onInstalled = () => setMode('installed')
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [dismissible])

  if (mode === 'hidden') return null
  if (mode === 'installed') {
    return dismissible ? null : (
      <p className="card flex items-center gap-2 p-4 text-sm font-semibold text-success"><CheckCircle2 size={18} aria-hidden /> {t('installed')}</p>
    )
  }
  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch {}; setMode('hidden') }

  return (
    <section className="card animate-rise relative overflow-hidden p-4" aria-label={t('title')}>
      <div className="flex items-center gap-3">
        <Emblem size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-bold leading-tight">{t('title')}</p>
          <p className="text-sm text-muted">{t('body')}</p>
        </div>
        {dismissible && <button onClick={dismiss} aria-label={t('dismiss')} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"><X size={18} aria-hidden /></button>}
      </div>
      {mode === 'native' && (
        <button className="btn btn-primary mt-3 w-full" onClick={async () => { await event?.prompt(); const c = await event?.userChoice; if (c?.outcome === 'accepted') setMode('installed') }}>
          <Download size={18} aria-hidden /> {t('button')}
        </button>
      )}
      {mode === 'ios' && (
        <>
          <button className="btn btn-primary mt-3 w-full" onClick={() => setShowIos(!showIos)} aria-expanded={showIos}>{t('iosButton')}</button>
          {showIos && (
            <ol className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><Share className="shrink-0 text-primary-text" size={20} aria-hidden /> {t('ios1')}</li>
              <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><PlusSquare className="shrink-0 text-primary-text" size={20} aria-hidden /> {t('ios2')}</li>
              <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><CheckCircle2 className="shrink-0 text-primary-text" size={20} aria-hidden /> {t('ios3')}</li>
            </ol>
          )}
        </>
      )}
    </section>
  )
}
