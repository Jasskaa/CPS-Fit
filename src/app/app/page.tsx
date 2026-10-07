import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Dumbbell, Flame, Megaphone, Pin, Play } from 'lucide-react'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { buildSnapshot } from '@/lib/snapshot'
import { startOfWeek, volume, weeklyStreak } from '@/lib/training'
import type { Announcement } from '@/lib/types'
import { EmptyState } from '@/components/ui'
import { SnapshotSaver } from './snapshot-saver'

export default async function MemberHome() {
  const session = (await getSessionProfile())!
  const { profile, userId } = session
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - 7 * 14)
  const [snapshot, sessionsRes, annRes, detailsRes] = await Promise.all([
    buildSnapshot(supabase, userId, locale, profile.units),
    supabase.from('workout_sessions').select('id, started_at').eq('member_id', userId).gte('started_at', since.toISOString()).order('started_at', { ascending: false }),
    supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('starts_at', { ascending: false }).limit(3),
    supabase.from('member_details').select('days_per_week, goal').eq('member_id', userId).single(),
  ])

  if (detailsRes.data && !detailsRes.data.goal) redirect('/app/onboarding')
  const sessions = sessionsRes.data ?? []
  const weekStart = startOfWeek(new Date())
  const thisWeek = sessions.filter((s) => new Date(s.started_at) >= weekStart)
  let weekVolume = 0
  if (thisWeek.length) {
    const { data: sets } = await supabase.from('workout_sets').select('weight, reps, completed').in('session_id', thisWeek.map((s) => s.id))
    weekVolume = volume(sets ?? [])
  }
  const streak = weeklyStreak(sessions.map((s) => s.started_at))
  const target = detailsRes.data?.days_per_week ?? 3
  const day = snapshot.routine?.days.find((d) => d.id === snapshot.nextDayId) ?? null
  const announcements = (annRes.data ?? []) as Announcement[]
  const hour = new Date().getHours()
  const greeting = hour < 13 ? 'greetMorning' : hour < 20 ? 'greetAfternoon' : 'greetEvening'
  const unit = profile.units
  const shownVolume = unit === 'lb' ? Math.round(weekVolume * 2.20462) : weekVolume

  return (
    <div className="space-y-5">
      <SnapshotSaver snapshot={snapshot} />
      <section className="animate-rise">
        <p className="text-sm font-semibold text-muted">{t(`member.${greeting}`)}</p>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{profile.full_name.split(' ')[0]}</h1>
      </section>

      {day && snapshot.routine ? (
        <section className="animate-rise overflow-hidden rounded-3xl bg-primary p-5 text-primary-fg shadow-card" style={{ animationDelay: '60ms' }}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">{t('member.todaySession')}</p>
          <h2 className="font-display mt-1 text-4xl font-extrabold uppercase leading-none">{day.name}</h2>
          <p className="mt-1 text-sm opacity-90">{snapshot.routine.name} · {t('member.exerciseCount', { n: day.exercises.length })}</p>
          <ul className="mt-3 space-y-1 text-sm opacity-95">
            {day.exercises.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-2"><Dumbbell size={14} aria-hidden /> {e.name}</li>
            ))}
            {day.exercises.length > 3 && <li className="pl-6 opacity-80">+{day.exercises.length - 3}</li>}
          </ul>
          <Link href={`/app/entreno#${day.id}`} className="btn btn-accent btn-lg mt-5 w-full text-xl uppercase">
            <Play size={22} fill="currentColor" aria-hidden /> {t('member.startWorkout')}
          </Link>
        </section>
      ) : (
        <EmptyState
          icon={<Dumbbell size={30} />}
          title={t('member.noRoutineTitle')}
          hint={t('member.noRoutineHint')}
          action={<Link href="/app/rutines" className="btn btn-primary">{t('member.createRoutine')}</Link>}
        />
      )}

      <section className="grid grid-cols-2 gap-3" aria-label={t('member.weekSummary')}>
        <div className="card animate-rise p-4" style={{ animationDelay: '120ms' }}>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Flame size={14} className="text-danger" aria-hidden /> {t('member.streak')}</p>
          <p className="font-display mt-1 text-5xl font-extrabold tnum">{streak}</p>
          <p className="text-xs text-muted">{t('member.weeksInRow', { n: streak })}</p>
        </div>
        <div className="card animate-rise p-4" style={{ animationDelay: '160ms' }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('member.thisWeek')}</p>
          <p className="font-display mt-1 text-5xl font-extrabold tnum">{thisWeek.length}<span className="text-2xl text-muted">/{target}</span></p>
          <p className="text-xs text-muted tnum">{shownVolume.toLocaleString(locale)} {unit}</p>
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: target }).map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < thisWeek.length ? 'bg-accent' : 'bg-surface-2'}`} style={i < thisWeek.length ? { boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .15)' } : undefined} />
            ))}
          </div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section aria-labelledby="ann">
          <h2 id="ann" className="mb-2 flex items-center gap-2 font-display text-2xl font-bold"><Megaphone size={20} aria-hidden /> {t('member.announcements')}</h2>
          <ul className="space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="card p-4">
                <p className="flex items-center gap-1.5 font-semibold">
                  {a.pinned && <Pin size={14} className="text-primary-text" aria-label={t('member.pinned')} />}
                  {locale === 'es' ? (a.title_es ?? a.title_ca) : a.title_ca}
                </p>
                <p className="mt-0.5 text-sm text-muted">{locale === 'es' ? (a.body_es ?? a.body_ca) : a.body_ca}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
