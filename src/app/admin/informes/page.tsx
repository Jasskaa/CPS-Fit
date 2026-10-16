import { Download, FileText } from 'lucide-react'
import { pageCtx, pick, str } from '@/lib/ctx'
import { clubParts, eur, fmtDate } from '@/lib/format'
import { DataTable, PageHeader, Section, td, th, trow } from '@/components/club-ui'
import { Stat } from '@/components/ui'
import { MembersLine, RevenueStack } from './charts'

export const metadata = { title: 'Informes' }
const KINDS = ['fee', 'booking', 'pass', 'other']
const monthLabel = (d: string, locale: string) => fmtDate(`${d}T12:00:00Z`, locale, { month: 'short', year: '2-digit' })

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const { t, locale, supabase } = await pageCtx('reports')
  const today = clubParts(new Date()).date
  const months = Math.min(24, Math.max(3, Number(str(sp.months)) || 12))
  const start = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
  start.setUTCMonth(start.getUTCMonth() - (months - 1))
  const from = start.toISOString().slice(0, 10)

  const [rev, mem, occ, debtors, byType, pend] = await Promise.all([
    supabase.rpc('report_revenue', { p_from: from, p_to: today }),
    supabase.rpc('report_members', { p_from: from }),
    supabase.rpc('report_occupancy', { p_from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), p_to: today }),
    supabase.rpc('report_debtors', { p_limit: 8 }),
    supabase.rpc('report_by_type'),
    supabase.from('invoices').select('total_cents, status').in('status', ['pending', 'overdue']),
  ])
  const revRows = (rev.data ?? []) as { month: string; kind: string; method: string; cents: number; n: number }[]
  const byMonth = new Map<string, Record<string, number | string>>()
  for (const r of revRows) {
    const row = byMonth.get(r.month) ?? { month: monthLabel(r.month, locale), fee: 0, booking: 0, pass: 0, other: 0 }
    row[r.kind] = Number(row[r.kind] ?? 0) + Number(r.cents) / 100
    byMonth.set(r.month, row)
  }
  const revChart = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  const total = revRows.reduce((a, r) => a + Number(r.cents), 0)
  const byKind = KINDS.map((k) => ({ k, cents: revRows.filter((r) => r.kind === k).reduce((a, r) => a + Number(r.cents), 0) }))
  const byMethod = ['cash', 'card', 'sepa', 'transfer', 'simulated'].map((m) => ({ m, cents: revRows.filter((r) => r.method === m).reduce((a, r) => a + Number(r.cents), 0) })).filter((x) => x.cents)
  const memRows = (mem.data ?? []) as { month: string; joined: number; ended: number; active_end: number }[]
  const memChart = memRows.map((r) => ({ month: monthLabel(r.month, locale), active: Number(r.active_end), joined: Number(r.joined), ended: Number(r.ended) }))
  const occRows = (occ.data ?? []) as { resource: string; kind: string; dow: number; hour: number; bookings: number }[]
  const heat = new Map<string, number>()
  occRows.filter((r) => r.kind === 'padel').forEach((r) => heat.set(`${r.dow}-${r.hour}`, (heat.get(`${r.dow}-${r.hour}`) ?? 0) + Number(r.bookings)))
  const heatMax = Math.max(1, ...heat.values())
  const hours = Array.from({ length: 15 }, (_, i) => 8 + i)
  const days = t.raw('club.access.rules.d') as string[]
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]
  const overdueCents = (pend.data ?? []).filter((i) => i.status === 'overdue').reduce((a, i) => a + i.total_cents, 0)
  const pendingCents = (pend.data ?? []).filter((i) => i.status === 'pending').reduce((a, i) => a + i.total_cents, 0)
  const activeNow = memRows.at(-1)?.active_end ?? 0
  const types = (byType.data ?? []) as { code: string; name_ca: string; name_es: string; members: number; fee_cents: number }[]
  const feeProjection = types.reduce((a, x) => a + Number(x.members) * x.fee_cents, 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t('club.reports.title')} subtitle={t('club.reports.subtitle')} actions={<>
        <a className="btn btn-primary" href="/admin/informes/junta" target="_blank" rel="noreferrer"><FileText size={16} aria-hidden /> {t('club.reports.boardPdf')}</a>
        <a className="btn btn-ghost" href={`/admin/informes/export?type=revenue&months=${months}`}><Download size={16} aria-hidden /> {t('club.reports.csvRevenue')}</a>
        <a className="btn btn-ghost" href="/admin/informes/export?type=members"><Download size={16} aria-hidden /> {t('club.reports.csvMembers')}</a>
        <a className="btn btn-ghost" href="/admin/informes/export?type=debt"><Download size={16} aria-hidden /> {t('club.reports.csvDebt')}</a>
      </>} />
      <form className="flex items-center gap-2 text-sm"><label className="flex items-center gap-2">{t('club.reports.period')}<select name="months" defaultValue={months} className="input !w-auto">{[3, 6, 12, 24].map((m) => <option key={m} value={m}>{t('club.reports.lastMonths', { n: m })}</option>)}</select></label><button className="btn btn-ghost !min-h-10">OK</button></form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('club.dash.summary')}>
        <Stat label={t('club.reports.collected')} value={eur(total, locale)} hint={t('club.reports.lastMonths', { n: months })} />
        <Stat label={t('club.reports.activeMembers')} value={activeNow} hint={t('club.reports.feeProjection', { v: eur(feeProjection, locale) })} />
        <Stat label={t('club.reports.pending')} value={eur(pendingCents, locale)} />
        <Stat label={t('club.reports.overdue')} value={eur(overdueCents, locale)} tone={overdueCents ? 'warn' : undefined} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t('club.reports.revenueByMonth')}><div className="h-72"><RevenueStack data={revChart as Record<string, number | string>[]} keys={KINDS} labels={Object.fromEntries(KINDS.map((k) => [k, t(`club.billing.kinds.${k}`)]))} /></div></Section>
        <Section title={t('club.reports.membersEvolution')}><div className="h-72"><MembersLine data={memChart} labels={{ active: t('club.reports.active'), joined: t('club.reports.joined'), ended: t('club.reports.ended') }} /></div></Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t('club.reports.byConcept')}><ul className="space-y-2 text-sm">{byKind.map((x) => <li key={x.k} className="flex items-center justify-between"><span>{t(`club.billing.kinds.${x.k}`)}</span><span className="tnum font-semibold">{eur(x.cents, locale)}</span></li>)}
          <li className="mt-2 border-t border-border pt-2 text-xs font-semibold uppercase text-muted">{t('club.reports.byMethod')}</li>{byMethod.map((x) => <li key={x.m} className="flex items-center justify-between text-sm"><span>{t(`club.billing.methods.${x.m}`)}</span><span className="tnum">{eur(x.cents, locale)}</span></li>)}</ul></Section>
        <Section title={t('club.reports.byType')}>
          <DataTable label={t('club.reports.byType')}><thead><tr><th className={th}>{t('club.people.cols.type')}</th><th className={`${th} text-right`}>{t('club.reports.members')}</th><th className={`${th} text-right`}>€/{t('club.reports.year')}</th></tr></thead>
            <tbody>{types.map((x) => <tr key={x.code} className={trow}><td className={td}>{pick(x, 'name', locale)}</td><td className={`${td} text-right tnum`}>{x.members}</td><td className={`${td} text-right tnum`}>{eur(x.fee_cents, locale)}</td></tr>)}</tbody></DataTable>
        </Section>
        <Section title={t('club.reports.debtors')}>
          {(debtors.data?.length ?? 0) === 0 ? <p className="py-4 text-center text-sm text-muted">{t('club.reports.noDebt')}</p> : (
            <ul className="divide-y divide-border text-sm">{(debtors.data as { person_id: string; name: string; invoices: number; cents: number }[]).map((d) => <li key={d.person_id} className="flex items-center justify-between gap-2 py-2"><a className="font-semibold hover:text-primary-text" href={`/admin/persones/${d.person_id}`}>{d.name}</a><span className="chip chip-danger tnum">{eur(d.cents, locale)} · {d.invoices}</span></li>)}</ul>
          )}
        </Section>
      </div>

      <Section title={t('club.reports.padelHeat')}>
        <div className="overflow-x-auto"><table className="w-full min-w-[34rem] border-separate border-spacing-1 text-center text-[0.7rem]" aria-label={t('club.reports.padelHeat')}>
          <thead><tr><th />{hours.map((h) => <th key={h} className="font-normal text-muted tnum">{h}</th>)}</tr></thead>
          <tbody>{dayOrder.map((d) => <tr key={d}><th className="pr-2 text-left font-semibold">{days[d]}</th>{hours.map((h) => { const n = heat.get(`${d}-${h}`) ?? 0; return <td key={h} title={`${n}`} className="h-8 rounded-md tnum" style={{ background: n ? `color-mix(in srgb, var(--primary) ${Math.round(12 + (n / heatMax) * 88)}%, transparent)` : 'var(--surface-2)', color: n / heatMax > 0.55 ? 'var(--primary-fg)' : 'var(--muted)' }}>{n || ''}</td> })}</tr>)}</tbody></table></div>
        <p className="mt-2 text-xs text-muted">{t('club.reports.heatHint')}</p>
      </Section>
    </div>
  )
}
