'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionCtx, ilikeSafe, personSearch } from '@/lib/ctx'
import { buildPain008, validIban } from '@/modules/billing/sepa'
import { paymentProvider } from '@/modules/payments/provider'

type R = { ok: boolean; error?: string; id?: string; count?: number; total?: number }
const today = () => new Date().toISOString().slice(0, 10)

// ───────── Cuotas de socio (enero y junio) ─────────

/** Vista previa de la tirada: quién recibiría factura y por cuánto, sin crear nada. */
export async function previewFeeRun(period: 'jan' | 'jun', year: number) {
  const { supabase } = await actionCtx('billing')
  return computeFeeRun(supabase, period, year)
}

async function computeFeeRun(supabase: Awaited<ReturnType<typeof actionCtx>>['supabase'], period: 'jan' | 'jun', year: number) {
  const label = `Quota ${period === 'jan' ? '1r semestre' : '2n semestre'} ${year}`
  const { data: mems } = await supabase.from('memberships')
    .select('id, person_id, entry_fee_due, entry_fee_paid, membership_types(code, name_ca, annual_fee_cents)').eq('status', 'active').eq('billable', true)
  const ids = (mems ?? []).map((m) => m.person_id)
  const { data: existing } = ids.length ? await supabase.from('invoices').select('person_id').eq('source', 'fee_run').eq('notes', label).in('person_id', ids) : { data: [] }
  const done = new Set((existing ?? []).map((e) => e.person_id))
  const { data: banks } = ids.length ? await supabase.from('bank_accounts').select('person_id').in('person_id', ids) : { data: [] }
  const hasBank = new Set((banks ?? []).map((b) => b.person_id))
  const { data: cfg } = await supabase.from('settings').select('value').eq('key', 'billing').single()
  const entry = (cfg?.value as { entry_fee_cents: number } | undefined)?.entry_fee_cents ?? 10500
  const rows = (mems ?? [])
    .filter((m) => !done.has(m.person_id))
    .map((m) => {
      const ty = m.membership_types as unknown as { code: string; name_ca: string; annual_fee_cents: number }
      const half = Math.round(ty.annual_fee_cents / 2)
      const withEntry = period === 'jan' && m.entry_fee_due && !m.entry_fee_paid
      return { membership_id: m.id, person_id: m.person_id, type: ty.name_ca, fee: half, entry: withEntry ? entry : 0, sepa: hasBank.has(m.person_id) }
    })
    .filter((r) => r.fee + r.entry > 0)
  return { label, rows, alreadyDone: done.size }
}

export async function runFeeRun(period: 'jan' | 'jun', year: number): Promise<R> {
  const { supabase, userId } = await actionCtx('billing')
  const { label, rows } = await computeFeeRun(supabase, period, year)
  let count = 0, total = 0
  const issued = period === 'jan' ? `${year}-01-01` : `${year}-06-01`
  for (const r of rows) {
    const { data: inv, error } = await supabase.from('invoices').insert({ person_id: r.person_id, kind: 'fee', status: 'pending', source: 'fee_run', notes: label, issued_on: issued, due_on: `${issued.slice(0, 8)}15`, created_by: userId }).select('id').single()
    if (error || !inv) continue
    await supabase.from('invoice_lines').insert([
      { invoice_id: inv.id, description: `${label} · ${r.type}`, qty: 1, unit_cents: r.fee },
      ...(r.entry ? [{ invoice_id: inv.id, description: 'Quota d’entrada (única vegada)', qty: 1, unit_cents: r.entry }] : []),
    ])
    count++; total += r.fee + r.entry
  }
  revalidatePath('/admin/facturacio')
  return { ok: true, count, total }
}

// ───────── Remesas SEPA ─────────

