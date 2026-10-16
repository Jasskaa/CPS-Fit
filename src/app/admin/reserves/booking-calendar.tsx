'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Repeat, Users } from 'lucide-react'
import { Dialog, ActionForm } from '@/components/club-client'
import { clubInstant, eur } from '@/lib/format'
import { priceBreakdown, type PricingRule } from '@/modules/pricing/pricing'
import { cancelBooking, collectBooking, createBooking, findPeopleForBooking, markNoShow, moveBooking } from './actions'

export interface CalRes { id: string; name: string; kind: string; open: number; close: number; slot: number; durations: number[] }
export interface CalBooking {
  id: string; resource_id: string; startMin: number; endMin: number; status: string; kind: string; title: string | null
  person: string | null; personId: string | null; price: number; invoiceId: string | null; invoiceStatus: string | null
  open_match: boolean; players_needed: number | null; joined: number; series: boolean; startLabel: string; notes: string | null
}
export interface Extra { id: string; name: string; member: number; non: number }

const ROW = 26
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const BLOCK_STYLE: Record<string, string> = {
  booking: 'bg-primary text-primary-fg', rental: 'bg-primary text-primary-fg', block: 'bg-surface-2 text-muted border border-dashed border-border',
  class: 'bg-[var(--navy,#003154)] text-white', training: 'bg-[var(--navy,#003154)] text-white', match: 'bg-[var(--navy,#003154)] text-white',
}

