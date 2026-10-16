import { describe, expect, it } from 'vitest'
import { bookingPriceCents, canCancel, priceBreakdown, type PricingRule } from './pricing/pricing'
import { checkEligibility, entryFeeCents, householdFeeCents, nextAutoType } from './membership/rules'
import { evaluateAccess, type AccessRule } from './access/evaluate'
import { makeCardToken, verifyCardToken } from './access/qr'
import { buildPain008, validIban } from './billing/sepa'
import { clubInstant } from '@/lib/format'

const rules: PricingRule[] = [
  { resource_kind: 'padel', audience: 'member', weekdays: [1, 2, 3, 4, 5], hour_from: 8, hour_to: 17, price_cents_hour: 1050 },
  { resource_kind: 'padel', audience: 'member', weekdays: [1, 2, 3, 4, 5], hour_from: 17, hour_to: 23, price_cents_hour: 1450 },
  { resource_kind: 'padel', audience: 'non_member', weekdays: [1, 2, 3, 4, 5], hour_from: 8, hour_to: 17, price_cents_hour: 1650 },
  { resource_kind: 'padel', audience: 'non_member', weekdays: [1, 2, 3, 4, 5], hour_from: 17, hour_to: 23, price_cents_hour: 2050 },
]
// 2026-10-14 es miércoles (CEST, UTC+2)
const at = (t: string, d = '2026-10-14') => clubInstant(d, t)

describe('pricing', () => {
  it('socio en horario de mañana: 10,50 €/h', () => {
    expect(bookingPriceCents(rules, 'padel', 'member', at('10:00'), at('11:30'))).toBe(1575)
  })
  it('no socio en hora punta: 20,50 €/h', () => {
    expect(bookingPriceCents(rules, 'padel', 'non_member', at('18:00'), at('19:30'))).toBe(3075)
  })
  it('cruza franja 16:30–17:30: media hora de cada tarifa', () => {
    expect(bookingPriceCents(rules, 'padel', 'member', at('16:30'), at('17:30'))).toBe(525 + 725)
    expect(priceBreakdown(rules, 'padel', 'member', at('16:30'), at('17:30'))).toHaveLength(2)
  })
  it('cancelación con antelación', () => {
    expect(canCancel(at('18:00'), at('10:00'), 6)).toBe(true)
    expect(canCancel(at('18:00'), at('10:00'), 12)).toBe(false)
  })
})

describe('membership', () => {
  const jove = { code: 'jove', min_age: 18, max_age: 23 }
  it('edad por tramos', () => {
    expect(checkEligibility(jove, { birth_date: '2005-01-01' }, new Date('2026-10-16')).ok).toBe(true)
    expect(checkEligibility(jove, { birth_date: '2000-01-01' }, new Date('2026-10-16')).reasons).toContain('age_max')
  })
  it('antigüedad ≥ 10 años y jubilado ≥ 65', () => {
    const t = { code: 'senior', min_seniority_years: 10, retiree: true }
    expect(checkEligibility(t, { birth_date: '1950-01-01', seniority_years: 5 }).reasons).toEqual(['seniority'])
    expect(checkEligibility(t, { birth_date: '1950-01-01', seniority_years: 12 }).ok).toBe(true)
    expect(checkEligibility(t, { birth_date: '2000-01-01', seniority_years: 12 }).reasons).toContain('retiree_age')
  })
  it('pareja y adulto responsable', () => {
    expect(checkEligibility({ code: 'parella', needs_pair: true }, { birth_date: '1990-01-01' }).reasons).toEqual(['pair'])
    expect(checkEligibility({ code: 'adherit', needs_adult_link: true }, { birth_date: '2015-01-01', has_adult_link: true }).ok).toBe(true)
  })
  it('cambios automáticos de categoría', () => {
    expect(nextAutoType('adherit', '2008-01-01', new Date('2026-10-16'))).toBe('jove')
    expect(nextAutoType('jove', '2002-01-01', new Date('2026-10-16'))).toBe('individual')
    expect(nextAutoType('individual', '1980-01-01')).toBeNull()
  })
  it('hogar: solo se factura al titular y la entrada no aplica a menores', () => {
    expect(householdFeeCents([{ code: 'familiar', annual_fee_cents: 11300, billable: true }, { code: 'adherit', annual_fee_cents: 0, billable: false }])).toBe(11300)
    expect(entryFeeCents('adherit', 10500)).toBe(0)
    expect(entryFeeCents('individual', 10500)).toBe(10500)
  })
})