/** Crea una remesa con las cuotas pendientes de quien tiene domiciliación y genera el XML pain.008. */
export async function createSepaBatch(fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('billing')
  const collection = String(fd.get('collection_date') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(collection)) return { ok: false, error: 'invalid' }
  const { data: cfg } = await supabase.from('settings').select('value').eq('key', 'billing').single()
  const b = cfg?.value as { iban: string; creditor_id: string; creditor_name: string }
  const { data: already } = await supabase.from('sepa_items').select('invoice_id')
  const taken = new Set((already ?? []).map((a) => a.invoice_id))
  const { data: invs } = await supabase.from('invoices').select('id, number, person_id, total_cents, notes, people(first_name, last_name)').eq('kind', 'fee').in('status', ['pending', 'overdue']).gt('total_cents', 0)
  const candidates = (invs ?? []).filter((i) => !taken.has(i.id))
  const { data: banks } = candidates.length ? await supabase.from('bank_accounts').select('*').in('person_id', candidates.map((c) => c.person_id)) : { data: [] }
  const bank = new Map((banks ?? []).map((x) => [x.person_id, x]))
  const items = candidates.filter((c) => bank.has(c.person_id) && validIban(bank.get(c.person_id)!.iban))
  if (!items.length) return { ok: false, error: 'empty' }

  const reference = `CPS-${collection.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`
  const xml = buildPain008({
    msgId: reference, collectionDate: collection, creditor: { name: b.creditor_name, iban: b.iban, creditorId: b.creditor_id },
    items: items.map((i) => {
      const bk = bank.get(i.person_id)!
      const p = i.people as unknown as { first_name: string; last_name: string }
      return { endToEndId: i.number ?? i.id.slice(0, 12), amountCents: i.total_cents, debtorName: bk.holder_name ?? `${p.first_name} ${p.last_name}`, debtorIban: bk.iban, mandateId: bk.mandate_id ?? `M-${i.person_id.slice(0, 8)}`, mandateDate: bk.mandate_signed_on ?? today(), concept: i.notes ?? 'Quota de soci', sequence: 'RCUR' as const }
    }),
  })
  const total = items.reduce((a, i) => a + i.total_cents, 0)
  const { data: batch, error } = await supabase.from('sepa_batches').insert({ reference, kind: 'fees', collection_date: collection, status: 'draft', total_cents: total, xml, created_by: userId }).select('id').single()
  if (error || !batch) return { ok: false, error: error?.message ?? 'error' }
  await supabase.from('sepa_items').insert(items.map((i) => {
    const bk = bank.get(i.person_id)!
    return { batch_id: batch.id, invoice_id: i.id, person_id: i.person_id, mandate_id: bk.mandate_id, iban_last4: bk.iban.slice(-4), amount_cents: i.total_cents }
  }))
  revalidatePath('/admin/facturacio')
  return { ok: true, id: batch.id, count: items.length, total }
}

