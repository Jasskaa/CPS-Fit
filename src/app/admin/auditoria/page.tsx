import Link from 'next/link'
import { pageCtx, num, str } from '@/lib/ctx'
import { fmtDateTime } from '@/lib/format'
import { DataTable, PageHeader, Pager, td, th, trow } from '@/components/club-ui'
import { EmptyState } from '@/components/ui'

export const metadata = { title: 'Auditoria' }
const PAGE = 40
const ENTITIES = ['people', 'memberships', 'invoices', 'payments', 'bookings', 'access_overrides', 'settings', 'sepa_batches']

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const { t, locale, supabase } = await pageCtx('audit')
  const page = num(sp.p), entity = str(sp.entity), action = str(sp.action), from = str(sp.from)
  let q = supabase.from('audit_log').select('id, actor_id, action, entity, entity_id, at, detail', { count: 'exact' }).order('at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  if (entity) q = q.eq('entity', entity)
  if (action) q = q.eq('action', action)
  if (from) q = q.gte('at', from)
  const { data, count } = await q
  const actors = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[]
  const { data: profs } = actors.length ? await supabase.from('profiles').select('id, full_name, role').in('id', actors) : { data: [] }
  const who = new Map((profs ?? []).map((p) => [p.id, p]))
  const params = new URLSearchParams()
  if (entity) params.set('entity', entity); if (action) params.set('action', action); if (from) params.set('from', from)

  return (
    <div className="space-y-5">
      <PageHeader title={t('club.audit.title')} subtitle={t('club.audit.subtitle')} />
      <form className="card flex flex-wrap items-end gap-3 p-4">
        <select name="entity" defaultValue={entity} className="input !w-auto" aria-label={t('club.audit.entity')}><option value="">{t('club.common.all')}</option>{ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}</select>
        <select name="action" defaultValue={action} className="input !w-auto" aria-label={t('club.audit.action')}><option value="">{t('club.common.all')}</option>{['insert', 'update', 'delete'].map((a) => <option key={a} value={a}>{t(`club.audit.actions.${a}`)}</option>)}</select>
        <label className="flex items-center gap-2 text-sm">{t('club.common.from')}<input type="date" name="from" defaultValue={from} className="input !w-auto" /></label>
        <button className="btn btn-primary">{t('club.people.filter')}</button>
      </form>
      {(data?.length ?? 0) === 0 ? <EmptyState title={t('club.audit.empty')} /> : (
        <DataTable label={t('club.audit.title')}>
          <thead><tr><th className={th}>{t('club.common.date')}</th><th className={th}>{t('club.audit.who')}</th><th className={th}>{t('club.audit.action')}</th><th className={th}>{t('club.audit.entity')}</th><th className={th}>{t('club.audit.fields')}</th></tr></thead>
          <tbody>{data!.map((r) => {
            const a = r.actor_id ? who.get(r.actor_id) : null
            const changed = ((r.detail as { changed?: string[] } | null)?.changed ?? []).filter((c) => c !== 'updated_at')
            return <tr key={r.id} className={trow}>
              <td className={`${td} tnum text-muted`}>{fmtDateTime(r.at, locale)}</td>
              <td className={td}>{a ? <><span className="font-semibold">{a.full_name}</span> <span className="chip">{t(`club.roles.${a.role}`)}</span></> : <span className="text-muted">{t('club.audit.system')}</span>}</td>
              <td className={td}><span className={`chip ${r.action === 'delete' ? 'chip-danger' : r.action === 'insert' ? 'chip-success' : ''}`}>{t(`club.audit.actions.${r.action}`)}</span></td>
              <td className={td}>{r.entity}{r.entity_id && r.entity === 'people' ? <> · <Link className="text-primary-text hover:underline" href={`/admin/persones/${r.entity_id}`}>{r.entity_id.slice(0, 8)}</Link></> : r.entity === 'invoices' && r.entity_id ? <> · <Link className="text-primary-text hover:underline" href={`/admin/facturacio/${r.entity_id}`}>{r.entity_id.slice(0, 8)}</Link></> : null}</td>
              <td className={`${td} text-xs text-muted`}>{changed.join(', ')}</td></tr>
          })}</tbody>
        </DataTable>
      )}
      <Pager page={page} pages={Math.max(1, Math.ceil((count ?? 0) / PAGE))} href={(p) => `/admin/auditoria?${new URLSearchParams({ ...Object.fromEntries(params), ...(p > 1 ? { p: String(p) } : {}) })}`} />
      <p className="text-xs text-muted">{t('club.audit.hint')}</p>
    </div>
  )
}
