'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Minus, Plus, Search, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { LastSet } from '@/lib/snapshot'
import type { DraftSet } from '@/lib/offline'
import { formatDuration, fromDisplayWeight, toDisplayWeight } from '@/lib/training'
import type { Exercise } from '@/lib/types'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise card w-full max-w-md p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none"
      >
        <h2 className="font-display text-3xl font-bold">{title}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  )
}

function Stepper({
  label, value, onChange, step, min = 0, max = 1000, format,
}: { label: string; value: number | null; onChange: (v: number | null) => void; step: number; min?: number; max?: number; format?: (v: number) => string }) {
  const v = value ?? 0
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)))
  return (
    <div className="flex w-full items-center gap-1" role="group" aria-label={label}>
      <button type="button" className="btn btn-ghost !min-h-12 !w-11 !shrink-0 !px-0" aria-label={`${label} −`} onClick={() => set(v - step)}><Minus size={18} aria-hidden /></button>
      {format ? (
        <span className="font-display min-w-0 flex-1 text-center text-3xl font-extrabold tnum">{value === null ? '—' : format(value)}</span>
      ) : (
        <input
          inputMode="decimal"
          aria-label={label}
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.')
            if (raw === '') return onChange(null)
            const n = Number(raw)
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          onFocus={(e) => e.target.select()}
          className="font-display min-w-0 flex-1 rounded-lg bg-transparent text-center text-3xl font-extrabold tnum outline-none focus:bg-surface-2"
        />
      )}
      <button type="button" className="btn btn-ghost !min-h-12 !w-11 !shrink-0 !px-0" aria-label={`${label} +`} onClick={() => set(v + step)}><Plus size={18} aria-hidden /></button>
    </div>
  )
}

export function SetRow({
  index, set, timed, units, step, reference, onChange, onToggle, onRemove,
}: {
  index: number
  set: DraftSet
  timed: boolean
  units: 'kg' | 'lb'
  step: number
  reference: LastSet | null
  onChange: (p: Partial<DraftSet>) => void
  onToggle: () => void
  onRemove?: () => void
}) {
  const t = useTranslations('workout')
  const refText = reference
    ? timed
      ? `${t('last')}: ${formatDuration(reference.duration_sec ?? 0)}`
      : `${t('last')}: ${reference.weight != null ? `${toDisplayWeight(reference.weight, units)} ${units} × ` : ''}${reference.reps ?? '—'}`
    : null
  return (
    <li className={`card p-3 transition-colors ${set.done ? 'border-success bg-success-soft' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="font-display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-xl font-bold tnum" aria-label={`${t('set')} ${index}`}>{index}</span>
        <p className="min-w-0 flex-1 text-sm text-muted tnum">{refText ?? ''}</p>
        {onRemove && !set.done && (
          <button type="button" onClick={onRemove} aria-label={t('removeSet')} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:text-danger"><Trash2 size={17} aria-hidden /></button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={set.done}
          aria-label={t('markDone')}
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 transition-all active:scale-90 ${set.done ? 'animate-pop border-success bg-success text-bg' : 'border-border bg-surface text-muted'}`}
        >
          <Check size={30} strokeWidth={3} aria-hidden />
        </button>
      </div>
      {timed ? (
        <div className="mt-2">
          <Stepper label={t('seconds')} value={set.duration_sec} onChange={(v) => onChange({ duration_sec: v })} step={(set.duration_sec ?? 0) >= 120 ? 60 : 5} format={(v) => formatDuration(v)} />
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <span className="mb-0.5 block text-center text-[11px] font-bold uppercase tracking-wide text-muted">{units}</span>
            <Stepper label={units} value={set.weight === null ? null : toDisplayWeight(set.weight, units)} onChange={(v) => onChange({ weight: v === null ? null : fromDisplayWeight(v, units) })} step={step} />
          </div>
          <div>
            <span className="mb-0.5 block text-center text-[11px] font-bold uppercase tracking-wide text-muted">{t('reps')}</span>
            <Stepper label={t('reps')} value={set.reps} onChange={(v) => onChange({ reps: v })} step={1} max={200} />
          </div>
        </div>
      )}
    </li>
  )
}

export function SwapSheet({ locale, onClose, onPick }: { locale: string; onClose: () => void; onPick: (e: Exercise) => void }) {
  const t = useTranslations('workout')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Exercise[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    const supabase = createClient()
    let alive = true
    const timer = setTimeout(async () => {
      const col = locale === 'es' ? 'name_es' : 'name_ca'
      let query = supabase.from('exercises').select('*').order(col).limit(30)
      if (q.trim()) query = query.ilike(col, `%${q.trim()}%`)
      const { data, error } = await query
      if (!alive) return
      setError(Boolean(error))
      setItems((data ?? []) as Exercise[])
    }, 200)
    return () => { alive = false; clearTimeout(timer) }
  }, [q, locale])
  return (
    <Modal title={t('swapTitle')} onClose={onClose}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input autoFocus className="input !pl-9" placeholder={t('searchExercise')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{t('needsConnection')}</p>}
      <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {items.map((e) => (
          <li key={e.id}>
            <button className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left hover:bg-surface-2" onClick={() => onPick(e)}>
              <span className="font-semibold">{locale === 'es' ? e.name_es : e.name_ca}</span>
              <span className="chip">{e.primary_muscle}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost mt-3 w-full" onClick={onClose}><X size={16} aria-hidden /> {t('cancel')}</button>
    </Modal>
  )
}
