// Marca y datos del club. Cambia APP_NAME aquí para renombrar la app en todas partes.
export const APP_NAME = 'CPS Fit'
export const APP_TAGLINE = { ca: 'El teu entrenament, al teu club.', es: 'Tu entrenamiento, en tu club.' }

export const CLUB = {
  name: 'Club Poliesportiu Santjoanenc',
  shortName: 'C.P. Santjoanenc',
  address: 'C/ Paperera Torras, 2, 17857 Sant Joan les Fonts',
  email: 'info@cpsantjoanenc.org',
  phones: ['972 29 22 37', '621 204 722'],
  website: 'https://www.cpsantjoanenc.org',
  bookingUrl: 'https://cpsantjoanenc.poliwincloud.com/cat#ModCont',
}

export const GYM = {
  rooms: { weight: 120, classes: 60 },
  // 0 = diumenge ... 6 = dissabte
  hours: [
    { days: [1, 2, 3, 4, 5], open: '07:00', close: '21:30' },
    { days: [6], open: '08:00', close: '20:00' },
    { days: [0], open: '08:00', close: '14:00' },
  ],
  trainerHours: [
    { from: '08:00', to: '12:00' },
    { from: '17:00', to: '21:00' },
  ],
}

export const LOCALES = ['ca', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ca'
export const LOCALE_COOKIE = 'NEXT_LOCALE'
