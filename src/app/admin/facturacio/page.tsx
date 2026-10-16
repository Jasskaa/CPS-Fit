import Link from 'next/link'
import { Download, FileCode2 } from 'lucide-react'
import { pageCtx, num, str, personSearch, ilikeSafe } from '@/lib/ctx'
import { eur, fmtDate, fmtDateTime } from '@/lib/format'
import { DataTable, Field, PageHeader, Pager, Section, StatusChip, td, th, trow } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal } from '@/components/club-client'
import { Stat, EmptyState } from '@/components/ui'
import { closeCash, createSepaBatch, markOverdue, openCash, previewFeeRun, returnSepaItem, runFeeRun, setBatchStatus } from './actions'
import { Tpv } from './tpv'

export const metadata = { title: 'Facturació' }
const TABS = ['invoices', 'fees', 'sepa', 'tpv', 'cash'] as const
const PAGE = 25
const STATUSES = ['pending', 'overdue', 'paid', 'void', 'refunded', 'draft']

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const { t, locale, supabase, writable, profile } = await pageCtx('billing')
  const tab = (TABS as readonly string[]).includes(str(sp.tab)) ? str(sp.tab) : 'invoices'
  const isAdmin = profile.role === 'admin'
  const visible = TABS.filter((x) => (x === 'sepa' ? isAdmin || profile.role === 'board' : x === 'tpv' || x === 'cash' ? writable : true))

  return (
    <div className="space-y-5">
      <PageHeader title={t('club.billing.title')} subtitle={t('club.billing.subtitle')} />
      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1" aria-label={t('club.billing.title')}>
        {visible.map((x) => <Link key={x} href={`/admin/facturacio?tab=${x}`} aria-current={tab === x ? 'page' : undefined} className={`flex min-h-10 min-w-fit flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold ${tab === x ? 'bg-surface text-primary-text shadow-sm' : 'text-muted hover:text-text'}`}>{t(`club.billing.tabs.${x}`)}</Link>)}
      </nav>
      {tab === 'invoices' && <Invoices />}
      {tab === 'fees' && <Fees />}
      {tab === 'sepa' && visible.includes('sepa') && <Sepa />}
      {tab === 'tpv' && writable && <TpvTab />}
      {tab === 'cash' && writable && <Cash />}
    </div>
  )

  async function Invoices() {
    const page = num(sp.p), status = str(sp.status), kind = str(sp.kind), from = str(sp.from), to = str(sp.to), q = ilikeSafe(str(sp.q))
    const month = new Date(); month.setDate(1)
    const [paidM, pend, over] = await Promise.all([
      supabase.from('invoices').select('total_cents').eq('status', 'paid').gte('paid_at', month.toISOString()),
      supabase.from('invoices').select('total_cents').eq('status', 'pending'),
      supabase.from('invoices').select('total_cents').eq('status', 'overdue'),
    ])
    const sum = (r: { data: { total_cents: number }[] | null }) => (r.data ?? []).reduce((a, x) => a + x.total_cents, 0)
    let ids: string[] | null = null
    if (q) { const { data } = await personSearch(supabase.from('people').select('id'), q).limit(200); ids = (data ?? []).map((p) => p.id) }
    let qy = supabase.from('invoices').select('id, number, issued_on, status, kind, total_cents, people(id, first_name, last_name)', { count: 'exact' }).order('issued_on', { ascending: false }).order('number', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    if (status) qy = qy.eq('status', status)
    if (kind) qy = qy.eq('kind', kind)
    if (from) qy = qy.gte('issued_on', from)
    if (to) qy = qy.lte('issued_on', to)
    if (q) qy = ids?.length ? qy.or(`person_id.in.(${ids.join(',')}),number.ilike.%${q}%`) : qy.ilike('number', `%${q}%`)
    const { data, count } = await qy
    const params: Record<string, string> = { tab: 'invoices' }
    if (status) params.status = status; if (kind) params.kind = kind; if (from) params.from = from; if (to) params.to = to; if (q) params.q = q
    return (
      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label={t('club.billing.summary')}>
          <Stat label={t('club.billing.collectedMonth')} value={eur(sum(paidM), locale)} tone="good" />
          <Stat label={t('club.billing.pendingTotal')} value={eur(sum(pend), locale)} hint={t('club.billing.nInvoices', { n: pend.data?.length ?? 0 })} />
          <Stat label={t('club.billing.overdueTotal')} value={eur(sum(over), locale)} tone={sum(over) ? 'warn' : undefined} hint={t('club.billing.nInvoices', { n: over.data?.length ?? 0 })} />
        </section>
        <form className="card flex flex-wrap items-end gap-3 p-4"><input type="hidden" name="tab" value="invoices" />
          <input name="q" defaultValue={q} placeholder={t('club.billing.searchPh')} aria-label={t('club.common.search')} className="input !w-56" />
          <select name="status" defaultValue={status} className="input !w-auto" aria-label={t('club.common.status')}><option value="">{t('club.common.all')}</option>{STATUSES.map((s) => <option key={s} value={s}>{t(`club.bookings.inv.${s}`)}</option>)}</select>
          <select name="kind" defaultValue={kind} className="input !w-auto" aria-label={t('club.billing.kind')}><option value="">{t('club.common.all')}</option>{['fee', 'booking', 'pass', 'other'].map((k) => <option key={k} value={k}>{t(`club.billing.kinds.${k}`)}</option>)}</select>
          <label className="flex items-center gap-2 text-sm">{t('club.common.from')}<input type="date" name="from" defaultValue={from} className="input !w-auto" /></label>
          <label className="flex items-center gap-2 text-sm">{t('club.common.to')}<input type="date" name="to" defaultValue={to} className="input !w-auto" /></label>
          <button className="btn btn-primary">{t('club.people.filter')}</button>
          <span className="ml-auto flex gap-2">
            {writable && <ActionButton action={markOverdue} label={t('club.billing.markOverdue')} />}
            <a className="btn btn-ghost !min-h-9" href={`/admin/facturacio/export?${new URLSearchParams(params)}`}><Download size={16} aria-hidden /> {t('club.common.export')}</a>
          </span>
        </form>
        {(data?.length ?? 0) === 0 ? <EmptyState title={t('club.billing.empty')} /> : (
          <DataTable label={t('club.billing.tabs.invoices')}>
            <thead><tr><th className={th}>{t('club.billing.number')}</th><th className={th}>{t('club.common.date')}</th><th className={th}>{t('club.billing.client')}</th><th className={th}>{t('club.billing.kind')}</th><th className={`${th} text-right`}>{t('club.common.total')}</th><th className={th}>{t('club.common.status')}</th></tr></thead>
            <tbody>{data!.map((i) => {
              const p = i.people as unknown as { id: string; first_name: string; last_name: string }
              return <tr key={i.id} className={trow}>
                <td className={td}><Link href={`/admin/facturacio/${i.id}`} className="font-semibold text-primary-text hover:underline">{i.number}</Link></td>
                <td className={`${td} tnum text-muted`}>{fmtDate(i.issued_on, locale)}</td>
                <td className={td}><Link href={`/admin/persones/${p.id}`} className="hover:text-primary-text">{p.first_name} {p.last_name}</Link></td>
                <td className={td}>{t(`club.billing.kinds.${i.kind}`)}</td><td className={`${td} text-right tnum`}>{eur(i.total_cents, locale)}</td>
                <td className={td}><StatusChip value={i.status} label={t(`club.bookings.inv.${i.status}`)} /></td>
              </tr>
            })}</tbody>
          </DataTable>
        )}
        <Pager page={page} pages={Math.max(1, Math.ceil((count ?? 0) / PAGE))} href={(p) => `/admin/facturacio?${new URLSearchParams({ ...params, ...(p > 1 ? { p: String(p) } : {}) })}`} />
      </div>
    )
  }

  async function Fees() {
    const year = Number(str(sp.year)) || new Date().getFullYear()
    const [jan, jun] = await Promise.all(writable ? [previewFeeRun('jan', year), previewFeeRun('jun', year)] : [null, null])
    return (
      <div className="space-y-4">
        <form className="flex items-end gap-2"><input type="hidden" name="tab" value="fees" /><Field label={t('club.billing.year')}><input type="number" name="year" defaultValue={year} className="input !w-28" /></Field><button className="btn btn-ghost">OK</button></form>
        <p className="text-sm text-muted">{t('club.billing.feesHint')}</p>
        <div className="grid gap-5 lg:grid-cols-2">
          {([['jan', jan], ['jun', jun]] as const).map(([period, r]) => r && (
            <Section key={period} title={r.label}>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div><dt className="text-[0.65rem] uppercase leading-tight text-muted">{t('club.billing.toInvoice')}</dt><dd className="font-display text-3xl font-extrabold tnum">{r.rows.length}</dd></div>
                <div><dt className="text-[0.65rem] uppercase leading-tight text-muted">{t('club.billing.amount')}</dt><dd className="font-display text-2xl font-extrabold tnum">{eur(r.rows.reduce((a, x) => a + x.fee + x.entry, 0), locale)}</dd></div>
                <div><dt className="text-[0.65rem] uppercase leading-tight text-muted">{t('club.billing.withSepa')}</dt><dd className="font-display text-3xl font-extrabold tnum">{r.rows.filter((x) => x.sepa).length}</dd></div>
              </dl>
              <p className="mt-2 text-center text-xs text-muted">{r.alreadyDone > 0 ? t('club.billing.alreadyDone', { n: r.alreadyDone }) : ''}</p>
              <div className="mt-3"><ActionButton action={runFeeRun} args={[period, year]} label={t('club.billing.generate')} className="btn btn-primary w-full" confirm={t('club.billing.confirmGenerate', { n: r.rows.length })} /></div>
            </Section>
          ))}
        </div>
      </div>
    )
  }

  async function Sepa() {
    const { data: batches } = await supabase.from('sepa_batches').select('id, reference, collection_date, status, total_cents, created_at').order('created_at', { ascending: false })
    const open = str(sp.batch)
    const items = open ? (await supabase.from('sepa_items').select('id, amount_cents, status, iban_last4, mandate_id, return_reason, people(first_name, last_name), invoices(number)').eq('batch_id', open).order('amount_cents', { ascending: false })).data : null
    const batch = batches?.find((b) => b.id === open)
    return (
      <div className="space-y-5">
        {isAdmin && (
          <Section title={t('club.billing.newBatch')}>
            <ActionForm action={createSepaBatch} submit={t('club.billing.createBatch')} className="flex flex-wrap items-end gap-3" variant="btn-primary">
              <Field label={t('club.billing.collectionDate')}><input type="date" name="collection_date" required defaultValue={new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)} className="input !w-auto" /></Field>
              <p className="max-w-md text-xs text-muted">{t('club.billing.batchHint')}</p>
            </ActionForm>
          </Section>
        )}
        {(batches?.length ?? 0) === 0 ? <EmptyState title={t('club.billing.noBatches')} /> : (
          <DataTable label={t('club.billing.tabs.sepa')}>
            <thead><tr><th className={th}>{t('club.billing.reference')}</th><th className={th}>{t('club.billing.collectionDate')}</th><th className={`${th} text-right`}>{t('club.common.total')}</th><th className={th}>{t('club.common.status')}</th><th /></tr></thead>
            <tbody>{batches!.map((b) => <tr key={b.id} className={trow}>
              <td className={`${td} font-semibold`}><Link className="hover:text-primary-text" href={`/admin/facturacio?tab=sepa&batch=${b.id}`}>{b.reference}</Link></td><td className={`${td} tnum`}>{fmtDate(b.collection_date, locale)}</td><td className={`${td} text-right tnum`}>{eur(b.total_cents, locale)}</td>
              <td className={td}><StatusChip value={b.status} label={t(`club.billing.batchStatus.${b.status}`)} /></td>
              <td className={`${td} text-right`}><a className="btn btn-ghost !min-h-9 text-sm" href={`/admin/facturacio/sepa/${b.id}`}><FileCode2 size={15} aria-hidden /> XML</a></td></tr>)}</tbody>
          </DataTable>
        )}
        {batch && items && (
          <Section title={`${batch.reference} · ${items.length} ${t('club.billing.receipts')}`} action={isAdmin && batch.status !== 'closed' && (
            <span className="flex gap-2">{batch.status === 'draft' && <ActionButton action={setBatchStatus} args={[batch.id, 'submitted']} label={t('club.billing.markSubmitted')} className="btn btn-primary !min-h-9 text-sm" />}
              <ActionButton action={setBatchStatus} args={[batch.id, 'closed']} label={t('club.billing.closeBatch')} confirm={t('club.billing.confirmClose')} /></span>)}>
            <DataTable label={batch.reference}>
              <thead><tr><th className={th}>{t('club.billing.client')}</th><th className={th}>{t('club.billing.number')}</th><th className={th}>IBAN</th><th className={`${th} text-right`}>{t('club.common.total')}</th><th className={th}>{t('club.common.status')}</th><th /></tr></thead>
              <tbody>{items.map((it) => { const p = it.people as unknown as { first_name: string; last_name: string }; return (
                <tr key={it.id} className={trow}><td className={td}>{p.first_name} {p.last_name}</td><td className={td}>{(it.invoices as unknown as { number: string })?.number}</td><td className={`${td} tnum text-muted`}>•••• {it.iban_last4}</td><td className={`${td} text-right tnum`}>{eur(it.amount_cents, locale)}</td>
                  <td className={td}><StatusChip value={it.status} label={t(`club.billing.itemStatus.${it.status}`)} />{it.return_reason ? <span className="ml-1 text-xs text-muted">{it.return_reason}</span> : null}</td>
                  <td className={`${td} text-right`}>{isAdmin && it.status !== 'returned' && (
                    <Modal label={t('club.billing.markReturned')} title={t('club.billing.markReturned')} className="btn btn-ghost !min-h-9 text-sm"><ActionForm action={returnSepaItem.bind(null, it.id)} submit={t('club.common.confirm')} variant="btn-danger"><Field label={t('club.billing.returnReason')}><select name="reason" className="input"><option value="MS03">MS03 · {t('club.billing.reasons.MS03')}</option><option value="AC04">AC04 · {t('club.billing.reasons.AC04')}</option><option value="AM04">AM04 · {t('club.billing.reasons.AM04')}</option><option value="MD01">MD01 · {t('club.billing.reasons.MD01')}</option></select></Field></ActionForm></Modal>)}</td></tr>) })}</tbody>
            </DataTable>
          </Section>
        )}
      </div>
    )
  }

  async function TpvTab() {
    const [{ data: prods }, { data: open }] = await Promise.all([
      supabase.from('products').select('id, name_ca, name_es, kind, price_member_cents, price_non_member_cents').eq('active', true).neq('kind', 'fee').order('sort'),
      supabase.from('cash_sessions').select('id').is('closed_at', null).maybeSingle(),
    ])
    return <Tpv cashOpen={Boolean(open)} locale={locale} products={(prods ?? []).map((p) => ({ id: p.id, name: locale === 'es' ? p.name_es ?? p.name_ca : p.name_ca, kind: p.kind, member: p.price_member_cents, non: p.price_non_member_cents }))} />
  }

  async function Cash() {
    const { data: sessions } = await supabase.from('cash_sessions').select('id, opened_at, closed_at, opening_cents, counted_cents, expected_cents, note').order('opened_at', { ascending: false }).limit(15)
    const open = sessions?.find((s) => !s.closed_at)
    let cashIn = 0, cardIn = 0
    if (open) {
      const { data: pays } = await supabase.from('payments').select('method, amount_cents, status').eq('status', 'succeeded').gte('paid_at', open.opened_at)
      cashIn = (pays ?? []).filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount_cents, 0)
      cardIn = (pays ?? []).filter((p) => p.method === 'card').reduce((a, p) => a + p.amount_cents, 0)
    }
    return (
      <div className="space-y-5">
        {open ? (
          <Section title={t('club.billing.cashOpen')} action={<Modal label={t('club.billing.closeCash')} title={t('club.billing.closeCash')} className="btn btn-primary !min-h-9 text-sm"><ActionForm action={closeCash.bind(null, open.id)} submit={t('club.billing.closeCash')}>
            <p className="text-sm text-muted">{t('club.billing.expectedHint', { v: eur(open.opening_cents + cashIn, locale) })}</p>
            <Field label={t('club.billing.counted')}><input name="counted" inputMode="decimal" required className="input tnum" /></Field><Field label={t('club.common.notes')}><input name="note" className="input" /></Field></ActionForm></Modal>}>
            <dl className="grid grid-cols-3 gap-2 text-center"><div><dt className="text-xs uppercase text-muted">{t('club.billing.opening')}</dt><dd className="font-display text-3xl font-extrabold tnum">{eur(open.opening_cents, locale)}</dd></div>
              <div><dt className="text-xs uppercase text-muted">{t('club.billing.cashSales')}</dt><dd className="font-display text-3xl font-extrabold tnum">{eur(cashIn, locale)}</dd></div>
              <div><dt className="text-xs uppercase text-muted">{t('club.billing.cardSales')}</dt><dd className="font-display text-3xl font-extrabold tnum">{eur(cardIn, locale)}</dd></div></dl>
          </Section>
        ) : (
          <Section title={t('club.billing.cashClosed')}><ActionForm action={openCash} submit={t('club.billing.openCash')} className="flex flex-wrap items-end gap-3"><Field label={t('club.billing.opening')}><input name="opening" inputMode="decimal" defaultValue="100,00" className="input !w-36 tnum" /></Field></ActionForm></Section>
        )}
        <DataTable label={t('club.billing.tabs.cash')}>
          <thead><tr><th className={th}>{t('club.billing.openedAt')}</th><th className={th}>{t('club.billing.closedAt')}</th><th className={`${th} text-right`}>{t('club.billing.expected')}</th><th className={`${th} text-right`}>{t('club.billing.counted')}</th><th className={`${th} text-right`}>{t('club.billing.diff')}</th></tr></thead>
          <tbody>{(sessions ?? []).map((s) => { const diff = s.closed_at ? (s.counted_cents ?? 0) - (s.expected_cents ?? 0) : null; return (
            <tr key={s.id} className={trow}><td className={`${td} tnum`}>{fmtDateTime(s.opened_at, locale)}</td><td className={`${td} tnum`}>{s.closed_at ? fmtDateTime(s.closed_at, locale) : <span className="chip chip-success">{t('club.billing.cashOpen')}</span>}</td>
              <td className={`${td} text-right tnum`}>{s.expected_cents != null ? eur(s.expected_cents, locale) : '—'}</td><td className={`${td} text-right tnum`}>{s.counted_cents != null ? eur(s.counted_cents, locale) : '—'}</td>
              <td className={`${td} text-right tnum ${diff ? 'text-danger font-semibold' : ''}`}>{diff != null ? eur(diff, locale) : ''}</td></tr>) })}</tbody>
        </DataTable>
      </div>
    )
  }
}
