/* eslint-disable @next/next/no-location-assign-relative-destination -- navegación completa intencionada: refresca los datos del servidor tras entrenar */
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Flag, Plus, Repeat, SkipForward, StickyNote, Timer, Trophy, X,
} from 'lucide-react'
import {
  enqueue, loadDraft, loadSnapshot, saveDraft, saveSnapshot, syncOutbox,
  type Draft, type DraftSet, type OutboxItem,
} from '@/lib/offline'
import type { SnapshotDay, WorkoutSnapshot } from '@/lib/snapshot'
import { Modal, SetRow, SwapSheet } from './workout-parts'
import { detectPRs, formatDuration, targetLabel, volume } from '@/lib/training'

const uuid = () => crypto.randomUUID()

function buildDraft(snap: WorkoutSnapshot, day: SnapshotDay): Draft {
  return {
    id: uuid(),
    routineId: snap.routine!.id,
    dayId: day.id,
    dayName: day.name,
    startedAt: new Date().toISOString(),
    exercises: day.exercises.map((e) => {
      const last = snap.last[e.exercise_id] ?? []
      const timed = Boolean(e.duration_sec)
      return {
        reId: e.id, exerciseId: e.exercise_id, name: e.name, skipped: false, note: '',
        sets: Array.from({ length: e.sets }, (_, i): DraftSet => {
          const ref = last[i] ?? last[last.length - 1]
          return {
            weight: timed ? null : (ref?.weight ?? e.target_weight ?? null),
            reps: timed ? null : (ref?.reps ?? e.reps_max ?? e.reps_min ?? null),
            duration_sec: timed ? (e.duration_sec ?? null) : null,
            done: false,
            type: e.set_type,
          }
        }),
      }
    }),
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {}
}
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p) } catch {} }

