import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { csvResponse, toCsv } from '@/lib/csv'
import { STAFF_ROLES } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const { profile } = await requireRole(STAFF_ROLES)
  if (!can(profile.role, 'access')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const supabase = await createClient()
  let q = supabase.from('access_logs').select('at, direction, allowed, reason, method, people(first_name, last_name), zones(name_ca)').order('at', { ascending: false }).limit(5000)
  if (sp.get('zone')) q = q.eq('zone_id', sp.get('zone')!)
  if (sp.get('denied') === '1') q = q.eq('allowed', false)
  if (sp.get('from')) q = q.gte('at', sp.get('from')!)
  if (sp.get('to')) q = q.lte('at', `${sp.get('to')}T23:59:59`)
  const { data } = await q
  const rows = (data ?? []).map((r) => {
    const p = r.people as unknown as { first_name: string; last_name: string } | null
    return [r.at, p ? `${p.first_name} ${p.last_name}` : '', (r.zones as unknown as { name_ca: string } | null)?.name_ca, r.direction, r.allowed ? 'si' : 'no', r.reason, r.method]
  })
  return csvResponse('accessos.csv', toCsv(['data', 'persona', 'zona', 'sentit', 'permes', 'motiu', 'metode'], rows))
}