export function BookingCalendar({ date, resources, bookings, rules, extras, writable, locale }: {
  date: string; resources: CalRes[]; bookings: CalBooking[]; rules: PricingRule[]; extras: Extra[]; writable: boolean; locale: string
}) {
  const t = useTranslations('club.bookings')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [slot, setSlot] = useState<{ res: CalRes; min: number } | null>(null)
  const [sel, setSel] = useState<CalBooking | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const dayStart = Math.min(...resources.map((r) => r.open)), dayEnd = Math.max(...resources.map((r) => r.close))
  const rows = Math.max(1, Math.round((dayEnd - dayStart) / 30))
  const nowMin = useNow(date)

  const drop = (res: CalRes, min: number, id: string) => start(async () => {
    const r = await moveBooking(id, res.id, date, hhmm(min))
    setMsg(r.ok ? null : `${t('moveFailed')}: ${r.error}`)
    router.refresh()
  })

  return (
    <div className="space-y-3">
      {msg && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 text-sm font-medium text-danger">{msg}</p>}
      <div className={`card overflow-x-auto ${pending ? 'opacity-70' : ''}`}>
        <div className="grid min-w-[40rem]" style={{ gridTemplateColumns: `3.5rem repeat(${resources.length}, minmax(9rem, 1fr))` }}>
          <div className="sticky top-0 z-10 border-b border-border bg-surface" />
          {resources.map((r) => <div key={r.id} className="sticky top-0 z-10 border-b border-l border-border bg-surface px-3 py-2.5 text-center text-sm font-bold">{r.name}</div>)}
          <div className="relative" style={{ height: rows * ROW }}>
            {Array.from({ length: Math.ceil(rows / 2) }, (_, i) => <span key={i} className="absolute right-2 -translate-y-1/2 text-[0.7rem] text-muted tnum" style={{ top: i * 2 * ROW + (i === 0 ? 8 : 0) }}>{hhmm(dayStart + i * 60)}</span>)}
          </div>
          {resources.map((r) => (
            <div key={r.id} className="relative border-l border-border" style={{ height: rows * ROW }}>
              {Array.from({ length: rows }, (_, i) => {
                const min = dayStart + i * 30
                const closed = min < r.open || min >= r.close
                return (
                  <button
                    key={i} type="button" disabled={closed || !writable}
                    aria-label={`${r.name} ${hhmm(min)}`}
                    onClick={() => setSlot({ res: r, min })}
                    onDragOver={(e) => writable && !closed && e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && !closed) drop(r, min, id) }}
                    className={`block w-full border-t ${i % 2 ? 'border-border/40' : 'border-border'} ${closed ? 'bg-surface-2/60' : 'hover:bg-primary-soft/60'}`}
                    style={{ height: ROW }}
                  />
                )
              })}
              {bookings.filter((b) => b.resource_id === r.id).map((b) => {
                const top = ((b.startMin - dayStart) / 30) * ROW, h = Math.max(ROW, ((b.endMin - b.startMin) / 30) * ROW)
                const paid = b.invoiceStatus === 'paid'
                return (
                  <button
                    key={b.id} type="button" draggable={writable && b.status !== 'blocked' ? true : writable}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', b.id)}
                    onClick={() => setSel(b)}
                    className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left text-xs shadow-sm ring-1 ring-black/10 ${BLOCK_STYLE[b.kind] ?? BLOCK_STYLE.booking}`}
                    style={{ top: top + 1, height: h - 2 }}
                  >
                    <span className="flex items-center justify-between gap-1 font-bold"><span className="truncate">{b.person ?? b.title ?? t(`kind.${b.kind}`)}</span>{b.series && <Repeat size={11} aria-label={t('recurring')} />}</span>
                    {h > ROW && <span className="block truncate opacity-80">{hhmm(b.startMin)}–{hhmm(b.endMin)} {b.kind === 'booking' ? `· ${eur(b.price, locale)}` : ''}</span>}
                    {h > ROW * 1.9 && b.kind === 'booking' && <span className={`mt-0.5 inline-block rounded px-1 text-[0.65rem] font-bold ${paid ? 'bg-success text-white' : 'bg-warn text-black'}`}>{paid ? t('paid') : t('unpaid')}</span>}
                    {b.open_match && <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-white/25 px-1 text-[0.65rem] font-bold"><Users size={10} aria-hidden />{b.joined}/{b.players_needed ?? 4}</span>}
                  </button>
                )
              })}
              {nowMin != null && nowMin >= dayStart && nowMin <= dayEnd && <span aria-hidden className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-danger" style={{ top: ((nowMin - dayStart) / 30) * ROW }} />}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(slot)} onClose={() => setSlot(null)} title={t('newBooking')} wide>
        {slot && <NewBooking date={date} res={slot.res} resources={resources} min={slot.min} rules={rules} extras={extras} locale={locale} />}
      </Dialog>
      <Dialog open={Boolean(sel)} onClose={() => setSel(null)} title={sel?.person ?? sel?.title ?? ''}>
        {sel && <Detail b={sel} locale={locale} resName={resources.find((r) => r.id === sel.resource_id)?.name ?? ''} onDone={() => { setSel(null); router.refresh() }} writable={writable} />}
      </Dialog>
    </div>
  )
}

function useNow(date: string) {
  const [m, setM] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
      const g = (k: string) => p.find((x) => x.type === k)!.value
      setM(`${g('year')}-${g('month')}-${g('day')}` === date ? Number(g('hour')) * 60 + Number(g('minute')) : null)
    }
    tick()
    const h = setInterval(tick, 60_000)
    return () => clearInterval(h)
  }, [date])
  return m
}

function Detail({ b, resName, locale, onDone, writable }: { b: CalBooking; resName: string; locale: string; onDone: () => void; writable: boolean }) {
  const t = useTranslations('club.bookings')
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (r.ok) onDone(); else setErr(r.error ?? 'error') })
  return (
    <div className="space-y-4">
      <dl className="text-sm">
        {[[t('resource'), resName], [t('when'), `${b.startLabel} · ${hhmm(b.startMin)}–${hhmm(b.endMin)}`], [t('type'), t(`kind.${b.kind}`)], [t('status'), t(`st.${b.status}`)],
          ...(b.kind === 'booking' ? [[t('price'), eur(b.price, locale)], [t('invoice'), b.invoiceStatus ? t(`inv.${b.invoiceStatus}`) : t('notInvoiced')]] : []), ...(b.notes ? [[t('notes'), b.notes]] : [])].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border py-2 last:border-0"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      {b.personId && <Link className="btn btn-ghost w-full" href={`/admin/persones/${b.personId}`}>{t('openPerson')}</Link>}
      {err && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 text-sm text-danger">{err}</p>}
      {writable && b.status !== 'cancelled' && (
        <div className="flex flex-wrap gap-2">
          {b.kind === 'booking' && b.invoiceStatus !== 'paid' && (<>
            <button className="btn btn-primary" disabled={pending} onClick={() => run(() => collectBooking(b.id, 'cash'))}>{t('collectCash')}</button>
            <button className="btn btn-ghost" disabled={pending} onClick={() => run(() => collectBooking(b.id, 'card'))}>{t('collectCard')}</button>
          </>)}
          {b.kind === 'booking' && b.status === 'confirmed' && <button className="btn btn-ghost" disabled={pending} onClick={() => run(() => markNoShow(b.id))}>{t('noShow')}</button>}
          <button className="btn btn-danger" disabled={pending} onClick={() => { if (window.confirm(t('confirmCancel'))) run(() => cancelBooking(b.id, undefined, b.invoiceStatus === 'paid')) }}>{t('cancel')}</button>
        </div>
      )}
    </div>
  )
}

function NewBooking({ date, res, resources, min, rules, extras, locale }: { date: string; res: CalRes; resources: CalRes[]; min: number; rules: PricingRule[]; extras: Extra[]; locale: string }) {
  const t = useTranslations('club.bookings')
  const [resId, setResId] = useState(res.id)
  const [kind, setKind] = useState('booking')
  const [start, setStart] = useState(hhmm(min))
  const cur = resources.find((r) => r.id === resId) ?? res
  const [minutes, setMinutes] = useState(cur.durations[0] ?? 60)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ id: string; name: string; sub: string; member: boolean }[]>([])
  const [person, setPerson] = useState<{ id: string; name: string; member: boolean } | null>(null)
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [repeat, setRepeat] = useState(0)
  const needsPerson = kind === 'booking' || kind === 'rental'

  useEffect(() => {
    if (q.trim().length < 2 || person) { setFound([]); return }
    const h = setTimeout(async () => setFound(await findPeopleForBooking(q)), 200)
    return () => clearTimeout(h)
  }, [q, person])

  const durations = kind === 'booking' ? cur.durations : [30, 60, 90, 120, 180, 240]
  const startsAt = useMemo(() => clubInstant(date, start), [date, start])
  const endsAt = new Date(startsAt.getTime() + minutes * 60_000)
  const aud = person?.member ? 'member' : 'non_member'
  const breakdown = needsPerson ? priceBreakdown(rules, cur.kind, aud, startsAt, endsAt) : []
  const base = breakdown.reduce((a, b) => a + b.cents, 0)
  const extraTotal = extras.reduce((a, e) => a + (picked[e.id] ?? 0) * (aud === 'member' ? e.member : e.non), 0)
  const slots: string[] = []
  for (let m = cur.open; m < cur.close; m += cur.slot) slots.push(hhmm(m))

  return (
    <ActionForm action={createBooking} submit={t('create')} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="person_id" value={person?.id ?? ''} />
      {Object.entries(picked).filter(([, n]) => n > 0).map(([id, n]) => <input key={id} type="hidden" name="extra" value={`${id}:${n}`} />)}
      <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('resource')}</span>
        <select name="resource_id" value={resId} onChange={(e) => { setResId(e.target.value); const r = resources.find((x) => x.id === e.target.value); if (r && !r.durations.includes(minutes)) setMinutes(r.durations[0]) }} className="input">{resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('type')}</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input">{['booking', 'block', 'class', 'training', 'match', 'rental'].map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('start')}</span>
        <select name="start" value={start} onChange={(e) => setStart(e.target.value)} className="input tnum">{slots.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('duration')}</span>
        <select name="minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="input">{durations.map((d) => <option key={d} value={d}>{d} min</option>)}</select></label>

      {needsPerson ? (
        <div className="space-y-1 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('person')}</span>
          {person ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"><span className="font-semibold">{person.name} <span className={`chip ${person.member ? 'chip-primary' : ''}`}>{person.member ? t('member') : t('nonMember')}</span></span><button type="button" className="text-primary-text underline" onClick={() => { setPerson(null); setQ('') }}>{t('change')}</button></div>
          ) : (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder={t('searchPerson')} autoComplete="off" />
              <ul className="divide-y divide-border rounded-xl border border-border empty:hidden">{found.map((p) => <li key={p.id}><button type="button" className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-surface-2" onClick={() => setPerson(p)}><span className="font-semibold">{p.name}</span><span className="text-xs text-muted">{p.member ? t('member') : t('nonMember')}</span></button></li>)}</ul>
            </>
          )}
        </div>
      ) : (
        <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('titleField')}</span><input name="title" className="input" /></label>
      )}

      {needsPerson && extras.length > 0 && (
        <fieldset className="space-y-1 sm:col-span-2"><legend className="text-xs font-semibold uppercase tracking-wide text-muted">{t('extras')}</legend>
          <div className="flex flex-wrap gap-2">{extras.map((e) => (
            <label key={e.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><input type="number" min={0} max={9} value={picked[e.id] ?? 0} onChange={(ev) => setPicked({ ...picked, [e.id]: Number(ev.target.value) })} className="input !min-h-8 !w-14 !px-2" aria-label={e.name} />{e.name} <span className="text-muted tnum">{eur(aud === 'member' ? e.member : e.non, locale)}</span></label>
          ))}</div></fieldset>
      )}

      <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('repeat')}</span>
        <select name="repeat_weeks" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))} className="input"><option value={0}>{t('noRepeat')}</option>{[3, 7, 11, 15, 25].map((n) => <option key={n} value={n}>{t('weekly', { n: n + 1 })}</option>)}</select></label>
      {needsPerson && (
        <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('payment')}</span>
          <select name="pay" defaultValue="later" className="input"><option value="later">{t('payLater')}</option><option value="cash">{t('payCash')}</option><option value="card">{t('payCard')}</option></select></label>
      )}
      {kind === 'booking' && cur.kind === 'padel' && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="open_match" /> {t('openMatch')}</label>}
      <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('notes')}</span><input name="notes" className="input" /></label>

      {needsPerson && (
        <div className="rounded-xl bg-primary-soft p-3 text-sm sm:col-span-2" aria-live="polite">
          {breakdown.map((b) => <p key={b.rate} className="flex justify-between"><span>{b.minutes} min × {eur(b.rate, locale)}/h</span><span className="tnum">{eur(b.cents, locale)}</span></p>)}
          {extraTotal > 0 && <p className="flex justify-between"><span>{t('extras')}</span><span className="tnum">{eur(extraTotal, locale)}</span></p>}
          <p className="mt-1 flex justify-between border-t border-primary/20 pt-1 font-display text-xl font-extrabold"><span>{t('total')}{repeat > 0 ? ` × ${repeat + 1}` : ''}</span><span className="tnum">{eur((base + extraTotal) * (repeat + 1), locale)}</span></p>
        </div>
      )}
    </ActionForm>
  )
}