export function WorkoutRunner() {
  const t = useTranslations('workout')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [snap, setSnap] = useState<WorkoutSnapshot | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'summary'>('loading')
  const [idx, setIdx] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [swapFor, setSwapFor] = useState<number | null>(null)
  const [summary, setSummary] = useState<{ duration: number; vol: number; sets: number; prs: { name: string; kind: string }[]; synced: boolean } | null>(null)
  const alertRest = useRef(true)

  // Carga: snapshot (local → red) + borrador en curso
  useEffect(() => {
    let alive = true
    ;(async () => {
      let s = await loadSnapshot().catch(() => null)
      if (navigator.onLine) {
        try {
          const res = await fetch('/api/snapshot', { cache: 'no-store' })
          if (res.ok) {
            s = (await res.json()) as WorkoutSnapshot
            saveSnapshot(s).catch(() => {})
          }
        } catch {}
      }
      if (!alive) return
      if (!s?.routine) return setState('none')
      const dayId = location.hash.replace('#', '') || s.nextDayId || s.routine.days[0]?.id
      const day = s.routine.days.find((d) => d.id === dayId)
      if (!day) return setState('none')
      const saved = await loadDraft().catch(() => null)
      const fresh = saved && saved.dayId === day.id && Date.now() - new Date(saved.startedAt).getTime() < 12 * 3600_000
      setSnap(s)
      setDraft(fresh ? saved : buildDraft(s, day))
      setState('ready')
    })()
    alertRest.current = localStorage.getItem('cps-rest-alert') !== 'off'
    return () => { alive = false }
  }, [])

  // Reloj
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(i)
  }, [])

  // Persistencia del borrador
  useEffect(() => {
    if (draft && state === 'ready') saveDraft(draft).catch(() => {})
  }, [draft, state])

  // Fin del descanso
  useEffect(() => {
    if (rest && now >= rest.end) {
      setRest(null)
      if (alertRest.current) { buzz([200, 100, 200]); beep() }
    }
  }, [now, rest])

  const day = useMemo(() => snap?.routine?.days.find((d) => d.id === draft?.dayId) ?? null, [snap, draft])
  const units = snap?.units ?? 'kg'
  const step = units === 'lb' ? 5 : 2.5

  const update = useCallback((fn: (d: Draft) => void) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  function toggleSet(ei: number, si: number, restSec: number) {
    update((d) => {
      const s = d.exercises[ei].sets[si]
      s.done = !s.done
      if (s.done) {
        buzz(18)
        if (restSec > 0) setRest({ end: Date.now() + restSec * 1000, total: restSec })
      }
    })
  }

  async function finish() {
    if (!draft || !snap) return
    const endedAt = new Date()
    const rows: OutboxItem['sets'] = []
    draft.exercises.forEach((e) => {
      if (e.skipped) return
      e.sets.forEach((s, i) => {
        if (!s.done) return
        rows.push({ exercise_id: e.exerciseId, set_index: i + 1, set_type: s.type, weight: s.weight, reps: s.reps, duration_sec: s.duration_sec, completed: true })
      })
    })
    const notes = draft.exercises.filter((e) => e.note.trim()).map((e) => `${e.name}: ${e.note.trim()}`).join('\n') || null
    const item: OutboxItem = {
      id: draft.id, routineId: draft.routineId, dayId: draft.dayId, dayName: draft.dayName,
      startedAt: draft.startedAt, endedAt: endedAt.toISOString(), notes, sets: rows,
    }
    const prs: { name: string; kind: string }[] = []
    draft.exercises.forEach((e) => {
      const done = e.sets.filter((s) => s.done && s.weight && s.reps)
      if (!done.length || e.skipped) return
      detectPRs(done, snap.prev[e.exerciseId] ?? null).forEach((kind) => prs.push({ name: e.name, kind }))
    })
    await enqueue(item)
    await saveDraft(null)
    let synced = false
    if (navigator.onLine) {
      const r = await syncOutbox().catch(() => ({ left: 1 }))
      synced = r.left === 0
    }
    buzz([40, 60, 40])
    setSummary({
      duration: (endedAt.getTime() - new Date(draft.startedAt).getTime()) / 1000,
      vol: volume(rows), sets: rows.length, prs, synced,
    })
    setState('summary')
  }

  if (state === 'loading') {
    return <div className="flex min-h-dvh items-center justify-center"><div className="skeleton h-24 w-24 rounded-full" aria-label={tc('loading')} /></div>
  }
  if (state === 'none' || !snap || !draft || !day) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-3xl font-bold">{t('noRoutine')}</p>
        <p className="text-muted">{t('noRoutineHint')}</p>
        <Link href="/app" className="btn btn-primary">{tc('back')}</Link>
      </div>
    )
  }

  if (state === 'summary' && summary) {
    return (
      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col gap-5 overflow-hidden px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 22 }).map((_, i) => (
            <span key={i} className="confetti-piece" style={{ left: `${(i * 4.7 + 3) % 100}%`, background: i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--primary)' : 'var(--text)', animationDelay: `${(i % 7) * 0.12}s` }} />
          ))}
        </div>
        <div className="animate-pop relative text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-accent text-accent-fg"><Check size={54} strokeWidth={3} aria-hidden /></div>
          <h1 className="font-display mt-4 text-5xl font-extrabold uppercase">{t('doneTitle')}</h1>
          <p className="text-muted">{draft.dayName}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="card p-3"><p className="text-xs font-semibold uppercase text-muted">{t('duration')}</p><p className="font-display text-3xl font-extrabold tnum">{formatDuration(summary.duration)}</p></div>
          <div className="card p-3"><p className="text-xs font-semibold uppercase text-muted">{t('volume')}</p><p className="font-display text-3xl font-extrabold tnum">{Math.round(units === 'lb' ? summary.vol * 2.20462 : summary.vol).toLocaleString(locale)}<span className="text-base text-muted"> {units}</span></p></div>
          <div className="card p-3"><p className="text-xs font-semibold uppercase text-muted">{t('seriesDone')}</p><p className="font-display text-3xl font-extrabold tnum">{summary.sets}</p></div>
        </div>
        {summary.prs.length > 0 && (
          <section className="card animate-rise p-4" aria-label={t('records')}>
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><Trophy className="text-primary-text" aria-hidden /> {t('records')}</h2>
            <ul className="mt-2 space-y-1.5">
              {summary.prs.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold">{p.name}</span><span className="chip chip-warn">{t(`pr.${p.kind}`)}</span></li>
              ))}
            </ul>
          </section>
        )}
        <p className={`rounded-xl p-3 text-center text-sm font-medium ${summary.synced ? 'bg-success-soft text-success' : 'bg-warn-soft'}`}>
          {summary.synced ? t('savedOnline') : t('savedOffline')}
        </p>
        <Link href="/app" className="btn btn-primary btn-lg mt-auto w-full" onClick={() => setTimeout(() => location.assign('/app'), 0)}>{t('backHome')}</Link>
      </div>
    )
  }

  const ex = day.exercises[idx]
  const dEx = draft.exercises[idx]
  const doneSets = draft.exercises.reduce((n, e) => n + (e.skipped ? 0 : e.sets.filter((s) => s.done).length), 0)
  const totalSets = draft.exercises.reduce((n, e) => n + (e.skipped ? 0 : e.sets.length), 0)
  const elapsed = (now - new Date(draft.startedAt).getTime()) / 1000
  const last = snap.last[ex.exercise_id] ?? []
  const remaining = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between">
          <button className="btn btn-ghost !min-h-11 !w-11 !px-0" onClick={() => setConfirmExit(true)} aria-label={t('exit')}><X size={20} aria-hidden /></button>
          <div className="text-center">
            <p className="font-display text-sm font-bold uppercase leading-none text-muted">{draft.dayName}</p>
            <p className="font-display text-3xl font-extrabold leading-none tnum" aria-label={t('elapsed')}>{formatDuration(elapsed)}</p>
          </div>
          <button className="btn btn-accent !min-h-11 !px-3 text-sm" onClick={() => (doneSets < totalSets ? setFinishOpen(true) : finish())}>
            <Flag size={16} aria-hidden /> {t('finish')}
          </button>
        </div>
        <div className="mt-2 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets} aria-label={t('progress')}>
          {draft.exercises.map((e, i) => {
            const n = e.sets.filter((s) => s.done).length
            return <span key={e.reId} className={`h-1.5 flex-1 rounded-full ${e.skipped ? 'bg-border' : n === e.sets.length ? 'bg-primary' : n > 0 ? 'bg-primary/50' : 'bg-surface-2'} ${i === idx ? 'ring-2 ring-primary-text ring-offset-1 ring-offset-bg' : ''}`} />
          })}
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-44 pt-4">
        <section key={ex.id} className="animate-rise">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{t('exerciseOf', { i: idx + 1, n: day.exercises.length })}</p>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-[1.05]">{dEx.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip chip-primary">{ex.muscle}</span>
            <span className="chip">{ex.equipment}</span>
            <span className="chip">{ex.sets} × {targetLabel(ex)}</span>
            <span className="chip"><Timer size={12} aria-hidden /> {ex.rest_sec}s</span>
          </div>
          {ex.notes && <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm font-medium">{ex.notes}</p>}
          {ex.media_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ex.media_url} alt={dEx.name} className="mt-3 max-h-56 w-full rounded-2xl object-cover" loading="lazy" />
          )}
          {ex.tips && (
            <details className="card mt-3 px-4 py-2 text-sm">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">{t('tips')} <ChevronDown size={16} aria-hidden /></summary>
              <p className="pb-2 text-muted">{ex.tips}</p>
            </details>
          )}
        </section>

        {dEx.skipped ? (
          <div className="card p-6 text-center">
            <p className="font-semibold">{t('skipped')}</p>
            <button className="btn btn-ghost mt-3" onClick={() => update((d) => { d.exercises[idx].skipped = false })}>{t('undo')}</button>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {dEx.sets.map((s, si) => (
              <SetRow
                key={si}
                index={si + 1}
                set={s}
                timed={Boolean(ex.duration_sec)}
                units={units}
                step={step}
                reference={last[si] ?? null}
                onChange={(patch) => update((d) => { Object.assign(d.exercises[idx].sets[si], patch) })}
                onToggle={() => toggleSet(idx, si, ex.rest_sec)}
                onRemove={dEx.sets.length > 1 ? () => update((d) => { d.exercises[idx].sets.splice(si, 1) }) : undefined}
              />
            ))}
            <li>
              <button className="btn btn-ghost w-full" onClick={() => update((d) => { const a = d.exercises[idx].sets; a.push({ ...a[a.length - 1], done: false }) })}>
                <Plus size={18} aria-hidden /> {t('addSet')}
              </button>
            </li>
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {!dEx.skipped && <button className="btn btn-ghost !min-h-11 text-sm" onClick={() => update((d) => { d.exercises[idx].skipped = true })}><SkipForward size={16} aria-hidden /> {t('skip')}</button>}
          <button className="btn btn-ghost !min-h-11 text-sm" onClick={() => setSwapFor(idx)}><Repeat size={16} aria-hidden /> {t('swap')}</button>
        </div>
        <div>
          <label htmlFor="note" className="label flex items-center gap-1.5"><StickyNote size={14} aria-hidden /> {t('note')}</label>
          <textarea id="note" rows={2} className="input" value={dEx.note} placeholder={t('notePlaceholder')} onChange={(e) => update((d) => { d.exercises[idx].note = e.target.value })} />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-lg">
          {rest && (
            <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-2 text-primary-fg" role="timer" aria-live="off">
              <Timer size={20} aria-hidden />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase opacity-80">{t('rest')}</p>
                <p className="font-display text-3xl font-extrabold leading-none tnum">{formatDuration(remaining)}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/30"><div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(remaining / rest.total) * 100}%` }} /></div>
              </div>
              <button className="btn !min-h-11 border border-white/40 text-sm text-primary-fg" onClick={() => setRest((r) => (r ? { ...r, end: r.end + 15000, total: r.total + 15 } : r))}>+15s</button>
              <button className="btn btn-accent !min-h-11 text-sm" onClick={() => setRest(null)}>{t('skipRest')}</button>
            </div>
          )}
          <div className="flex items-center gap-3 p-3">
            <button className="btn btn-ghost !w-14 !px-0" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label={t('prev')}><ArrowLeft aria-hidden /></button>
            <p className="flex-1 text-center text-sm font-semibold text-muted tnum">{doneSets}/{totalSets} {t('seriesShort')}</p>
            {idx < day.exercises.length - 1 ? (
              <button className="btn btn-primary btn-lg !min-h-14 flex-[1.4]" onClick={() => setIdx(idx + 1)}>{t('next')} <ArrowRight aria-hidden /></button>
            ) : (
              <button className="btn btn-accent btn-lg !min-h-14 flex-[1.4]" onClick={() => (doneSets < totalSets ? setFinishOpen(true) : finish())}><Flag aria-hidden /> {t('finish')}</button>
            )}
          </div>
        </div>
      </div>

      {confirmExit && (
        <Modal title={t('exitTitle')} onClose={() => setConfirmExit(false)}>
          <p className="text-sm text-muted">{t('exitBody')}</p>
          <div className="mt-4 grid gap-2">
            <button className="btn btn-primary" onClick={() => setConfirmExit(false)}>{t('keepGoing')}</button>
            <Link href="/app" className="btn btn-ghost">{t('saveAndExit')}</Link>
            <button className="btn btn-danger" onClick={async () => { await saveDraft(null); location.assign('/app') }}>{t('discard')}</button>
          </div>
        </Modal>
      )}
      {swapFor !== null && (
        <SwapSheet
          locale={locale}
          onClose={() => setSwapFor(null)}
          onPick={(e) => {
            update((d) => { d.exercises[swapFor].exerciseId = e.id; d.exercises[swapFor].name = locale === 'es' ? e.name_es : e.name_ca })
            setSwapFor(null)
          }}
        />
      )}
      {finishOpen && (
        <Modal title={t('unfinishedTitle')} onClose={() => setFinishOpen(false)}>
          <p className="text-sm text-muted">{t('unfinishedBody', { n: totalSets - doneSets })}</p>
          <div className="mt-4 grid gap-2">
            <button className="btn btn-accent" onClick={() => { setFinishOpen(false); finish() }}>{t('finishAnyway')}</button>
            <button className="btn btn-ghost" onClick={() => setFinishOpen(false)}>{t('keepGoing')}</button>
          </div>
        </Modal>
      )}
    </div>
  )

}
