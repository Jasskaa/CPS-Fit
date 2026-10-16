import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { renderInvoicePdf, type InvoiceDoc } from './pdf'

const doc: InvoiceDoc = {
  number: 'F-2026-01071', issued_on: '2026-10-16', due_on: '2026-10-31', status: 'paid', kind: 'booking', notes: 'Pista pàdel 1 · 16/10/2026 15:00',
  subtotal_cents: 2150, vat_cents: 0, total_cents: 2150,
  person: { name: 'Sandra Aymerich Serra', address: 'C/ Major 12, 17857', national_id: 'DEMO-000123', email: 'sandra@exemple.cat' },
  lines: [
    { description: 'Reserva Pista pàdel 1 16/10 15:00–16:00 (preu no soci)', qty: 1, unit_cents: 1650, vat_pct: 0, total_cents: 1650 },
    { description: 'Lloguer de pala de pàdel', qty: 2, unit_cents: 250, vat_pct: 0, total_cents: 500 },
  ],
  payments: [{ method: 'cash', amount_cents: 2150, paid_at: '2026-10-16T13:05:00Z', status: 'succeeded' }],
  club: { name: 'Club Poliesportiu Santjoanenc', address: 'C/ Paperera Torras, 2, 17857 Sant Joan les Fonts', email: 'info@cpsantjoanenc.org', phone: '972 29 22 37', iban: 'ES9121000418450200051332' },
}

describe('factura PDF', () => {
  it('genera un PDF válido en catalán y castellano', async () => {
    const ca = await renderInvoicePdf(doc, 'ca')
    const es = await renderInvoicePdf({ ...doc, status: 'overdue', rectifies: 'x' }, 'es')
    expect(Buffer.from(ca.slice(0, 5)).toString()).toBe('%PDF-')
    expect(ca.length).toBeGreaterThan(5000)
    expect(es.length).toBeGreaterThan(5000)
    if (process.env.PDF_OUT) { mkdirSync(process.env.PDF_OUT, { recursive: true }); writeFileSync(`${process.env.PDF_OUT}/factura-ca.pdf`, ca); writeFileSync(`${process.env.PDF_OUT}/factura-es.pdf`, es) }
  })
})
