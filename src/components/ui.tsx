'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { setLocale } from '@/app/actions'
import { APP_NAME } from '@/lib/config'
import type { Locale } from '@/lib/config'

export function Emblem({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <Image src="/brand/emblem-256.webp" alt="" width={size} height={size} className={`rounded-full ${className}`} priority />
  )
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Emblem size={size} />
      <span className="font-display text-2xl font-extrabold uppercase leading-none tracking-wide">{APP_NAME}</span>
    </span>
  )
}

export function LocaleSwitch() {
  const locale = useLocale()
  const [pending, start] = useTransition()
  return (
    <div role="group" aria-label="Idioma / Idioma" className="inline-flex rounded-xl border border-border bg-surface p-1 text-sm font-bold">
      {(['ca', 'es'] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={locale === l}
          onClick={() => start(() => setLocale(l))}
          className={`h-10 min-w-11 rounded-lg px-3 uppercase transition-colors ${
            locale === l ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />
}

export function EmptyState({
  icon, title, hint, action,
}: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card animate-rise flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div className="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary-text">{icon}</div>}
      <p className="font-display text-2xl font-bold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action}
    </div>
  )
}

export function Stat({ label, value, hint, tone, icon }: { label: string; value: React.ReactNode; hint?: string; tone?: 'warn' | 'good'; icon?: React.ReactNode }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${tone === 'warn' ? 'bg-danger' : 'bg-primary'}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        {icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone === 'warn' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary-text'}`}>{icon}</span>
        )}
      </div>
      <p className={`font-display mt-1 text-5xl font-extrabold leading-none tnum ${tone === 'warn' ? 'text-danger' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
