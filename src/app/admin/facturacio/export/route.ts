import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { can, STAFF_ROLES } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { csvResponse, toCsv } from '@/lib/csv'

export async function GET(req: NextRequest) {
  const { profile } = await requireRole(STAFF_ROLES)
  if (!can(profile.role, 'billing')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const supabase = await createClient()
  let q = supabase.from('invoices').select('number, issued_on, due_on, status, kind, subtotal_cents, vat_cents, total_cents, paid_at, people(first_name, last_name, national_id)').order('issued_on', { ascending: false }).limit(10000)
  if (sp.get('status')) q = q.eq('status', sp.get('status')!)
  if (sp.get('kind')) q = q.eq('kind', sp.get('kind')!)
  if (sp.get('from')) q = q.gte('issued_on', sp.get('from')!)
  if (sp.get('to')) q = q.lte('issued_on', sp.get('to')!)
  const { data } = await q
  const f = (c: number) => (c / 100).toFixed(2).replace('.', ',')
  const rows = (data ?? []).map((i) => {
    const p = i.people as unknown as { first_name: string; last_name: string; national_id: string | null }
    return [i.number, i.issued_on, i.due_on, `${p.first_name} ${p.last_name}`, p.national_id, i.kind, i.status, f(i.subtotal_cents), f(i.vat_cents), f(i.total_cents), i.paid_at]
  })
  return csvResponse('factures.csv', toCsv(['numero', 'data', 'venciment', 'client', 'nif', 'tipus', 'estat', 'base', 'iva', 'total', 'pagada_el'], rows))
}
