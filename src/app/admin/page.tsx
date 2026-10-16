import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, CalendarClock, Euro, Inbox, Users, Wrench } from 'lucide-react'
import { pageCtx, pick } from '@/lib/ctx'
import { clubParts, eur, fmtDate, fmtTime } from '@/lib/format'
import { Section } from '@/components/club-ui'
import { Stat } from '@/components/ui'
import { LiveOccupancy } from '@/components/live-occupancy'
import { MoneyChart } from './money-chart'
import GymDashboard from './gym-dashboard'

export const metadata = { title: 'Tauler' }

export default async function AdminHome() {
  const { profile } = await pageCtx('dashboard')
  if (profile.role === 'trainer') return <GymDashboard />
  return <ClubDashboard />
}

async function ClubDashboard() {
  const { t, locale, supabase, profile } = await pageCtx('dashboard')
  if (profile.role === 'coordinator' || profile.role === 'coach') redirect('/admin/seccions')
  const now = new Date()
  const today = clubParts(now).date
  const since = new Date(now.getTime() - 30 * 86400000).toISOString()
  const dayStart = new Date(`${today}T00:00:00`).toISOString()
  const monthStart = `${today.slice(0, 8)}01`

  const [members, people, presence, zones, bookingsToday, nextBookings, pays, due, overdue, tasks, msgs, reqs] = await Promise.all([
    supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('people').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('zone_presence').select('zone_id, present'),
    supabase.from('zones').select('id, name_ca, name_es, capacity, color').eq('active', true).order('sort'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('starts_at', dayStart).lt('starts_at', new Date(new Date(dayStart).getTime() + 86400000).toISOString()),
    supabase.from('bookings').select('id, starts_at, ends_at, price_cents, people(first_name, last_name), resources(name)').eq('status', 'confirmed').gte('ends_at', now.toISOString()).order('starts_at').limit(7),
    supabase.from('payments').select('amount_cents, paid_at').eq('status', 'succeeded').gte('paid_at', since),
    supabase.from('invoices').select('total_cents').eq('status', 'pending'),
    supabase.from('invoices').select('total_cents').eq('status', 'overdue'),
    supabase.from('facility_tasks').select('id, title, priority, kind, status').neq('status', 'resolved').order('created_at', { ascending: false }).limit(5),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('membership_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const presentBy = new Map((presence.data ?? []).map((p) => [p.zone_id, p.present]))
  const occ = (zones.data ?? []).map((z) => ({ id: z.id, name: pick(z, 'name', locale), capacity: z.capacity, color: z.color, present: presentBy.get(z.id) ?? 0 }))
  const totalIn = occ.reduce((a, z) => a + z.present, 0)

  const payRows = pays.data ?? []
  const sum = (rows: { amount_cents: number; paid_at: string | null }[], from: string) => rows.filter((r) => r.paid_at && clubParts(r.paid_at).date >= from).reduce((a, r) => a + r.amount_cents, 0)
  const revToday = sum(payRows, today), revMonth = sum(payRows, monthStart)
  const chart = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 86400000)
    const key = clubParts(d).date
    return { day: fmtDate(d, locale, { day: 'numeric', month: 'short' }), eur: payRows.filter((r) => r.paid_at && clubParts(r.paid_at).date === key).reduce((a, r) => a + r.amount_cents, 0) / 100 }
  })
  const pendingCents = (due.data ?? []).reduce((a, i) => a + i.total_cents, 0)
  const overdueCents = (overdue.data ?? []).reduce((a, i) => a + i.total_cents, 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('club.dash.title')}</h1>
        <p className="mt-1 text-muted">{t('club.dash.hello', { name: profile.full_name.split(' ')[0] })}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('club.dash.summary')}>
        <Stat icon={<Users size={16} />} label={t('club.dash.members')} value={members.count ?? 0} hint={t('club.dash.people', { n: people.count ?? 0 })} />
        <Stat icon={<Users size={16} />} label={t('club.dash.inside')} value={totalIn} hint={t('club.dash.insideHint')} />
        <Stat icon={<Euro size={16} />} label={t('club.dash.revToday')} value={eur(revToday, locale)} hint={t('club.dash.revMonth', { v: eur(revMonth, locale) })} />
        <Stat icon={<AlertTriangle size={16} />} label={t('club.dash.overdue')} value={eur(overdueCents, locale)} tone={overdueCents ? 'warn' : undefined} hint={t('club.dash.pending', { v: eur(pendingCents, locale) })} />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2"><Section title={t('club.dash.occupancy')}><LiveOccupancy initial={occ} label={t('club.dash.occupancy')} /></Section></div>
        <Section title={t('club.dash.revenue30')}><div className="h-56"><MoneyChart data={chart} label={t('club.dash.revenue30')} /></div></Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={`${t('club.dash.nextBookings')} · ${bookingsToday.count ?? 0} ${t('club.dash.today')}`} icon={<CalendarClock size={20} className="text-primary-text" aria-hidden />} action={<Link href="/admin/reserves" className="text-sm font-semibold text-primary-text">{t('club.dash.seeAll')}</Link>}>
          <ul className="divide-y divide-border text-sm">
            {(nextBookings.data ?? []).map((b) => {
              const who = b.people as unknown as { first_name: string; last_name: string } | null
              return (
                <li key={b.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span><span className="block font-semibold">{(b.resources as unknown as { name: string } | null)?.name}</span><span className="text-xs text-muted">{who ? `${who.first_name} ${who.last_name}` : ''}</span></span>
                  <span className="text-right text-xs"><span className="block tnum font-semibold">{fmtDate(b.starts_at, locale, { day: 'numeric', month: 'short' })} {fmtTime(b.starts_at, locale)}</span><span className="tnum text-muted">{eur(b.price_cents, locale)}</span></span>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section title={t('club.dash.attention')} icon={<Inbox size={20} className="text-primary-text" aria-hidden />}>
          <ul className="space-y-2 text-sm">
            <li><Link className="flex min-h-11 items-center justify-between rounded-lg bg-surface-2 px-3 hover:text-primary-text" href="/admin/persones">{t('club.dash.requests')} <span className="chip chip-primary tnum">{reqs.count ?? 0}</span></Link></li>
            <li><Link className="flex min-h-11 items-center justify-between rounded-lg bg-surface-2 px-3 hover:text-primary-text" href="/admin/comunicacio">{t('club.dash.messages')} <span className="chip chip-primary tnum">{msgs.count ?? 0}</span></Link></li>
            <li><Link className="flex min-h-11 items-center justify-between rounded-lg bg-surface-2 px-3 hover:text-primary-text" href="/admin/facturacio?status=overdue">{t('club.dash.overdueInvoices')} <span className="chip chip-danger tnum">{overdue.data?.length ?? 0}</span></Link></li>
          </ul>
        </Section>

        <Section title={t('club.dash.incidents')} icon={<Wrench size={20} className="text-primary-text" aria-hidden />} action={<Link href="/admin/comunicacio#incidencies" className="text-sm font-semibold text-primary-text">{t('club.dash.seeAll')}</Link>}>
          {(tasks.data?.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-muted">{t('club.dash.noIncidents')}</p> : (
            <ul className="divide-y divide-border text-sm">
              {tasks.data!.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 py-2.5"><span className="font-semibold">{k.title}</span><span className={`chip ${k.priority === 'high' ? 'chip-danger' : ''}`}>{k.kind}</span></li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
