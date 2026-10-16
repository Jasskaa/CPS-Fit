import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { can, STAFF_ROLES } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { csvResponse, toCsv } from '@/lib/csv'
import { clubParts } from '@/lib/format'

const f = (c: number | string) => (Number(c) / 100).toFixed(2).replace('.', ',')

export async function GET(req: NextRequest) {
  const { profile } = await requireRole(STAFF_ROLES)
  if (!can(profile.role, 'reports')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const type = sp.get('type')
  const supabase = await createClient()
  const today = clubParts(new Date()).date

  if (type === 'revenue') {
    const months = Math.min(36, Math.max(1, Number(sp.get('months')) || 12))
    const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - (months - 1))
    const { data } = await supabase.rpc('report_revenue', { p_from: d.toISOString().slice(0, 10), p_to: today })
    return csvResponse('ingressos.csv', toCsv(['mes', 'concepte', 'metode', 'import_eur', 'cobraments'], ((data ?? []) as { month: string; kind: string; method: string; cents: number; n: number }[]).map((r) => [r.month, r.kind, r.method, f(r.cents), r.n])))
  }
  if (type === 'members') {
    const { data } = await supabase.from('memberships').select('status, started_on, ended_on, seniority_since, membership_types(code, annual_fee_cents), people(first_name, last_name, birth_date, email)').order('started_on')
    return csvResponse('socis.csv', toCsv(['cognoms', 'nom', 'naixement', 'correu', 'tipus', 'quota_anual_eur', 'estat', 'alta', 'baixa'], (data ?? []).map((m) => {
      const p = m.people as unknown as { first_name: string; last_name: string; birth_date: string; email: string | null }
      const t = m.membership_types as unknown as { code: string; annual_fee_cents: number }
      return [p.last_name, p.first_name, p.birth_date, p.email, t.code, f(t.annual_fee_cents), m.status, m.started_on, m.ended_on]
    })))
  }
  if (type === 'debt') {
    const { data } = await supabase.from('invoices').select('number, issued_on, due_on, kind, total_cents, people(first_name, last_name, email, phone)').eq('status', 'overdue').order('due_on')
    return csvResponse('deute.csv', toCsv(['factura', 'emissio', 'venciment', 'tipus', 'import_eur', 'persona', 'correu', 'telefon'], (data ?? []).map((i) => {
      const p = i.people as unknown as { first_name: string; last_name: string; email: string | null; phone: string | null }
      return [i.number, i.issued_on, i.due_on, i.kind, f(i.total_cents), `${p.first_name} ${p.last_name}`, p.email, p.phone]
    })))
  }
  return NextResponse.json({ error: 'unknown_type' }, { status: 400 })
}
