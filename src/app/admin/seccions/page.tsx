import Link from 'next/link'
import { CalendarDays, Plus, Users } from 'lucide-react'
import { pageCtx, pick, str } from '@/lib/ctx'
import { eur, fmtDate, fmtDateTime } from '@/lib/format'
import { Field, PageHeader, Section } from '@/components/club-ui'
import { ActionForm, Modal } from '@/components/club-client'
import { EmptyState } from '@/components/ui'
import { createClubEvent } from './actions'

export const metadata = { title: 'Seccions i equips' }
const TABS = ['sections', 'events', 'calendar'] as const

export default async function SectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const { t, locale, supabase, profile } = await pageCtx('sections')
  const tab = (TABS as readonly string[]).includes(str(sp.tab)) ? str(sp.tab) : 'sections'
  const canEdit = profile.role === 'admin' || profile.role === 'coordinator'

  return (
    <div className="space-y-5">
      <PageHeader title={t('club.sections.title')} subtitle={t('club.sections.subtitle')} />
      <nav className="flex gap-1 rounded-xl bg-surface-2 p-1" aria-label={t('club.sections.title')}>
        {TABS.map((x) => <Link key={x} href={`/admin/seccions?tab=${x}`} aria-current={tab === x ? 'page' : undefined} className={`flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold ${tab === x ? 'bg-surface text-primary-text shadow-sm' : 'text-muted hover:text-text'}`}>{t(`club.sections.tabs.${x}`)}</Link>)}
      </nav>
      {tab === 'sections' && <Sections />}
      {tab === 'events' && <Events />}
      {tab === 'calendar' && <Calendar />}
    </div>
  )

  async function Sections() {
    const [{ data: secs }, { data: teams }] = await Promise.all([
      supabase.from('sections').select('id, code, name_ca, name_es, description_ca, color, discount_pct, founded_year').eq('active', true).order('sort'),
      supabase.from('teams').select('id, section_id, team_members(count)'),
    ])
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(secs ?? []).map((s) => {
          const ts = (teams ?? []).filter((x) => x.section_id === s.id)
          const players = ts.reduce((a, x) => a + ((x.team_members as unknown as { count: number }[])[0]?.count ?? 0), 0)
          return (
            <li key={s.id}><Link href={`/admin/seccions/${s.id}`} className="card block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="h-2" style={{ background: s.color ?? 'var(--primary)' }} />
              <div className="space-y-2 p-4">
                <h2 className="font-display text-2xl font-bold">{pick(s, 'name', locale)}</h2>
                <p className="line-clamp-2 min-h-10 text-sm text-muted">{s.description_ca}</p>
                <p className="flex items-center gap-3 text-sm"><span className="chip chip-primary">{t('club.sections.nTeams', { n: ts.length })}</span><span className="chip"><Users size={12} aria-hidden /> {players}</span>{s.discount_pct > 0 && <span className="chip chip-success">−{s.discount_pct}%</span>}</p>
              </div>
            </Link></li>
          )
        })}
      </ul>
    )
  }

  async function Events() {
    const [{ data: evs }, { data: secs }, { data: regs }] = await Promise.all([
      supabase.from('club_events').select('id, kind, title_ca, title_es, starts_on, location, capacity, price_member_cents, price_non_member_cents, registration_open, published').order('starts_on'),
      supabase.from('sections').select('id, name_ca, name_es').order('sort'),
      supabase.from('event_registrations').select('event_id').eq('status', 'registered'),
    ])
    const count = new Map<string, number>()
    regs?.forEach((r) => count.set(r.event_id, (count.get(r.event_id) ?? 0) + 1))
    return (
      <div className="space-y-4">
        {canEdit && (
          <div className="flex justify-end">
            <Modal label={<><Plus size={16} aria-hidden /> {t('club.sections.newEvent')}</>} title={t('club.sections.newEvent')}>
              <ActionForm action={createClubEvent} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label={t('club.sections.eventTitle')}><input name="title_ca" required className="input" /></Field></div>
                <Field label={t('club.sections.eventKind')}><select name="kind" className="input">{['event', 'campus', 'course', 'race', 'casal'].map((k) => <option key={k} value={k}>{t(`club.sections.kinds.${k}`)}</option>)}</select></Field>
                <Field label={t('club.sections.section')}><select name="section_id" className="input"><option value="">—</option>{secs?.map((s) => <option key={s.id} value={s.id}>{pick(s, 'name', locale)}</option>)}</select></Field>
                <Field label={t('club.common.from')}><input name="starts_on" type="date" required className="input" /></Field>
                <Field label={t('club.common.to')}><input name="ends_on" type="date" className="input" /></Field>
                <Field label={t('club.sections.location')}><input name="location" className="input" /></Field>
                <Field label={t('club.sections.capacity')}><input name="capacity" type="number" min={1} className="input" /></Field>
                <Field label={t('club.sections.priceMember')}><input name="price_member" inputMode="decimal" defaultValue="0" className="input tnum" /></Field>
                <Field label={t('club.sections.priceNon')}><input name="price_non_member" inputMode="decimal" defaultValue="0" className="input tnum" /></Field>
              </ActionForm>
            </Modal>
          </div>
        )}
        {(evs?.length ?? 0) === 0 ? <EmptyState title={t('club.sections.noEvents')} /> : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{evs!.map((e) => (
            <li key={e.id}><Link href={`/admin/seccions/esdeveniment/${e.id}`} className="card block space-y-2 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p className="flex items-center justify-between"><span className="chip chip-primary">{t(`club.sections.kinds.${e.kind}`)}</span>{!e.published && <span className="chip">{t('club.sections.draft')}</span>}</p>
              <h2 className="font-display text-xl font-bold leading-tight">{pick(e, 'title', locale)}</h2>
              <p className="flex items-center gap-1 text-sm text-muted"><CalendarDays size={14} aria-hidden /> {fmtDate(e.starts_on, locale)} · {e.location}</p>
              <p className="flex items-center justify-between text-sm"><span className="tnum">{eur(e.price_member_cents, locale)} / {eur(e.price_non_member_cents, locale)}</span><span className={`chip ${e.registration_open ? 'chip-success' : ''}`}>{count.get(e.id) ?? 0}{e.capacity ? ` / ${e.capacity}` : ''}</span></p>
            </Link></li>
          ))}</ul>
        )}
      </div>
    )
  }

  async function Calendar() {
    const { data } = await supabase.from('team_events').select('id, team_id, kind, title, starts_at, location, opponent, score_for, score_against, teams(name, sections(name_ca, name_es, color))').gte('starts_at', new Date(Date.now() - 2 * 86400000).toISOString()).order('starts_at').limit(60)
    if (!data?.length) return <EmptyState title={t('club.sections.noCalendar')} />
    return (
      <Section title={t('club.sections.upcoming')} icon={<CalendarDays size={20} className="text-primary-text" aria-hidden />}>
        <ul className="divide-y divide-border text-sm">{data.map((e) => {
          const tm = e.teams as unknown as { name: string; sections: { name_ca: string; name_es: string; color: string | null } }
          return <li key={e.id}><Link href={`/admin/seccions/equip/${e.team_id}`} className="flex min-h-14 items-center gap-3 py-2 hover:text-primary-text">
            <span aria-hidden className="h-10 w-1.5 rounded-full" style={{ background: tm.sections.color ?? 'var(--primary)' }} />
            <span className="w-32 shrink-0 text-muted tnum">{fmtDateTime(e.starts_at, locale)}</span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">{tm.name} · {pick(tm.sections, 'name', locale)}</span><span className="block truncate text-xs text-muted">{t(`club.sections.teamKinds.${e.kind}`)}{e.opponent ? ` vs ${e.opponent}` : ''}{e.location ? ` · ${e.location}` : ''}</span></span>
            {e.score_for != null && <span className="chip chip-primary tnum">{e.score_for}–{e.score_against}</span>}
          </Link></li>
        })}</ul>
      </Section>
    )
  }
}
