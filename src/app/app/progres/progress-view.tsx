'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Loader2, Trophy } from 'lucide-react'
import type { Measurement } from '@/lib/types'
import { dayKey, formatDuration, toDisplayWeight } from '@/lib/training'
import { EmptyState } from '@/components/ui'
import type { PRRow, PhotoRow, Point, SessionRow } from '@/lib/progress-data'
import { addMeasurement } from './actions'
import { Photos } from './photos'


type Tab = 'sessions' | 'exercises' | 'records' | 'body'

const axis = { fontSize: 11, fill: 'var(--muted)' }
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 12 }

export function ProgressView({
  units, locale, sessions, sessionVolume, points, names, prs, measurements, photos, memberId, title, readOnly = false,
}: {
  units: 'kg' | 'lb'; locale: string; photos: PhotoRow[]; memberId: string; readOnly?: boolean; sessions: SessionRow[]; sessionVolume: Record<string, { vol: number; sets: number }>
  points: Point[]; names: Record<string, string>; prs: PRRow[]; measurements: Measurement[]; title: string
}) {
  const t = useTranslations('progress')
  const [tab, setTab] = useState<Tab>('sessions')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'sessions', label: t('tabSessions') }, { id: 'exercises', label: t('tabExercises') },
    { id: 'records', label: t('tabRecords') }, { id: 'body', label: t('tabBody') },
  ]
  return (
    <div className="space-y-4">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{title}</h1>
      <div role="tablist" aria-label={title} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`btn !min-h-11 shrink-0 text-sm ${tab === x.id ? 'btn-primary' : 'btn-ghost'}`}>{x.label}</button>
        ))}
      </div>
      {tab === 'sessions' && <Sessions sessions={sessions} sessionVolume={sessionVolume} locale={locale} units={units} />}
      {tab === 'exercises' && <Exercises points={points} names={names} units={units} locale={locale} />}
      {tab === 'records' && <Records prs={prs} units={units} locale={locale} />}
      {tab === 'body' && <Body measurements={measurements} locale={locale} readOnly={readOnly} photos={photos} memberId={memberId} />}
    </div>
  )
}

