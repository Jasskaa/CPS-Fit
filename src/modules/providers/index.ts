// Adaptadores externos del club. Cada interfaz tiene una implementación simulada lista para sustituir.
export type { PaymentProvider } from '@/modules/payments/provider'

/** Control de accesos físico (tornos, lectores). Hoy la recepción valida por QR; un torno real implementaría esto. */
export interface AccessControlProvider {
  readonly name: string
  open(zoneCode: string): Promise<void>
}
export class SimulatedAccessControl implements AccessControlProvider {
  readonly name = 'simulated'
  async open() { /* en producción: pulso al relé del torno */ }
}

/** Reservas externas (p. ej. Poliwin, que usa hoy el club). Permite importar/exportar sin acoplarse. */
export interface BookingProvider {
  readonly name: string
  pullBookings(from: Date, to: Date): Promise<{ externalId: string; resource: string; startsAt: string; endsAt: string; person?: string }[]>
}
export class SimulatedBookingProvider implements BookingProvider {
  readonly name = 'simulated'
  async pullBookings() { return [] }
}

/** Mensajería (correo, push, WhatsApp). La simulada escribe en la tabla `notifications`. */
export interface NotificationProvider {
  readonly name: string
  send(personId: string, title: string, body: string, url?: string): Promise<void>
}

/** Contabilidad externa (A3, Holded…): exporta asientos agregados. */
export interface AccountingExporter {
  readonly name: string
  export(rows: { date: string; account: string; debit: number; credit: number; concept: string }[]): Promise<string>
}
