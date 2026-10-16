import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { pageCtx, num, str } from '@/lib/ctx'
import { clubInstant, clubParts, eur, fmtDate, fmtDateTime } from '@/lib/format'
import { DataTable, Field, PageHeader, Pager, Section, StatusChip, td, th, trow } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal } from '@/components/club-client'
import { RefreshOnChange } from '@/components/refresh-on-change'
import { EmptyState } from '@/components/ui'
import type { PricingRule } from '@/modules/pricing/pricing'
import { BookingCalendar, type CalBooking, type CalRes } from './booking-calendar'
import { removeWaiting, updatePricePerHour } from './actions'

export const metadata = { title: 'Reserves' }
const TABS = ['calendar', 'list', 'waitlist', 'tariffs'] as const
const KINDS = ['padel', 'court', 'hall', 'field', 'sauna', 'room']
const PAGE = 25

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const { t, locale, supabase, writable, profile } = await pageCtx('bookings')
  const tab = (TABS as readonly string[]).includes(str(sp.tab)) ? str(sp.tab) : 'calendar'
  const today = clubParts(new Date()).date
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(sp.date)) ? str(sp.date) : today
  const kind = KINDS.includes(str(sp.kind)) ? str(sp.kind) : 'padel'
  const q = (extra: Record<string, string>) => `/admin/reserves?${new URLSearchParams({ tab, date, kind, ...extra })}`

  return (
    <div className="space-y-5">
      <PageHeader title={t('club.bookings.title')} subtitle={t('club.bookings.subtitle')} />
      <nav className="flex gap-1 rounded-xl bg-surface-2 p-1" aria-label={t('club.bookings.title')}>
        {TABS.map((x) => <Link key={x} href={`/admin/reserves?tab=${x}`} aria-current={tab === x ? 'page' : undefined} className={`flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold ${tab === x ? 'bg-surface text-primary-text shadow-sm' : 'text-muted hover:text-text'}`}>{t(`club.bookings.tabs.${x}`)}</Link>)}
      </nav>
      {tab === 'calendar' && <Calendar />}
      {tab === 'list' && <List />}
      {tab === 'waitlist' && <Waitlist />}
      {tab === 'tariffs' && <Tariffs />}
    </div>
  )

  async function Calendar() {
    const { data: res } = await supabase.from('resources').select('id, name, kind, slot_min, open_time, close_time, durations').eq('kind', kind).eq('active', true).order('code')
    const resources: CalRes[] = (res ?? []).map((r) => ({ id: r.id, name: r.name, kind: r.kind, open: toMin(r.open_time), close: toMin(r.close_time), slot: r.slot_min, durations: r.durations }))
    const from = clubInstant(date, '00:00'), to = clubInstant(addDays(date, 1), '00:00')
    const ids = resources.map((r) => r.id)
    const [{ data: bks }, { data: rules }, { data: ex }, { data: kinds }] = await Promise.all([
      ids.length ? supabase.from('bookings').select('id, resource_id, starts_at, ends_at, status, kind, title, price_cents, open_match, players_needed, series_id, notes, invoice_id, people!bookings_person_id_fkey(id, first_name, last_name), invoices!bookings_invoice_id_fkey(status)').in('resource_id', ids).in('status', ['confirmed', 'blocked', 'no_show']).lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()) : Promise.resolve({ data: [] }),
      supabase.from('pricing_rules').select('*'),
      supabase.from('products').select('id, name_ca, price_member_cents, price_non_member_cents').eq('kind', 'extra').eq('active', true).order('sort'),
      supabase.from('resources').select('kind').eq('active', true),
    ])
    const joined = new Map<string, number>()
    if (bks?.length) { const { data: sl } = await supabase.from('booking_slots').select('id, players_joined').in('id', bks.map((b) => b.id)); sl?.forEach((s) => joined.set(s.id, s.players_joined ?? 0)) }
    const bookings: CalBooking[] = (bks ?? []).map((b) => {
      const p = b.people as unknown as { id: string; first_name: string; last_name: string } | null
      const s = clubParts(b.starts_at), e = clubParts(b.ends_at)
      return {
        id: b.id, resource_id: b.resource_id, startMin: Math.round(s.hour * 60), endMin: e.date === s.date ? Math.round(e.hour * 60) : 24 * 60, status: b.status, kind: b.kind, title: b.title,
        person: p ? `${p.first_name} ${p.last_name}` : null, personId: p?.id ?? null, price: b.price_cents, invoiceId: b.invoice_id, invoiceStatus: (b.invoices as unknown as { status: string } | null)?.status ?? null,
        open_match: b.open_match, players_needed: b.players_needed, joined: joined.get(b.id) ?? 0, series: Boolean(b.series_id), startLabel: fmtDate(b.starts_at, locale, { weekday: 'short', day: 'numeric', month: 'short' }), notes: b.notes,
      }
    })
    const available = KINDS.filter((k) => kinds?.some((x) => x.kind === k))
    return (
      <div className="space-y-4">
        <RefreshOnChange tables={['bookings']} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link className="btn btn-ghost !min-h-10 !px-3" href={q({ date: addDays(date, -1) })} aria-label={t('club.common.prev')}><ChevronLeft size={16} /></Link>
            <form className="flex items-center gap-2"><input type="hidden" name="kind" value={kind} /><input type="date" name="date" defaultValue={date} className="input !w-auto" aria-label={t('club.common.date')} /><button className="btn btn-ghost !min-h-10">OK</button></form>
            <Link className="btn btn-ghost !min-h-10 !px-3" href={q({ date: addDays(date, 1) })} aria-label={t('club.common.next')}><ChevronRight size={16} /></Link>
            <Link className="btn btn-ghost !min-h-10" href={q({ date: today })}>{t('club.bookings.today')}</Link>
          </div>
          <p className="font-display text-2xl font-bold first-letter:uppercase">{fmtDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">{available.map((k) => <Link key={k} href={q({ kind: k })} aria-current={k === kind ? 'page' : undefined} className={`chip !min-h-9 !px-4 !text-sm ${k === kind ? 'chip-primary' : ''}`}>{t(`club.bookings.res.${k}`)}</Link>)}</div>
        {resources.length ? <BookingCalendar key={`${date}-${kind}`} date={date} resources={resources} bookings={bookings} rules={(rules ?? []) as PricingRule[]} extras={(ex ?? []).map((e) => ({ id: e.id, name: e.name_ca, member: e.price_member_cents, non: e.price_non_member_cents }))} writable={writable} locale={locale} /> : <EmptyState title={t('club.bookings.noResources')} />}
        <p className="text-xs text-muted">{t('club.bookings.hint')}</p>
      </div>
    )
  }

  async function List() {
    const page = num(sp.p), status = str(sp.status), from = str(sp.from), to = str(sp.to)
    let qy = supabase.from('bookings').select('id, starts_at, ends_at, status, kind, price_cents, resources(name), people!bookings_person_id_fkey(id, first_name, last_name), invoices!bookings_invoice_id_fkey(number, status)', { count: 'exact' }).order('starts_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    if (status) qy = qy.eq('status', status)
    if (from) qy = qy.gte('starts_at', clubInstant(from, '00:00').toISOString())
    if (to) qy = qy.lt('starts_at', clubInstant(addDays(to, 1), '00:00').toISOString())
    const { data, count } = await qy
    const params: Record<string, string> = { tab: 'list' }
    if (status) params.status = status; if (from) params.from = from; if (to) params.to = to
    return (
      <div className="space-y-4">
        <form className="card flex flex-wrap items-end gap-3 p-4"><input type="hidden" name="tab" value="list" />
          <select name="status" defaultValue={status} className="input !w-auto" aria-label={t('club.bookings.status')}><option value="">{t('club.common.all')}</option>{['confirmed', 'cancelled', 'no_show', 'blocked'].map((s) => <option key={s} value={s}>{t(`club.bookings.st.${s}`)}</option>)}</select>
          <label className="flex items-center gap-2 text-sm">{t('club.common.from')}<input type="date" name="from" defaultValue={from} className="input !w-auto" /></label>
          <label className="flex items-center gap-2 text-sm">{t('club.common.to')}<input type="date" name="to" defaultValue={to} className="input !w-auto" /></label>
          <button className="btn btn-primary">{t('club.people.filter')}</button>
          <a className="btn btn-ghost ml-auto" href={`/admin/reserves/export?${new URLSearchParams(params)}`}><Download size={16} aria-hidden /> {t('club.common.export')}</a>
        </form>
        {(data?.length ?? 0) === 0 ? <EmptyState title={t('club.bookings.empty')} /> : (
          <DataTable label={t('club.bookings.tabs.list')}>
            <thead><tr><th className={th}>{t('club.bookings.when')}</th><th className={th}>{t('club.bookings.resource')}</th><th className={th}>{t('club.bookings.person')}</th><th className={th}>{t('club.bookings.type')}</th><th className={`${th} text-right`}>{t('club.bookings.price')}</th><th className={th}>{t('club.bookings.status')}</th><th className={th}>{t('club.bookings.invoice')}</th></tr></thead>
            <tbody>{data!.map((b) => {
              const p = b.people as unknown as { id: string; first_name: string; last_name: string } | null
              const inv = b.invoices as unknown as { number: string; status: string } | null
              return <tr key={b.id} className={trow}>
                <td className={`${td} tnum`}>{fmtDateTime(b.starts_at, locale)}</td><td className={td}>{(b.resources as unknown as { name: string })?.name}</td>
                <td className={td}>{p ? <Link className="font-semibold hover:text-primary-text" href={`/admin/persones/${p.id}`}>{p.first_name} {p.last_name}</Link> : '—'}</td>
                <td className={td}>{t(`club.bookings.kind.${b.kind}`)}</td><td className={`${td} text-right tnum`}>{eur(b.price_cents, locale)}</td>
                <td className={td}><StatusChip value={b.status} label={t(`club.bookings.st.${b.status}`)} /></td>
                <td className={td}>{inv ? <StatusChip value={inv.status} label={inv.number} /> : <span className="text-muted">—</span>}</td>
              </tr>
            })}</tbody>
          </DataTable>
        )}
        <Pager page={page} pages={Math.max(1, Math.ceil((count ?? 0) / PAGE))} href={(p) => `/admin/reserves?${new URLSearchParams({ ...params, ...(p > 1 ? { p: String(p) } : {}) })}`} />
      </div>
    )
  }

  async function Waitlist() {
    const { data } = await supabase.from('booking_waitlist').select('id, starts_at, ends_at, notified_at, resources(name), people!bookings_person_id_fkey(id, first_name, last_name)').order('starts_at')
    if (!data?.length) return <EmptyState title={t('club.bookings.noWaitlist')} hint={t('club.bookings.waitlistHint')} />
    return (
      <DataTable label={t('club.bookings.tabs.waitlist')}>
        <thead><tr><th className={th}>{t('club.bookings.when')}</th><th className={th}>{t('club.bookings.resource')}</th><th className={th}>{t('club.bookings.person')}</th><th className={th}>{t('club.bookings.notified')}</th><th /></tr></thead>
        <tbody>{data.map((w) => { const p = w.people as unknown as { id: string; first_name: string; last_name: string } | null; return (
          <tr key={w.id} className={trow}><td className={`${td} tnum`}>{fmtDateTime(w.starts_at, locale)}</td><td className={td}>{(w.resources as unknown as { name: string })?.name}</td><td className={td}>{p ? `${p.first_name} ${p.last_name}` : ''}</td><td className={td}>{w.notified_at ? fmtDateTime(w.notified_at, locale) : '—'}</td>
            <td className={`${td} text-right`}>{writable && <ActionButton action={removeWaiting} args={[w.id]} label={t('club.common.delete')} />}</td></tr>) })}</tbody>
      </DataTable>
    )
  }

  async function Tariffs() {
    const [{ data: rules }, { data: res }] = await Promise.all([
      supabase.from('pricing_rules').select('*').order('resource_kind').order('audience').order('hour_from'),
      supabase.from('resources').select('id, name, kind, slot_min, open_time, close_time, durations, max_advance_days, cancel_hours, max_active_per_person').order('code'),
    ])
    const days = (t.raw('club.access.rules.d') as string[])
    return (
      <div className="space-y-5">
        <Section title={t('club.bookings.tariffs')}>
          <DataTable label={t('club.bookings.tariffs')}>
            <thead><tr><th className={th}>{t('club.bookings.res.label')}</th><th className={th}>{t('club.access.rules.audience')}</th><th className={th}>{t('club.access.rules.days')}</th><th className={th}>{t('club.access.rules.hours')}</th><th className={`${th} text-right`}>€/h</th></tr></thead>
            <tbody>{(rules ?? []).map((r) => (
              <tr key={r.id} className={trow}>
                <td className={td}>{t(`club.bookings.res.${r.resource_kind}`)}</td><td className={td}>{r.audience === 'member' ? t('club.bookings.member') : t('club.bookings.nonMember')}</td>
                <td className={`${td} tnum`}>{r.weekdays.length === 7 ? '—' : r.weekdays.map((d: number) => days[d]).join(' ')}</td><td className={`${td} tnum`}>{r.hour_from}–{r.hour_to} h</td>
                <td className={`${td} text-right`}>{profile.role === 'admin' ? (
                  <Modal label={<span className="tnum font-semibold">{eur(r.price_cents_hour, locale)}</span>} title={t('club.bookings.editPrice')} className="btn btn-ghost !min-h-9 text-sm">
                    <ActionForm action={updatePricePerHour.bind(null, r.id)} submit={t('club.common.save')}><Field label="€/h"><input name="price" defaultValue={(r.price_cents_hour / 100).toFixed(2)} className="input tnum" inputMode="decimal" /></Field></ActionForm>
                  </Modal>) : <span className="tnum font-semibold">{eur(r.price_cents_hour, locale)}</span>}</td>
              </tr>))}</tbody>
          </DataTable>
        </Section>
        <Section title={t('club.bookings.resourceRules')}>
          <DataTable label={t('club.bookings.resourceRules')}>
            <thead><tr><th className={th}>{t('club.bookings.resource')}</th><th className={th}>{t('club.access.rules.hours')}</th><th className={th}>{t('club.bookings.durations')}</th><th className={th}>{t('club.bookings.advance')}</th><th className={th}>{t('club.bookings.cancelHours')}</th><th className={th}>{t('club.bookings.maxActive')}</th></tr></thead>
            <tbody>{(res ?? []).map((r) => <tr key={r.id} className={trow}><td className={`${td} font-semibold`}>{r.name}</td><td className={`${td} tnum`}>{r.open_time.slice(0, 5)}–{r.close_time.slice(0, 5)}</td><td className={`${td} tnum`}>{r.durations.join(' / ')} min</td><td className={`${td} tnum`}>{r.max_advance_days} d</td><td className={`${td} tnum`}>{r.cancel_hours} h</td><td className={`${td} tnum`}>{r.max_active_per_person}</td></tr>)}</tbody>
          </DataTable>
        </Section>
        <p className="text-xs text-muted">{t('club.bookings.tariffNote')}</p>
      </div>
    )
  }
}