function Sessions({ sessions, sessionVolume, locale, units }: { sessions: SessionRow[]; sessionVolume: Record<string, { vol: number; sets: number }>; locale: string; units: 'kg' | 'lb' }) {
  const t = useTranslations('progress')
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })
  const byDay = useMemo(() => {
    const m = new Map<string, SessionRow[]>()
    sessions.forEach((s) => m.set(dayKey(s.started_at), [...(m.get(dayKey(s.started_at)) ?? []), s]))
    return m
  }, [sessions])
  const first = (month.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i - first + 1)
  const today = dayKey(new Date())
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' })), [locale])
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const monthCount = sessions.filter((s) => { const d = new Date(s.started_at); return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear() }).length

  if (sessions.length === 0) return <EmptyState title={t('noSessions')} hint={t('noSessionsHint')} />
  return (
    <div className="space-y-4">
      <section className="card p-4" aria-label={t('calendar')}>
        <div className="mb-2 flex items-center justify-between">
          <button className="btn btn-ghost !w-11 !px-0" onClick={() => shift(-1)} aria-label={t('prevMonth')}><ChevronLeft aria-hidden /></button>
          <div className="text-center">
            <p className="font-display text-2xl font-bold first-letter:uppercase">{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</p>
            <p className="text-xs text-muted">{t('monthCount', { n: monthCount })}</p>
          </div>
          <button className="btn btn-ghost !w-11 !px-0" onClick={() => shift(1)} aria-label={t('nextMonth')}><ChevronRight aria-hidden /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-muted">{weekdays.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (n < 1 || n > days) return <span key={i} />
            const key = dayKey(new Date(month.getFullYear(), month.getMonth(), n))
            const hit = byDay.get(key)
            return (
              <span key={i} className={`grid aspect-square place-items-center rounded-xl text-sm font-semibold tnum ${hit ? 'bg-primary text-primary-fg' : 'text-muted'} ${key === today ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''}`} aria-label={hit ? `${n}: ${hit.map((h) => h.day_name).join(', ')}` : undefined}>
                {n}
              </span>
            )
          })}
        </div>
      </section>
      <ul className="space-y-2">
        {sessions.slice(0, 20).map((s) => {
          const dur = s.ended_at ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000 : 0
          const sv = sessionVolume[s.id]
          return (
            <li key={s.id} className="card flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-semibold">{s.day_name ?? '—'}</p>
                <p className="text-xs text-muted first-letter:uppercase">{new Date(s.started_at).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              </div>
              <div className="text-right text-xs text-muted tnum">
                {dur > 0 && <p>{formatDuration(dur)}</p>}
                {sv && <p>{Math.round(units === 'lb' ? sv.vol * 2.20462 : sv.vol).toLocaleString(locale)} {units} · {sv.sets} {t('sets')}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Exercises({ points, names, units, locale }: { points: Point[]; names: Record<string, string>; units: 'kg' | 'lb'; locale: string }) {
  const t = useTranslations('progress')
  const options = useMemo(() => {
    const count = new Map<string, number>()
    points.forEach((p) => count.set(p.e, (count.get(p.e) ?? 0) + 1))
    return [...count.entries()].filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [points])
  const [ex, setEx] = useState(options[0] ?? '')
  const [metric, setMetric] = useState<'e1' | 'w' | 'v'>('e1')
  const data = useMemo(
    () => points.filter((p) => p.e === ex).sort((a, b) => a.d.localeCompare(b.d)).map((p) => ({
      date: new Date(p.d).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      e1: toDisplayWeight(p.e1, units), w: toDisplayWeight(p.w, units), v: Math.round(units === 'lb' ? p.v * 2.20462 : p.v),
    })),
    [points, ex, units, locale],
  )
  if (!options.length) return <EmptyState title={t('noData')} hint={t('noSessionsHint')} />
  const last = data[data.length - 1]
  const first = data[0]
  const gain = last && first ? Math.round((last.e1 - first.e1) * 10) / 10 : 0
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">{t('exercise')}</span>
        <select className="input" value={ex} onChange={(e) => setEx(e.target.value)}>
          {options.map((id) => <option key={id} value={id}>{names[id] ?? id}</option>)}
        </select>
      </label>
      <div role="group" aria-label={t('metric')} className="flex gap-2">
        {([['e1', t('e1rm')], ['w', t('maxWeight')], ['v', t('volume')]] as const).map(([k, l]) => (
          <button key={k} aria-pressed={metric === k} className={`btn !min-h-11 flex-1 text-sm ${metric === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetric(k)}>{l}</button>
        ))}
      </div>
      <section className="card p-3" aria-label={`${names[ex] ?? ''} · ${t('chart')}`}>
        <div className="flex items-end justify-between px-1 pb-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">{metric === 'e1' ? t('e1rm') : metric === 'w' ? t('maxWeight') : t('volume')}</p>
            <p className="font-display text-4xl font-extrabold tnum">{last ? last[metric] : '—'}<span className="text-lg text-muted"> {units}</span></p>
          </div>
          {data.length > 1 && <span className={`chip ${gain >= 0 ? 'chip-success' : 'chip-danger'}`}>{gain >= 0 ? '+' : ''}{gain} {units}</span>}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'v' ? (
              <BarChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="v" fill="var(--primary)" radius={[6, 6, 0, 0]} name={t('volume')} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axis} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey={metric} stroke="var(--primary-text)" strokeWidth={3} dot={{ r: 3, fill: 'var(--primary-text)' }} activeDot={{ r: 6 }} name={metric === 'e1' ? t('e1rm') : t('maxWeight')} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}

function Records({ prs, units, locale }: { prs: PRRow[]; units: 'kg' | 'lb'; locale: string }) {
  const t = useTranslations('progress')
  if (!prs.length) return <EmptyState icon={<Trophy size={28} />} title={t('noRecords')} hint={t('noRecordsHint')} />
  return (
    <ul className="space-y-2">
      {prs.map((p) => (
        <li key={p.id} className="card flex items-center gap-3 p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"><Trophy size={18} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="text-xs text-muted">{new Date(p.at).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</p>
          </div>
          <p className="font-display text-3xl font-extrabold tnum">{toDisplayWeight(p.value, units)}<span className="text-sm text-muted"> {units}</span></p>
        </li>
      ))}
    </ul>
  )
}

function Body({ measurements, locale, readOnly, photos, memberId }: { measurements: Measurement[]; locale: string; readOnly: boolean; photos: PhotoRow[]; memberId: string }) {
  const t = useTranslations('progress')
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const data = measurements.map((m) => ({ date: new Date(m.measured_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' }), weight: m.weight_kg, fat: m.body_fat_pct, waist: m.waist_cm }))
  const last = measurements[measurements.length - 1]
  const fields: [string, string][] = [['weight_kg', t('weight')], ['body_fat_pct', t('bodyFat')], ['waist_cm', t('waist')], ['chest_cm', t('chest')], ['hip_cm', t('hip')], ['arm_cm', t('arm')], ['thigh_cm', t('thigh')]]
  return (
    <div className="space-y-3">
      {data.length > 1 && (
        <section className="card p-3" aria-label={t('weightChart')}>
          <div className="px-1 pb-2">
            <p className="text-xs font-semibold uppercase text-muted">{t('weight')}</p>
            <p className="font-display text-4xl font-extrabold tnum">{last?.weight_kg ?? '—'}<span className="text-lg text-muted"> kg</span></p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axis} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="weight" stroke="var(--primary-text)" strokeWidth={3} fill="url(#wg)" name={t('weight')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
      {!readOnly && <button className="btn btn-primary w-full" onClick={() => setOpen(!open)} aria-expanded={open}>{t('addMeasurement')}</button>}
      {open && !readOnly && (
        <form
          className="card animate-rise grid grid-cols-2 gap-3 p-4"
          action={(fd) => start(async () => { await addMeasurement(fd); setOpen(false) })}
        >
          {fields.map(([name, label]) => (
            <label key={name} className="block">
              <span className="label">{label}</span>
              <input name={name} type="number" step="0.1" min="0" inputMode="decimal" className="input" />
            </label>
          ))}
          <button className="btn btn-accent col-span-2" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : t('save')}</button>
        </form>
      )}
      {measurements.length === 0 && <EmptyState title={t('noMeasurements')} hint={t('noMeasurementsHint')} />}
      <Photos photos={photos} memberId={memberId} readOnly={readOnly} locale={locale} />
      <ul className="space-y-2">
        {[...measurements].reverse().slice(0, 8).map((m) => (
          <li key={m.id} className="card flex items-center justify-between p-3 text-sm">
            <span className="font-semibold capitalize">{new Date(m.measured_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="text-muted tnum">{m.weight_kg ? `${m.weight_kg} kg` : ''}{m.body_fat_pct ? ` · ${m.body_fat_pct}%` : ''}{m.waist_cm ? ` · ${m.waist_cm} cm` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
