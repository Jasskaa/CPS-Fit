import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderInvoicePdf } from '@/modules/billing/pdf'

// Cualquier usuario autenticado puede descargar una factura que RLS le permita ver (la suya o, en el panel, las de su ámbito).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  if (!auth?.claims?.sub) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, invoice_lines(*), payments(method, amount_cents, paid_at, status), people(first_name, last_name, address, postal_code, national_id, email)')
    .eq('id', id).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { data: club } = await supabase.from('settings').select('key, value').in('key', ['club', 'billing'])
  const c = (club?.find((x) => x.key === 'club')?.value ?? {}) as { name: string; address: string; email: string; phone: string }
  const b = (club?.find((x) => x.key === 'billing')?.value ?? {}) as { iban?: string }
  const p = inv.people as { first_name: string; last_name: string; address: string | null; postal_code: string | null; national_id: string | null; email: string | null }
  const lang = new URL(req.url).searchParams.get('lang') === 'es' ? 'es' : 'ca'
  const bytes = await renderInvoicePdf({
    number: inv.number, issued_on: inv.issued_on, due_on: inv.due_on, status: inv.status, kind: inv.kind, notes: inv.notes,
    subtotal_cents: inv.subtotal_cents, vat_cents: inv.vat_cents, total_cents: inv.total_cents,
    person: { name: `${p.first_name} ${p.last_name}`, address: [p.address, p.postal_code].filter(Boolean).join(', ') || null, national_id: p.national_id, email: p.email },
    lines: inv.invoice_lines, payments: inv.payments, club: { name: c.name, address: c.address, email: c.email, phone: c.phone, iban: b.iban },
    rectifies: inv.rectifies_id,
  }, lang)
  return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.number}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
