import { getTranslations } from 'next-intl/server'
import { CalendarCheck, Clock, ExternalLink, Globe, Mail, MapPin, Phone, UserCheck } from 'lucide-react'
import { CLUB, GYM } from '@/lib/config'

export const metadata = { title: 'El club' }

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export default async function ClubPage() {
  const t = await getTranslations()
  const now = new Date()
  const today = GYM.hours.find((h) => h.days.includes(now.getDay()))
  const minutes = now.getHours() * 60 + now.getMinutes()
  const open = Boolean(today && minutes >= toMin(today.open) && minutes < toMin(today.close))
  const trainerOn = open && GYM.trainerHours.some((h) => minutes >= toMin(h.from) && minutes < toMin(h.to)) && now.getDay() !== 0
  const rules = ['towel', 'shoes', 'clean', 'weights', 'bag', 'phone'] as const
  const days = [
    { label: t('club.monFri'), h: GYM.hours[0] },
    { label: t('club.sat'), h: GYM.hours[1] },
    { label: t('club.sunHol'), h: GYM.hours[2] },
  ]

  return (
    <div className="space-y-4">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('club.title')}</h1>

      <section className="card animate-rise flex items-center gap-4 p-4">
        <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${open ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}><Clock size={26} aria-hidden /></span>
        <div>
          <p className="font-display text-3xl font-extrabold uppercase leading-none">{open ? t('club.openNow') : t('club.closedNow')}</p>
          <p className="mt-1 text-sm text-muted">
            {today ? `${today.open}–${today.close}` : ''} · {trainerOn ? t('club.trainerPresent') : t('club.trainerAbsent')}
          </p>
        </div>
      </section>

      <section className="card p-4" aria-labelledby="hours">
        <h2 id="hours" className="font-display text-2xl font-bold">{t('club.hours')}</h2>
        <dl className="mt-2 divide-y divide-border">
          {days.map(({ label, h }) => (
            <div key={label} className="flex justify-between py-2.5 text-sm"><dt className="text-muted">{label}</dt><dd className="font-semibold tnum">{h.open}–{h.close}</dd></div>
          ))}
        </dl>
        <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm"><UserCheck size={16} className="text-primary-text" aria-hidden /> {t('club.trainerHours')}: <strong className="tnum">{GYM.trainerHours.map((h) => `${h.from.slice(0, 2).replace(/^0/, '')}–${h.to.slice(0, 2)}h`).join(' · ')}</strong></p>
        <p className="mt-2 text-xs text-muted">{t('club.rooms', { a: GYM.rooms.weight, b: GYM.rooms.classes })}</p>
      </section>

      <section className="card p-4" aria-labelledby="rules">
        <h2 id="rules" className="font-display text-2xl font-bold">{t('club.rules')}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted marker:text-primary-text">
          {rules.map((r) => <li key={r}>{t(`club.rule.${r}`)}</li>)}
        </ul>
        <p className="mt-2 text-xs text-muted">{t('club.rulesDraft')}</p>
      </section>

      <section className="card divide-y divide-border" aria-labelledby="contact">
        <h2 id="contact" className="px-4 pt-4 font-display text-2xl font-bold">{t('club.contact')}</h2>
        <a className="flex min-h-14 items-center gap-3 px-4 text-sm" href={`https://maps.google.com/?q=${encodeURIComponent(CLUB.address)}`} target="_blank" rel="noreferrer"><MapPin size={18} className="text-primary-text" aria-hidden /> {CLUB.address}</a>
        {CLUB.phones.map((p) => <a key={p} className="flex min-h-14 items-center gap-3 px-4 text-sm tnum" href={`tel:${p.replace(/\s/g, '')}`}><Phone size={18} className="text-primary-text" aria-hidden /> {p}</a>)}
        <a className="flex min-h-14 items-center gap-3 px-4 text-sm" href={`mailto:${CLUB.email}`}><Mail size={18} className="text-primary-text" aria-hidden /> {CLUB.email}</a>
        <a className="flex min-h-14 items-center gap-3 px-4 text-sm" href={CLUB.website} target="_blank" rel="noreferrer"><Globe size={18} className="text-primary-text" aria-hidden /> {t('club.website')} <ExternalLink size={13} className="ml-auto text-muted" aria-hidden /></a>
      </section>

      <a href={CLUB.bookingUrl} target="_blank" rel="noreferrer" className="btn btn-accent btn-lg w-full">
        <CalendarCheck aria-hidden /> {t('club.bookings')} <ExternalLink size={16} aria-hidden />
      </a>
      <p className="px-2 text-center text-xs text-muted">{t('club.bookingsHint')}</p>
    </div>
  )
}
