import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { buildPain008, validIban } from '@/modules/billing/sepa'

// Descarga del fichero pain.008 de una remesa (RLS: solo administración y junta).
// Si la remesa es histórica y no guardó el XML, se reconstruye a partir de sus recibos y las domiciliaciones.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireRole(['admin', 'board'])
  const supabase = await createClient()
  const { data: batch } = await supabase.from('sepa_batches').select('reference, xml, collection_date').eq('id', id).maybeSingle()
  if (!batch) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  let xml = batch.xml
  if (!xml) {
    const [{ data: items }, { data: cfg }] = await Promise.all([
      supabase.from('sepa_items').select('amount_cents, person_id, mandate_id, invoices(number, notes), people(first_name, last_name)').eq('batch_id', id),
      supabase.from('settings').select('value').eq('key', 'billing').single(),
    ])
    const ids = (items ?? []).map((i) => i.person_id)
    const { data: banks } = ids.length ? await supabase.from('bank_accounts').select('person_id, iban, holder_name, mandate_id, mandate_signed_on').in('person_id', ids) : { data: [] }
    const bank = new Map((banks ?? []).map((b) => [b.person_id, b]))
    const b = cfg?.value as { iban: string; creditor_id: string; creditor_name: string }
    const rows = (items ?? []).filter((i) => bank.get(i.person_id) && validIban(bank.get(i.person_id)!.iban))
    if (!rows.length) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    xml = buildPain008({
      msgId: batch.reference, collectionDate: batch.collection_date, creditor: { name: b.creditor_name, iban: b.iban, creditorId: b.creditor_id },
      items: rows.map((i) => {
        const bk = bank.get(i.person_id)!
        const p = i.people as unknown as { first_name: string; last_name: string }
        const inv = i.invoices as unknown as { number: string; notes: string | null }
        return { endToEndId: inv?.number ?? i.person_id.slice(0, 12), amountCents: i.amount_cents, debtorName: bk.holder_name ?? `${p.first_name} ${p.last_name}`, debtorIban: bk.iban, mandateId: i.mandate_id ?? bk.mandate_id ?? 'M', mandateDate: bk.mandate_signed_on ?? '2024-01-01', concept: inv?.notes ?? 'Quota de soci', sequence: 'RCUR' as const }
      }),
    })
  }
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${batch.reference}.xml"`, 'Cache-Control': 'no-store' } })
}
