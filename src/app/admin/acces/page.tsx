import Link from 'next/link'
import { Download } from 'lucide-react'
import { pageCtx, pick, num, str } from '@/lib/ctx'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { DataTable, PageHeader, Pager, Section, StatusChip, td, th, trow } from '@/components/club-ui'
import { LiveOccupancy } from '@/components/live-occupancy'
import { RefreshOnChange } from '@/components/refresh-on-change'
import { EmptyState } from '@/components/ui'
import { ReceptionTerminal } from './reception-terminal'

export const metadata = { title: 'Accessos' }
const PAGE = 30
const TABS = ['live', 'reception', 'log', 'rules'] as const

export default async function AccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const { t, locale, supabase, writable } = await pageCtx('access')
  const tab = (TABS as readonly string[]).includes(str(sp.tab)) ? str(sp.tab) : 'live'
  const { data: zones } = await supabase.from('zones').select('id, code, name_ca, name_es, capacity, color').eq('active', true).order('sort')
  const zl = zones ?? []

  return (
    <div className="space-y-5">
      <PageHeader title={t('club.access.title')} subtitle={t('club.access.subtitle')} />
      <nav className="flex gap-1 rounded-xl bg-surface-2 p-1" aria-label={t('club.access.title')}>
        {TABS.filter((x) => x !== 'reception' || writable).map((x) => (
          <Link key={x} href={`/admin/acces?tab=${x}`} aria-current={tab === x ? 'page' : undefined} className={`flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold ${tab === x ? 'bg-surface shadow-sm text-primary-text' : 'text-muted hover:text-text'}`}>{t(`club.access.tabs.${x}`)}</Link>
        ))}
      </nav>

      {tab === 'live' && <Live zones={zl} />}
      {tab === 'reception' && writable && <ReceptionTerminal zones={zl.map((z) => ({ id: z.id, code: z.code, name: pick(z, 'name', locale) }))} defaultZone={zl.find((z) => z.code === 'gym')?.id ?? zl[0]?.id ?? ''} />}
      {tab === 'log' && <Log sp={sp} zones={zl} />}
      {tab === 'rules' && <Rules zones={zl} />}
    </div>
  )

  async function Live({ zones }: { zones: typeof zl }) {
    const [{ data: pres }, { data: last }] = await Promise.all([
      supabase.from('zone_presence').select('zone_id, present'),
      supabase.from('access_logs').select('id, at, direction, allowed, reason, people(first_name, last_name), zones(name_ca, name_es)').order('at', { ascending: false }).limit(14),
    ])
    const by = new Map((pres ?? []).map((p) => [p.zone_id, p.present]))
    const occ = zones.map((z) => ({ id: z.id, name: pick(z, 'name', locale), capacity: z.capacity, color: z.color, present: by.get(z.id) ?? 0 }))
    return (
      <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <RefreshOnChange tables={['access_logs']} />
        <Section title={t('club.access.insideNow')}><LiveOccupancy initial={occ} label={t('club.access.insideNow')} /></Section>
        <Section title={t('club.access.lastEntries')}>
          {(last?.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-muted">{t('club.access.noMovements')}</p> : (
            <ul className="divide-y divide-border text-sm">
              {last!.map((l) => {
                const p = l.people as unknown as { first_name: string; last_name: string } | null
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2.5">
                    <span><span className="block font-semibold">{p ? `${p.first_name} ${p.last_name}` : '—'}</span><span className="text-xs text-muted">{pick(l.zones as unknown as object, 'name', locale)} · {l.direction === 'in' ? t('club.access.in') : t('club.access.out')}</span></span>
                    <span className="text-right"><StatusChip value={l.allowed ? 'ok' : 'denied'} label={l.allowed ? t('club.access.log.allowed') : t('club.access.log.denied')} /><span className="block text-xs text-muted tnum">{fmtDateTime(l.at, locale)}</span></span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      </div>
    )
  }

  async function Log({ sp, zones }: { sp: Record<string, string | string[] | undefined>; zones: typeof zl }) {
    const page = num(sp.p), zone = str(sp.zone), denied = str(sp.denied) === '1', from = str(sp.from), to = str(sp.to)
    let q = supabase.from('access_logs').select('id, at, direction, allowed, reason, method, people(id, first_name, last_name), zones(name_ca, name_es)', { count: 'exact' }).order('at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    if (zone) q = q.eq('zone_id', zone)
    if (denied) q = q.eq('allowed', false)
    if (from) q = q.gte('at', from)
    if (to) q = q.lte('at', `${to}T23:59:59`)
    const { data, count } = await q
    const params = new URLSearchParams({ tab: 'log' })
    if (zone) params.set('zone', zone); if (denied) params.set('denied', '1'); if (from) params.set('from', from); if (to) params.set('to', to)
    const exp = new URLSearchParams(params); exp.delete('tab')
    return (
      <div className="space-y-4">
        <form className="card flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="tab" value="log" />
          <select name="zone" defaultValue={zone} className="input !w-auto" aria-label={t('club.access.log.zone')}><option value="">{t('club.access.log.all')}</option>{zones.map((z) => <option key={z.id} value={z.id}>{pick(z, 'name', locale)}</option>)}</select>
          <label className="flex items-center gap-2 text-sm">{t('club.common.from')}<input type="date" name="from" defaultValue={from} className="input !w-auto" /></label>
          <label className="flex items-center gap-2 text-sm">{t('club.common.to')}<input type="date" name="to" defaultValue={to} className="input !w-auto" /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="denied" value="1" defaultChecked={denied} /> {t('club.access.log.onlyDenied')}</label>
          <button className="btn btn-primary">{t('club.people.filter')}</button>
          <a className="btn btn-ghost ml-auto" href={`/admin/acces/export?${exp}`}><Download size={16} aria-hidden /> {t('club.access.log.exportCsv')}</a>
        </form>
        {(data?.length ?? 0) === 0 ? <EmptyState title={t('club.access.log.empty')} /> : (
          <DataTable label={t('club.access.tabs.log')}>
            <thead><tr><th className={th}>{t('club.access.log.when')}</th><th className={th}>{t('club.access.log.person')}</th><th className={th}>{t('club.access.log.zone')}</th><th className={th}>{t('club.access.log.result')}</th><th className={th}>{t('club.access.log.reason')}</th><th className={th}>{t('club.access.log.method')}</th></tr></thead>
            <tbody>{data!.map((l) => {
              const p = l.people as unknown as { id: string; first_name: string; last_name: string } | null
              return (
                <tr key={l.id} className={trow}>
                  <td className={`${td} tnum text-muted`}>{fmtDateTime(l.at, locale)}</td>
                  <td className={td}>{p ? <Link className="font-semibold hover:text-primary-text" href={`/admin/persones/${p.id}`}>{p.first_name} {p.last_name}</Link> : '—'}</td>
                  <td className={td}>{pick(l.zones as unknown as object, 'name', locale)} <span className="text-xs text-muted">· {l.direction === 'in' ? t('club.access.in') : t('club.access.out')}</span></td>
                  <td className={td}><StatusChip value={l.allowed ? 'ok' : 'denied'} label={l.allowed ? t('club.access.log.allowed') : t('club.access.log.denied')} /></td>
                  <td className={`${td} text-muted`}>{l.reason ? (t.has(`club.people.reason.${l.reason}`) ? t(`club.people.reason.${l.reason}`) : l.reason) : ''}</td>
                  <td className={`${td} text-muted`}>{l.method}</td>
                </tr>
              )
            })}</tbody>
          </DataTable>
        )}
        <Pager page={page} pages={Math.max(1, Math.ceil((count ?? 0) / PAGE))} href={(p) => `/admin/acces?${new URLSearchParams({ ...Object.fromEntries(params), ...(p > 1 ? { p: String(p) } : {}) })}`} />
      </div>
    )
  }

  async function Rules({ zones }: { zones: typeof zl }) {
    const { data: rules } = await supabase.from('access_rules').select('*').order('sort')
    const days = t.raw('club.access.rules.d') as string[]
    const fmtDays = (w: number[]) => (w.length === 7 ? '—' : w.map((d) => days[d]).join(' '))
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('club.access.rules.hint')}</p>
        {zones.map((z) => {
          const zr = (rules ?? []).filter((r) => r.zone_id === z.id)
          if (!zr.length) return null
          return (
            <Section key={z.id} title={pick(z, 'name', locale)}>
              <DataTable label={pick(z, 'name', locale)}>
                <thead><tr><th className={th}>{t('club.access.rules.audience')}</th><th className={th}>{t('club.access.rules.days')}</th><th className={th}>{t('club.access.rules.hours')}</th><th className={th}>{t('club.access.rules.season')}</th><th className={th}>{t('club.access.rules.rule')}</th></tr></thead>
                <tbody>{zr.map((r) => (
                  <tr key={r.id} className={trow}>
                    <td className={td}>{t(`club.access.rules.${r.audience}`)}{r.requires_pass_kind ? ` · ${t('club.access.rules.pass')} ${r.requires_pass_kind}` : ''}</td>
                    <td className={`${td} tnum`}>{fmtDays(r.weekdays)}</td>
                    <td className={`${td} tnum`}>{r.time_from ? `${r.time_from.slice(0, 5)}–${r.time_to?.slice(0, 5)}` : t('club.access.rules.allDay')}</td>
                    <td className={`${td} tnum`}>{r.season_from ? `${fmtDate(r.season_from, locale, { day: 'numeric', month: 'short' })} – ${fmtDate(r.season_to, locale, { day: 'numeric', month: 'short' })}` : t('club.access.rules.allSeason')}</td>
                    <td className={td}><span className={`chip ${r.allow ? 'chip-success' : 'chip-danger'}`}>{r.allow ? t('club.access.rules.allow') : t('club.access.rules.deny')}</span>{r.requires_booking ? <span className="chip chip-primary ml-1">{t('club.access.rules.booking')}</span> : null}</td>
                  </tr>
                ))}</tbody>
              </DataTable>
            </Section>
          )
        })}
      </div>
    )
  }
}