describe('access', () => {
  const ar: AccessRule[] = [
    { zone_code: 'sala', audience: 'member', weekdays: [1, 2, 3, 4, 5], time_from: '07:00', time_to: '22:00', allow: true },
    { zone_code: 'piscina', audience: 'member', weekdays: [0, 1, 2, 3, 4, 5, 6], time_from: '09:00', time_to: '21:00', season_from: '2026-06-01', season_to: '2026-09-15', allow: true },
    { zone_code: 'pistes', audience: 'non_member', weekdays: [0, 1, 2, 3, 4, 5, 6], requires_booking: true, allow: true },
  ]
  const socio = { active: true, is_member: true, has_debt: false }
  it('socio en horario entra', () => expect(evaluateAccess(ar, 'sala', socio, at('10:00')).reason).toBe('ok'))
  it('fuera de horario', () => expect(evaluateAccess(ar, 'sala', socio, at('23:00')).reason).toBe('closed'))
  it('fuera de temporada (piscina en octubre)', () => expect(evaluateAccess(ar, 'piscina', socio, at('12:00')).allowed).toBe(false))
  it('deuda bloquea', () => expect(evaluateAccess(ar, 'sala', { ...socio, has_debt: true }, at('10:00')).reason).toBe('debt'))
  it('no socio necesita reserva', () => {
    const ns = { active: true, is_member: false, has_debt: false }
    expect(evaluateAccess(ar, 'pistes', ns, at('10:00')).reason).toBe('needs_booking')
    expect(evaluateAccess(ar, 'pistes', { ...ns, has_booking_now: true }, at('10:00')).allowed).toBe(true)
  })
  it('aforo completo', () => expect(evaluateAccess(ar, 'sala', socio, at('10:00'), { current: 40, capacity: 40 }).reason).toBe('capacity'))
})

describe('qr', () => {
  it('token válido, caducado y manipulado', async () => {
    const t = await makeCardToken('s3cret', 'p1', 1_000_000_000)
    expect(await verifyCardToken('s3cret', t, 1_000_000_000 + 30_000)).toBe('p1')
    expect(await verifyCardToken('s3cret', t, 1_000_000_000 + 300_000)).toBeNull()
    expect(await verifyCardToken('otro', t, 1_000_000_000)).toBeNull()
  })
})

describe('sepa', () => {
  const iban = 'ES9121000418450200051332'
  it('valida IBAN', () => {
    expect(validIban(iban)).toBe(true)
    expect(validIban('ES9121000418450200051333')).toBe(false)
  })
  it('genera pain.008 con totales correctos', () => {
    const xml = buildPain008({
      msgId: 'CPS-2027-01', collectionDate: '2027-01-15', now: new Date('2026-12-20T10:00:00Z'),
      creditor: { name: 'Club Poliesportiu Santjoanenc', iban, creditorId: 'ES12000G00000000' },
      items: [
        { endToEndId: 'F-1', amountCents: 8700, debtorName: 'Joan Pérez & Fill', debtorIban: iban, mandateId: 'M1', mandateDate: '2024-01-10', concept: 'Quota 2027' },
        { endToEndId: 'F-2', amountCents: 11300, debtorName: 'Maria Soler', debtorIban: iban, mandateId: 'M2', mandateDate: '2024-02-10', concept: 'Quota 2027' },
      ],
    })
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>')
    expect(xml).toContain('<CtrlSum>200.00</CtrlSum>')
    expect(xml).not.toContain('&amp;')
    expect(() => buildPain008({ msgId: 'x', collectionDate: '2027-01-15', creditor: { name: 'a', iban, creditorId: 'x' }, items: [] })).toThrow()
  })
})
