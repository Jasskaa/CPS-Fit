import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { CLUB_TZ } from '@/lib/format'

export interface InvoiceDoc {
  number: string; issued_on: string; due_on: string | null; status: string; kind: string; notes: string | null
  subtotal_cents: number; vat_cents: number; total_cents: number
  person: { name: string; address: string | null; national_id: string | null; email: string | null }
  lines: { description: string; qty: number; unit_cents: number; vat_pct: number; total_cents: number }[]
  payments: { method: string; amount_cents: number; paid_at: string; status: string }[]
  club: { name: string; address: string; email: string; phone: string; iban?: string }
  rectifies?: string | null
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace('.', ',')} €`
const BLUE = rgb(0.149, 0.235, 0.725)
const GREY = rgb(0.3, 0.3, 0.3)

const wrap = (text: string, max: number, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number) => {
  const out: string[] = []
  let line = ''
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(t, size) > max && line) { out.push(line); line = w } else line = t
  }
  if (line) out.push(line)
  return out
}
// Las fuentes estándar de PDF solo codifican WinAnsi: se sustituye lo demás.
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ’‘“”€–—·]/g, '?')

const TXT = {
  ca: { invoice: 'FACTURA', rect: 'FACTURA RECTIFICATIVA', number: 'Número', date: 'Data', due: 'Venciment', to: 'Client', desc: 'Concepte', qty: 'Ut.', unit: 'Preu', vat: 'IVA', total: 'Total', sub: 'Base imposable', vatT: 'IVA', paid: 'PAGADA', pending: 'PENDENT DE PAGAMENT', overdue: 'VENÇUDA', void: 'ANUL·LADA', refunded: 'RETORNADA', payments: 'Pagaments', note: 'Document de demostració amb dades fictícies.', exempt: 'Operació exempta d’IVA (entitat esportiva sense ànim de lucre)', locale: 'ca-ES' },
  es: { invoice: 'FACTURA', rect: 'FACTURA RECTIFICATIVA', number: 'Número', date: 'Fecha', due: 'Vencimiento', to: 'Cliente', desc: 'Concepto', qty: 'Ud.', unit: 'Precio', vat: 'IVA', total: 'Total', sub: 'Base imponible', vatT: 'IVA', paid: 'PAGADA', pending: 'PENDIENTE DE PAGO', overdue: 'VENCIDA', void: 'ANULADA', refunded: 'DEVUELTA', payments: 'Pagos', note: 'Documento de demostración con datos ficticios.', exempt: 'Operación exenta de IVA (entidad deportiva sin ánimo de lucro)', locale: 'es-ES' },
}

/** Genera la factura en PDF A4 con la identidad del club. */
export async function renderInvoicePdf(d: InvoiceDoc, lang: 'ca' | 'es' = 'ca'): Promise<Uint8Array> {
  const L = TXT[lang]
  const day = (s: string) => new Date(s).toLocaleDateString(L.locale, { timeZone: CLUB_TZ })
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28, M = 48

  page.drawRectangle({ x: 0, y: 835, width: W, height: 7, color: BLUE })
  try {
    const logo = await pdf.embedPng(await readFile(join(process.cwd(), 'public/brand/emblem-160.png')))
    const h = 52 * (logo.height / logo.width)
    page.drawImage(logo, { x: M, y: 800 - h / 2 + 10, width: 52, height: h })
  } catch { /* sin logo */ }
  page.drawText(clean(d.club.name), { x: M + 64, y: 800, size: 14, font: bold, color: BLUE })
  page.drawText(clean(d.club.address), { x: M + 64, y: 785, size: 9, font, color: GREY })
  page.drawText(clean(`${d.club.email} · ${d.club.phone}`), { x: M + 64, y: 773, size: 9, font, color: GREY })
  const title = d.rectifies ? L.rect : L.invoice
  page.drawText(title, { x: W - M - bold.widthOfTextAtSize(title, 18), y: 800, size: 18, font: bold, color: BLUE })
  const meta: [string, string][] = [[L.number, d.number], [L.date, day(d.issued_on)]]
  if (d.due_on) meta.push([L.due, day(d.due_on)])
  let y = 780
  for (const [k, v] of meta) {
    page.drawText(`${k}:`, { x: W - M - 150, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(clean(v), { x: W - M - 100, y, size: 9, font: bold })
    y -= 12
  }

  y = 715
  page.drawText(L.to.toUpperCase(), { x: M, y, size: 8, font: bold, color: BLUE })
  page.drawText(clean(d.person.name), { x: M, y: y - 14, size: 11, font: bold })
  const sub = [d.person.national_id, d.person.address, d.person.email].filter(Boolean) as string[]
  sub.forEach((s, i) => page.drawText(clean(s), { x: M, y: y - 28 - i * 12, size: 9, font, color: GREY }))

  y = 640
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.93, 0.94, 0.99) })
  const cx = { desc: M + 8, qty: 340, unit: 395, vat: 455, total: W - M - 8 }
  page.drawText(L.desc, { x: cx.desc, y, size: 9, font: bold, color: BLUE })
  page.drawText(L.qty, { x: cx.qty, y, size: 9, font: bold, color: BLUE })
  page.drawText(L.unit, { x: cx.unit, y, size: 9, font: bold, color: BLUE })
  page.drawText(L.vat, { x: cx.vat, y, size: 9, font: bold, color: BLUE })
  page.drawText(L.total, { x: cx.total - bold.widthOfTextAtSize(L.total, 9), y, size: 9, font: bold, color: BLUE })
  y -= 22
  for (const l of d.lines) {
    const rows = wrap(clean(l.description), 270, font, 9.5)
    rows.forEach((r, i) => page.drawText(r, { x: cx.desc, y: y - i * 11, size: 9.5, font }))
    page.drawText(String(l.qty), { x: cx.qty, y, size: 9.5, font })
    page.drawText(eur(l.unit_cents), { x: cx.unit, y, size: 9.5, font })
    page.drawText(`${l.vat_pct}%`, { x: cx.vat, y, size: 9.5, font })
    const tt = eur(l.total_cents)
    page.drawText(tt, { x: cx.total - font.widthOfTextAtSize(tt, 9.5), y, size: 9.5, font })
    y -= Math.max(1, rows.length) * 11 + 7
    page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.85) })
  }

  y -= 14
  const totals: [string, string, boolean][] = [[L.sub, eur(d.subtotal_cents), false], [L.vatT, eur(d.vat_cents), false], [L.total, eur(d.total_cents), true]]
  for (const [k, v, strong] of totals) {
    const f = strong ? bold : font
    const s = strong ? 13 : 10
    page.drawText(k, { x: 370, y, size: s, font: f })
    page.drawText(v, { x: cx.total - f.widthOfTextAtSize(v, s), y, size: s, font: f, color: strong ? BLUE : undefined })
    y -= 15
  }
  if (d.vat_cents === 0) page.drawText(clean(L.exempt), { x: M, y: y + 16, size: 8, font, color: rgb(0.45, 0.45, 0.45) })
  const stamps: Record<string, string> = { paid: L.paid, pending: L.pending, overdue: L.overdue, void: L.void, refunded: L.refunded }
  const stamp = stamps[d.status]
  if (stamp) {
    const col = d.status === 'paid' ? rgb(0.1, 0.55, 0.3) : d.status === 'overdue' ? rgb(0.8, 0.15, 0.15) : rgb(0.8, 0.5, 0.05)
    page.drawText(stamp, { x: M, y: y - 20, size: 16, font: bold, color: col })
  }
  y -= 60
  if (d.payments.length) {
    page.drawText(L.payments.toUpperCase(), { x: M, y, size: 8, font: bold, color: BLUE })
    y -= 14
    for (const p of d.payments) {
      page.drawText(clean(`${day(p.paid_at)} · ${p.method} · ${eur(p.amount_cents)} · ${p.status}`), { x: M, y, size: 9, font })
      y -= 12
    }
  }
  if (d.notes) {
    y -= 6
    for (const r of wrap(clean(d.notes), W - 2 * M, font, 9)) { page.drawText(r, { x: M, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) }); y -= 11 }
  }
  if (d.club.iban) page.drawText(clean(`IBAN ${d.club.iban}`), { x: M, y: 52, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
  page.drawText(clean(L.note), { x: M, y: 38, size: 8, font, color: rgb(0.55, 0.55, 0.55) })
  return pdf.save()
}
