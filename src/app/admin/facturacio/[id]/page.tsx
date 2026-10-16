import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileDown } from 'lucide-react'
import { pageCtx } from '@/lib/ctx'
import { eur, fmtDate, fmtDateTime } from '@/lib/format'
import { DataTable, Field, KV, Section, StatusChip, td, th, trow } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal } from '@/components/club-client'
import { payInvoice, rectifyInvoice, sendReminder, voidInvoice } from '../actions'

export const metadata = { title: 'Factura' }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t, locale, supabase, writable } = await pageCtx('billing')
  const { data: inv } = await supabase.from('invoices').select('*, people(id, first_name, last_name, email, national_id), invoice_lines(*), payments(*)').eq('id', id).maybeSingle()
  if (!inv) notFound()
  const p = inv.people as { id: string; first_name: string; last_name: string; email: string | null; national_id: string | null }
  const lines = inv.invoice_lines as { id: string; description: string; qty: number; unit_cents: number; vat_pct: number; total_cents: number }[]
  const pays = (inv.payments as { id: string; method: string; amount_cents: number; status: string; paid_at: string; provider_ref: string | null }[]).sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at))
  const { data: rect } = inv.rectifies_id ? await supabase.from('invoices').select('id, number').eq('id', inv.rectifies_id).maybeSingle() : { data: null }
  const { data: rects } = await supabase.from('invoices').select('id, number').eq('rectifies_id', id)
  const payable = writable && ['pending', 'overdue'].includes(inv.status)

  return (
    <div className="space-y-5">
      <Link href="/admin/facturacio" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-text"><ArrowLeft size={16} aria-hidden /> {t('club.billing.title')}</Link>
      <header className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{inv.number}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusChip value={inv.status} label={t(`club.bookings.inv.${inv.status}`)} /><span>{t(`club.billing.kinds.${inv.kind}`)}</span><span>{fmtDate(inv.issued_on, locale)}</span>
            {rect && <span>· {t('club.billing.rectifiesOf')} <Link className="text-primary-text underline" href={`/admin/facturacio/${rect.id}`}>{rect.number}</Link></span>}
            {rects?.map((r) => <span key={r.id}>· <Link className="text-primary-text underline" href={`/admin/facturacio/${r.id}`}>{r.number}</Link></span>)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href={`/api/invoices/${inv.id}/pdf?lang=${locale}`} target="_blank" rel="noreferrer"><FileDown size={16} aria-hidden /> PDF</a>
          {payable && (
            <Modal label={t('club.billing.collect')} title={t('club.billing.collect')} className="btn btn-accent">
              <ActionForm action={payInvoice.bind(null, inv.id)} submit={`${t('club.billing.collect')} · ${eur(inv.total_cents, locale)}`}>
                <Field label={t('club.billing.method')}><select name="method" className="input">{['cash', 'card', 'transfer', 'sepa'].map((m) => <option key={m} value={m}>{t(`club.billing.methods.${m}`)}</option>)}</select></Field>
              </ActionForm>
            </Modal>
          )}
          {payable && <ActionButton action={sendReminder} args={[inv.id]} label={t('club.billing.remind')} />}
          {payable && <ActionButton action={voidInvoice} args={[inv.id]} label={t('club.billing.void')} className="btn btn-danger !min-h-11 text-sm" confirm={t('club.common.confirm') + '?'} />}
          {writable && !inv.rectifies_id && ['paid', 'pending', 'overdue'].includes(inv.status) && <ActionButton action={rectifyInvoice} args={[inv.id]} label={t('club.billing.rectify')} confirm={t('club.billing.confirmRectify')} />}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Section title={t('club.billing.lines')}>
          <DataTable label={t('club.billing.lines')}>
            <thead><tr><th className={th}>{t('club.billing.concept')}</th><th className={`${th} text-right`}>{t('club.billing.qty')}</th><th className={`${th} text-right`}>{t('club.billing.unit')}</th><th className={`${th} text-right`}>{t('club.common.total')}</th></tr></thead>
            <tbody>{lines.map((l) => <tr key={l.id} className={trow}><td className={td}>{l.description}</td><td className={`${td} text-right tnum`}>{l.qty}</td><td className={`${td} text-right tnum`}>{eur(l.unit_cents, locale)}</td><td className={`${td} text-right tnum`}>{eur(l.total_cents, locale)}</td></tr>)}</tbody>
          </DataTable>
          <dl className="mt-3 ml-auto w-64"><KV k={t('club.billing.subtotal')} v={eur(inv.subtotal_cents, locale)} /><KV k={t('club.billing.vat')} v={eur(inv.vat_cents, locale)} /><KV k={t('club.common.total')} v={<span className="font-display text-2xl font-extrabold">{eur(inv.total_cents, locale)}</span>} /></dl>
          {inv.notes && <p className="mt-2 text-sm text-muted">{inv.notes}</p>}
        </Section>
        <div className="space-y-5">
          <Section title={t('club.billing.client')}><dl><KV k={t('club.common.name')} v={<Link className="text-primary-text hover:underline" href={`/admin/persones/${p.id}`}>{p.first_name} {p.last_name}</Link>} /><KV k={t('club.people.email')} v={p.email ?? '—'} /><KV k={t('club.people.nationalId')} v={p.national_id ?? '—'} />{inv.due_on && <KV k={t('club.billing.due')} v={fmtDate(inv.due_on, locale)} />}</dl></Section>
          <Section title={t('club.billing.paymentsTitle')}>
            {pays.length === 0 ? <p className="text-sm text-muted">{t('club.billing.noPayments')}</p> : (
              <ul className="divide-y divide-border text-sm">{pays.map((x) => <li key={x.id} className="flex items-center justify-between gap-2 py-2"><span><span className="block font-semibold">{t(`club.billing.methods.${x.method}`)}</span><span className="text-xs text-muted">{fmtDateTime(x.paid_at, locale)}</span></span><span className="flex items-center gap-2"><span className="tnum">{eur(x.amount_cents, locale)}</span><StatusChip value={x.status} /></span></li>)}</ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
