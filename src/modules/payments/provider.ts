// Interfaz de pasarela de pago. El club arranca con SimulatedProvider (sin coste ni claves reales);
// para producción basta implementar esta interfaz con Stripe/Redsys y cambiar `paymentProvider`.
export interface ChargeInput { invoiceId: string; personId: string; amountCents: number; method: 'card' | 'transfer' | 'simulated' }
export interface ChargeResult { ok: boolean; ref: string; status: 'succeeded' | 'failed'; provider: string; error?: string }

export interface PaymentProvider {
  readonly name: string
  charge(input: ChargeInput): Promise<ChargeResult>
  refund(ref: string, amountCents: number): Promise<{ ok: boolean; ref: string }>
}

/** Pasarela simulada: aprueba siempre salvo importes terminados en 13 céntimos (para probar fallos). */
export class SimulatedProvider implements PaymentProvider {
  readonly name = 'simulated'
  async charge(i: ChargeInput): Promise<ChargeResult> {
    const ref = `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    if (i.amountCents % 100 === 13) return { ok: false, ref, status: 'failed', provider: this.name, error: 'card_declined' }
    return { ok: true, ref, status: 'succeeded', provider: this.name }
  }
  async refund(ref: string) { return { ok: true, ref: `${ref}_re` } }
}

export const paymentProvider: PaymentProvider = new SimulatedProvider()
