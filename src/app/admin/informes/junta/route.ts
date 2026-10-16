import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { requireRole } from '@/lib/auth'
import { can, STAFF_ROLES } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { clubParts } from '@/lib/format'

const eur = (c: number) => `${(c / 100).toFixed(2).replace('.', ',')} €`
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ’€–·]/g, '?')

// Informe de una página para la junta: cifras clave del club en el momento de generarlo.
export async function GET() {
  const { profile } = await requireRole(STAFF_ROLES)
  if (!can(profile.role, 'reports')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const supabase = await createClient()
  const today = clubParts(new Date()).date
  const y0 = `${today.slice(0, 4)}-01-01`
  const [rev, byType, debt, memb, bookings, club] = await Promise.all([
    supabase.rpc('report_revenue', { p_from: y0, p_to: today }),
    supabase.rpc('report_by_type'),
    supabase.from('invoices').select('total_cents').eq('status', 'overdue'),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('starts_at', `${y0}T00:00:00Z`),
    supabase.from('settings').select('value').eq('key', 'club').single(),
  ])
  const rows = (rev.data ?? []) as { kind: string; cents: number }[]
  const byKind = (k: string) => rows.filter((r) => r.kind === k).reduce((a, r) => a + Number(r.cents), 0)
  const total = rows.reduce((a, r) => a + Number(r.cents), 0)
  const types = (byType.data ?? []) as { name_ca: string; members: number; fee_cents: number }[]
  const name = (club.data?.value as { name?: string } | null)?.name ?? 'Club Poliesportiu Santjoanenc'

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const BLUE = rgb(0.149, 0.235, 0.725), M = 48
  page.drawRectangle({ x: 0, y: 835, width: 595.28, height: 7, color: BLUE })
  page.drawText(clean(name), { x: M, y: 800, size: 11, font: bold, color: BLUE })
  page.drawText('INFORME PER A LA JUNTA', { x: M, y: 770, size: 24, font: bold })
  page.drawText(clean(`Exercici ${today.slice(0, 4)} · dades a ${today}`), { x: M, y: 750, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
  const kpis: [string, string][] = [['Ingressos cobrats', eur(total)], ['Socis vigents', String(memb.count ?? 0)], ['Reserves confirmades', String(bookings.count ?? 0)], ['Deute vençut', eur((debt.data ?? []).reduce((a, i) => a + i.total_cents, 0))]]
  kpis.forEach(([k, v], i) => {
    const x = M + (i % 2) * 250, y = 690 - Math.floor(i / 2) * 80
    page.drawRectangle({ x, y: y - 10, width: 235, height: 66, color: rgb(0.94, 0.95, 0.99) })
    page.drawText(k.toUpperCase(), { x: x + 12, y: y + 38, size: 8, font: bold, color: BLUE })
    page.drawText(clean(v), { x: x + 12, y: y + 8, size: 22, font: bold })
  })
  let y = 510
  page.drawText('INGRESSOS PER CONCEPTE', { x: M, y, size: 9, font: bold, color: BLUE }); y -= 18
  for (const [k, label] of [['fee', 'Quotes de soci'], ['booking', 'Reserves d’instal·lacions'], ['pass', 'Bons i abonaments'], ['other', 'Altres (botiga, esdeveniments…)']] as const) {
    page.drawText(clean(label), { x: M, y, size: 10, font }); const v = eur(byKind(k)); page.drawText(v, { x: 547 - font.widthOfTextAtSize(v, 10), y, size: 10, font }); y -= 16
  }
  y -= 14
  page.drawText('SOCIS PER TIPUS', { x: M, y, size: 9, font: bold, color: BLUE }); y -= 18
  for (const ty of types) { page.drawText(clean(ty.name_ca), { x: M, y, size: 10, font }); page.drawText(String(ty.members), { x: 360, y, size: 10, font: bold }); page.drawText(clean(`quota ${eur(ty.fee_cents)}/any`), { x: 420, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); y -= 16 }
  page.drawText('Document de demostració amb dades fictícies.', { x: M, y: 38, size: 8, font, color: rgb(0.55, 0.55, 0.55) })
  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="informe-junta.pdf"', 'Cache-Control': 'private, no-store' } })
}
