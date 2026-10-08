'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { RefreshCw, TriangleAlert } from 'lucide-react'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors')
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-danger-soft text-danger"><TriangleAlert size={36} aria-hidden /></span>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={reset}><RefreshCw size={16} aria-hidden /> {t('retry')}</button>
        <Link href="/" className="btn btn-ghost">{t('home')}</Link>
      </div>
    </main>
  )
}