export async function setBatchStatus(id: string, status: 'submitted' | 'closed'): Promise<R> {
  const { supabase, userId } = await actionCtx('billing')
  if (status === 'closed') {
    // Al cerrar, los recibos no devueltos se dan por cobrados.
    const { data: items } = await supabase.from('sepa_items').select('id, invoice_id, person_id, amount_cents').eq('batch_id', id).eq('status', 'pending')
    for (const it of items ?? []) {
      await supabase.from('payments').insert({ invoice_id: it.invoice_id, person_id: it.person_id, method: 'sepa', amount_cents: it.amount_cents, status: 'succeeded', provider: 'sepa', created_by: userId })
      await supabase.from('sepa_items').update({ status: 'collected' }).eq('id', it.id)
    }
  }
  const { error } = await supabase.from('sepa_batches').update({ status }).eq('id', id)
  revalidatePath('/admin/facturacio')
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Marca un recibo como devuelto: la factura vuelve a vencida y se avisa a la persona. */
export async function returnSepaItem(itemId: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('billing')
  const reason = String(fd.get('reason') ?? 'MS03').slice(0, 40)
  const { data: it } = await supabase.from('sepa_items').select('invoice_id, person_id, status').eq('id', itemId).single()
  if (!it) return { ok: false, error: 'not_found' }
  if (it.status === 'collected') await supabase.from('payments').update({ status: 'refunded' }).eq('invoice_id', it.invoice_id).eq('method', 'sepa')
  await supabase.from('sepa_items').update({ status: 'returned', return_reason: reason }).eq('id', itemId)
  await supabase.from('invoices').update({ status: 'overdue', paid_at: null }).eq('id', it.invoice_id)
  await supabase.from('notifications').insert({ person_id: it.person_id, channel: 'push', title: 'Rebut retornat', body: 'El banc ha retornat el rebut de la quota. Contacta amb recepció per regularitzar-ho.', url: '/app/pagaments' })
  revalidatePath('/admin/facturacio')
  return { ok: true }
}

// ───────── Cobros y operaciones sobre facturas ─────────

export async function payInvoice(invoiceId: string, fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('billing')
  const method = z.enum(['cash', 'card', 'transfer', 'sepa']).safeParse(fd.get('method'))
  if (!method.success) return { ok: false, error: 'invalid' }
  const { data: inv } = await supabase.from('invoices').select('person_id, total_cents, status').eq('id', invoiceId).single()
  if (!inv || !['pending', 'overdue'].includes(inv.status)) return { ok: false, error: 'not_payable' }
  let provider: string | null = null, ref: string | null = null
  if (method.data === 'card') {
    const r = await paymentProvider.charge({ invoiceId, personId: inv.person_id, amountCents: inv.total_cents, method: 'card' })
    if (!r.ok) return { ok: false, error: r.error ?? 'declined' }
    provider = r.provider; ref = r.ref
  }
  const { data: cash } = method.data === 'cash' ? await supabase.from('cash_sessions').select('id').is('closed_at', null).maybeSingle() : { data: null }
  const { error } = await supabase.from('payments').insert({ invoice_id: invoiceId, person_id: inv.person_id, method: method.data, amount_cents: inv.total_cents, status: 'succeeded', provider, provider_ref: ref, cash_session_id: cash?.id ?? null, created_by: userId })
  revalidatePath('/admin/facturacio')
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function voidInvoice(invoiceId: string): Promise<R> {
  const { supabase } = await actionCtx('billing')
  const { data: inv } = await supabase.from('invoices').select('status').eq('id', invoiceId).single()
  if (!inv || !['pending', 'overdue', 'draft'].includes(inv.status)) return { ok: false, error: 'not_voidable' }
  await supabase.from('invoices').update({ status: 'void' }).eq('id', invoiceId)
  revalidatePath('/admin/facturacio')
  return { ok: true }
}

/** Factura rectificativa (serie R) con las líneas en negativo; la original queda como devuelta. */
export async function rectifyInvoice(invoiceId: string): Promise<R> {
  const { supabase, userId } = await actionCtx('billing')
  const { data: inv } = await supabase.from('invoices').select('*, invoice_lines(*)').eq('id', invoiceId).single()
  if (!inv || inv.rectifies_id || inv.status === 'void') return { ok: false, error: 'not_rectifiable' }
  const { data: rect, error } = await supabase.from('invoices').insert({ series: 'R', person_id: inv.person_id, kind: inv.kind, status: 'paid', rectifies_id: inv.id, notes: `Rectificativa de ${inv.number}`, source: 'rectify', created_by: userId, paid_at: new Date().toISOString() }).select('id').single()
  if (error || !rect) return { ok: false, error: error?.message ?? 'error' }
  await supabase.from('invoice_lines').insert((inv.invoice_lines as { description: string; qty: number; unit_cents: number; vat_pct: number }[]).map((l) => ({ invoice_id: rect.id, description: `Abonament: ${l.description}`, qty: l.qty, unit_cents: -l.unit_cents, vat_pct: l.vat_pct })))
  if (inv.status === 'paid') await supabase.from('payments').update({ status: 'refunded' }).eq('invoice_id', inv.id).eq('status', 'succeeded')
  await supabase.from('invoices').update({ status: 'refunded' }).eq('id', inv.id)
  revalidatePath('/admin/facturacio')
  return { ok: true, id: rect.id }
}

export async function sendReminder(invoiceId: string): Promise<R> {
  const { supabase } = await actionCtx('billing')
  const { data: inv } = await supabase.from('invoices').select('person_id, number, total_cents').eq('id', invoiceId).single()
  if (!inv) return { ok: false, error: 'not_found' }
  await supabase.from('notifications').insert({ person_id: inv.person_id, channel: 'push', title: 'Recordatori de pagament', body: `Tens la factura ${inv.number} pendent de pagament.`, url: '/app/pagaments' })
  return { ok: true }
}

/** Marca como vencidas las facturas pendientes pasadas de fecha (se puede lanzar a mano o desde un cron). */
export async function markOverdue(): Promise<R> {
  const { supabase } = await actionCtx('billing')
  const { data } = await supabase.from('invoices').update({ status: 'overdue' }).eq('status', 'pending').lt('due_on', today()).select('id')
  revalidatePath('/admin/facturacio')
  return { ok: true, count: data?.length ?? 0 }
}

// ───────── TPV (venta de mostrador) y caja ─────────

export async function tpvSearchPeople(q: string) {
  const { supabase } = await actionCtx('billing')
  const s = ilikeSafe(q)
  if (s.length < 2) return []
  const { data } = await personSearch(supabase.from('people').select('id, first_name, last_name, memberships(status)'), s).limit(6)
  return (data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, member: (p.memberships as { status: string }[]).some((m) => m.status === 'active') }))
}

const cartSchema = z.object({ personId: z.string().uuid().nullable(), method: z.enum(['cash', 'card']), items: z.array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(20) })).min(1).max(30) })

