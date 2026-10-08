import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { AlertTriangle, CalendarClock, CalendarDays, Dumbbell, MessageSquare, Users } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Stat, EmptyState } from '@/components/ui'
import { dayKey, startOfWeek } from '@/lib/training'
import { SessionsChart } from './sessions-chart'

export const metadata = { title: 'Tauler' }
const INACTIVE_DAYS = 7

export default async function AdminDashboard() {
  const { profile } = await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const [membersRes, sessionsRes, assignRes, commentsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, status').eq('role', 'member'),
    supabase.from('workout_sessions').select('member_id, started_at').gte('started_at', since.toISOString()),
    supabase.from('routine_assignments').select('id, member_id, end_date, routine_id, routines(name)').eq('status', 'active').not('end_date', 'is', null).order('end_date').limit(60),
    supabase.from('comments').select('id, member_id, author_id, body, created_at, resolved').eq('resolved', false).order('created_at', { ascending: false }).limit(80),
  ])
  const members = membersRes.data ?? []
  const active = members.filter((m) => m.status === 'active')
  const nameOf = new Map(members.map((m) => [m.id, m.full_name]))
  const sessions = sessionsRes.data ?? []

  const todayKey = dayKey(new Date())
  const weekStart = startOfWeek(new Date())
  const today = sessions.filter((s) => dayKey(s.started_at) === todayKey).length
  const week = sessions.filter((s) => new Date(s.started_at) >= weekStart).length

  const lastBy = new Map<string, number>()
  sessions.forEach((s) => lastBy.set(s.member_id, Math.max(lastBy.get(s.member_id) ?? 0, new Date(s.started_at).getTime())))
  const now = Date.now()
  const inactive = active
    .map((m) => ({ ...m, days: lastBy.has(m.id) ? Math.floor((now - lastBy.get(m.id)!) / 86400000) : 99 }))
    .filter((m) => m.days >= INACTIVE_DAYS)
    .sort((a, b) => b.days - a.days)

  const expiring = ((assignRes.data ?? []) as unknown as { id: string; member_id: string; end_date: string; routines: { name: string } | null }[])
    .map((a) => ({ ...a, left: Math.ceil((new Date(a.end_date).getTime() - now) / 86400000) }))
    .filter((a) => a.left <= 14 && nameOf.has(a.member_id))
    .sort((a, b) => a.left - b.left)

  // Último mensaje de cada socio: si lo escribió el socio, está sin responder.
  const latest = new Map<string, { id: string; author_id: string; body: string; created_at: string }>()
  for (const c of commentsRes.data ?? []) if (!latest.has(c.member_id)) latest.set(c.member_id, c)
  const unanswered = [...latest.entries()].filter(([member, c]) => c.author_id === member)

  const chart = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return { day: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }), n: sessions.filter((s) => dayKey(s.started_at) === dayKey(d)).length }
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('admin.dashboard.title')}</h1>
        <p className="mt-1 text-muted">{t('admin.dashboard.hello', { name: profile.full_name.split(' ')[0] })}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('admin.dashboard.summary')}>
        <Stat icon={<Users size={16} />} label={t('admin.dashboard.activeMembers')} value={active.length} hint={t('admin.dashboard.ofTotal', { n: members.length })} />
        <Stat icon={<Dumbbell size={16} />} label={t('admin.dashboard.today')} value={today} hint={t('admin.dashboard.workouts')} />
        <Stat icon={<CalendarDays size={16} />} label={t('admin.dashboard.thisWeek')} value={week} hint={t('admin.dashboard.workouts')} />
        <Stat icon={<AlertTriangle size={16} />} label={t('admin.dashboard.inactive', { n: INACTIVE_DAYS })} value={inactive.length} tone={inactive.length ? 'warn' : undefined} hint={t('admin.dashboard.members')} />
      </section>

      <section className="card p-4" aria-labelledby="chart">
        <h2 id="chart" className="font-display text-2xl font-bold">{t('admin.dashboard.last14')}</h2>
        <div className="mt-2 h-52"><SessionsChart data={chart} label={t('admin.dashboard.workouts')} /></div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card p-4" aria-labelledby="inactive">
          <h2 id="inactive" className="flex items-center gap-2 font-display text-2xl font-bold"><AlertTriangle size={20} className="text-danger" aria-hidden /> {t('admin.dashboard.noShow')}</h2>
          {inactive.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t('admin.dashboard.noneInactive')}</p> : (
            <ul className="mt-2 divide-y divide-border">
              {inactive.slice(0, 8).map((m) => (
                <li key={m.id}><Link href={`/admin/socis/${m.id}`} className="flex min-h-12 items-center justify-between gap-2 text-sm hover:text-primary-text">
                  <span className="font-semibold">{m.full_name}</span><span className="chip chip-danger tnum">{m.days >= 99 ? t('admin.dashboard.never') : t('admin.dashboard.daysAgo', { n: m.days })}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4" aria-labelledby="expiring">
          <h2 id="expiring" className="flex items-center gap-2 font-display text-2xl font-bold"><CalendarClock size={20} className="text-primary-text" aria-hidden /> {t('admin.dashboard.expiring')}</h2>
          {expiring.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t('admin.dashboard.noneExpiring')}</p> : (
            <ul className="mt-2 divide-y divide-border">
              {expiring.slice(0, 8).map((a) => (
                <li key={a.id}><Link href={`/admin/socis/${a.member_id}`} className="flex min-h-12 items-center justify-between gap-2 text-sm hover:text-primary-text">
                  <span><span className="block font-semibold">{nameOf.get(a.member_id)}</span><span className="text-xs text-muted">{a.routines?.name}</span></span>
                  <span className={`chip tnum ${a.left < 0 ? 'chip-danger' : 'chip-warn'}`}>{a.left < 0 ? t('admin.dashboard.expired') : t('admin.dashboard.inDays', { n: a.left })}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4" aria-labelledby="unanswered">
          <h2 id="unanswered" className="flex items-center gap-2 font-display text-2xl font-bold"><MessageSquare size={20} className="text-primary-text" aria-hidden /> {t('admin.dashboard.unanswered')}</h2>
          {unanswered.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t('admin.dashboard.noneUnanswered')}</p> : (
            <ul className="mt-2 divide-y divide-border">
              {unanswered.slice(0, 6).map(([member, c]) => (
                <li key={c.id}><Link href={`/admin/socis/${member}#comentaris`} className="block py-2.5 text-sm hover:text-primary-text">
                  <span className="font-semibold">{nameOf.get(member)}</span><span className="block truncate text-muted">{c.body}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {members.length === 0 && <EmptyState title={t('admin.members.empty')} hint={t('admin.members.emptyHint')} />}
    </div>
  )
}
