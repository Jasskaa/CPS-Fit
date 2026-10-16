import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { can, STAFF_ROLES } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { csvResponse, toCsv } from '@/lib/csv'
import { clubInstant } from '@/lib/format'

export async function GET(req: NextRequest) {
  const { profile } = await requireRole(STAFF_ROLES)
  if (!can(profile.role, 'bookings')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const supabase = await createClient()
  let q = supabase.from('bookings').select('starts_at, ends_at, status, kind, price_cents, audience_applied, resources(name), people!bookings_person_id_fkey(first_name, last_name), invoices!bookings_invoice_id_fkey(number, status)').order('starts_at', { ascending: false }).limit(5000)
  if (sp.get('status')) q = q.eq('status', sp.get('status')!)
  if (sp.get('from')) q = q.gte('starts_at', clubInstant(sp.get('from')!, '00:00').toISOString())
  if (sp.get('to')) q = q.lt('starts_at', clubInstant(sp.get('to')!, '23:59').toISOString())
  const { data } = await q
  const rows = (data ?? []).map((b) => {
    const p = b.people as unknown as { first_name: string; last_name: string } | null
    const inv = b.invoices as unknown as { number: string; status: string } | null
    return [b.starts_at, b.ends_at, (b.resources as unknown as { name: string })?.name, p ? `${p.first_name} ${p.last_name}` : '', b.kind, b.status, b.audience_applied, (b.price_cents / 100).toFixed(2), inv?.number, inv?.status]
  })
  return csvResponse('reserves.csv', toCsv(['inici', 'fi', 'instal·lacio', 'persona', 'tipus', 'estat', 'tarifa', 'preu_eur', 'factura', 'estat_factura'], rows))
}