export async function tpvCheckout(input: z.infer<typeof cartSchema>): Promise<R> {
  const { supabase, userId } = await actionCtx('billing')
  const p = cartSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'invalid' }
  let personId = p.data.personId
  if (!personId) {
    // Venta anónima: se factura a una persona genérica de mostrador.
    const { data: w } = await supabase.from('people').select('id').eq('first_name', 'Client').eq('last_name', 'de mostrador').maybeSingle()
    if (w) personId = w.id
    else {
      const { data: n, error } = await supabase.from('people').insert({ first_name: 'Client', last_name: 'de mostrador', birth_date: '1990-01-01', status: 'active', notes: 'Persona genèrica per a vendes de taulell sense identificar' }).select('id').single()
      if (error || !n) return { ok: false, error: error?.message ?? 'error' }
      personId = n.id
    }
  }
  const { data: mem } = await supabase.from('memberships').select('id').eq('person_id', personId).eq('status', 'active').limit(1).maybeSingle()
  const { data: prods } = await supabase.from('products').select('*').in('id', p.data.items.map((i) => i.productId))
  const lines = p.data.items.map((i) => {
    const pr = prods?.find((x) => x.id === i.productId)
    return pr ? { invoice_id: '', description: pr.name_ca, qty: i.qty, unit_cents: mem ? pr.price_member_cents : pr.price_non_member_cents, vat_pct: pr.vat_pct, product_id: pr.id } : null
  }).filter(Boolean) as { invoice_id: string; description: string; qty: number; unit_cents: number; vat_pct: number; product_id: string }[]
  const hasPass = prods?.some((x) => x.kind === 'pass')
  const { data: inv, error } = await supabase.from('invoices').insert({ person_id: personId, kind: hasPass ? 'pass' : 'other', status: 'pending', source: 'tpv', created_by: userId }).select('id').single()
  if (error || !inv) return { ok: false, error: error?.message ?? 'error' }
  await supabase.from('invoice_lines').insert(lines.map((l) => ({ ...l, invoice_id: inv.id })))
  const { data: i2 } = await supabase.from('invoices').select('total_cents').eq('id', inv.id).single()
  const amount = i2?.total_cents ?? 0
  if (amount > 0) {
    let provider: string | null = null, ref: string | null = null
    if (p.data.method === 'card') {
      const r = await paymentProvider.charge({ invoiceId: inv.id, personId: personId as string, amountCents: amount, method: 'card' })
      if (!r.ok) { await supabase.from('invoices').update({ status: 'void' }).eq('id', inv.id); return { ok: false, error: r.error ?? 'declined' } }
      provider = r.provider; ref = r.ref
    }
    const { data: cash } = p.data.method === 'cash' ? await supabase.from('cash_sessions').select('id').is('closed_at', null).maybeSingle() : { data: null }
    await supabase.from('payments').insert({ invoice_id: inv.id, person_id: personId, method: p.data.method, amount_cents: amount, status: 'succeeded', provider, provider_ref: ref, cash_session_id: cash?.id ?? null, created_by: userId })
  } else await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id)
  revalidatePath('/admin/facturacio')
  return { ok: true, id: inv.id, total: amount }
}

export async function openCash(fd: FormData): Promise<R> {
  const { supabase, userId } = await actionCtx('billing')
  const opening = Math.round(Number(String(fd.get('opening')).replace(',', '.')) * 100)
  if (!Number.isFinite(opening) || opening < 0) return { ok: false, error: 'invalid' }
  const { data: open } = await supabase.from('cash_sessions').select('id').is('closed_at', null).maybeSingle()
  if (open) return { ok: false, error: 'already_open' }
  const { error } = await supabase.from('cash_sessions').insert({ opened_by: userId, opening_cents: opening })
  revalidatePath('/admin/facturacio')
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function closeCash(id: string, fd: FormData): Promise<R> {
  const { supabase } = await actionCtx('billing')
  const counted = Math.round(Number(String(fd.get('counted')).replace(',', '.')) * 100)
  if (!Number.isFinite(counted) || counted < 0) return { ok: false, error: 'invalid' }
  const { data: s } = await supabase.from('cash_sessions').select('opening_cents').eq('id', id).single()
  const { data: pays } = await supabase.from('payments').select('amount_cents, status').eq('cash_session_id', id).eq('method', 'cash')
  const expected = (s?.opening_cents ?? 0) + (pays ?? []).filter((x) => x.status === 'succeeded').reduce((a, x) => a + x.amount_cents, 0)
  const { error } = await supabase.from('cash_sessions').update({ closed_at: new Date().toISOString(), counted_cents: counted, expected_cents: expected, note: String(fd.get('note') ?? '') || null }).eq('id', id)
  revalidatePath('/admin/facturacio')
  return error ? { ok: false, error: error.message } : { ok: true }
}
