import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ChevronDown, ClipboardList, Dumbbell, Pencil, Play } from 'lucide-react'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { buildSnapshot } from '@/lib/snapshot'
import { targetLabel } from '@/lib/training'
import { EmptyState } from '@/components/ui'
import type { CommentRow } from '@/lib/types'
import { SnapshotSaver } from '../snapshot-saver'
import { CommentThread } from '../comment-thread'

export const metadata = { title: 'La meva rutina' }

export default async function RoutinePage() {
  const { profile, userId } = (await getSessionProfile())!
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()
  const snap = await buildSnapshot(supabase, userId, locale, profile.units)
  const routine = snap.routine

  if (!routine) {
    return (
      <EmptyState
        icon={<ClipboardList size={30} />}
        title={t('member.noRoutineTitle')}
        hint={t('member.noRoutineHint')}
        action={<Link href="/app/rutines" className="btn btn-primary">{t('member.createRoutine')}</Link>}
      />
    )
  }

  const [{ data: comments }, { data: authors }] = await Promise.all([
    supabase.from('comments').select('*').eq('member_id', userId).order('created_at'),
    supabase.from('profiles').select('id, full_name, role'),
  ])
  const names = Object.fromEntries((authors ?? []).map((a) => [a.id, a.full_name]))

  return (
    <div className="space-y-5">
      <SnapshotSaver snapshot={snap} />
      <header className="animate-rise">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{t('routine.active')}</p>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{routine.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {routine.weeks ? t('routine.weeks', { n: routine.weeks }) : null}
          {routine.endDate ? ` · ${t('routine.until', { date: new Date(routine.endDate).toLocaleDateString(locale) })}` : null}
        </p>
        <Link href="/app/rutines" className="btn btn-ghost mt-3 !min-h-11 text-sm"><Pencil size={15} aria-hidden /> {t('routine.myRoutines')}</Link>
      </header>

      <div className="space-y-3">
        {routine.days.map((d, i) => (
          <details key={d.id} open={d.id === snap.nextDayId} className="card group animate-rise overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-display block text-3xl font-extrabold uppercase leading-none">{d.name}</span>
                <span className="text-xs text-muted">{t('member.exerciseCount', { n: d.exercises.length })}{d.id === snap.nextDayId ? ` · ${t('routine.next')}` : ''}</span>
              </span>
              <ChevronDown className="transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="divide-y divide-border border-t border-border">
              {d.exercises.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text"><Dumbbell size={15} aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-sm text-muted tnum">{e.sets} × {targetLabel(e)} · {t('routine.rest')} {e.rest_sec}s{e.target_weight ? ` · ${e.target_weight} kg` : ''}</p>
                    {e.notes && <p className="mt-1 rounded-lg bg-warn-soft px-2 py-1 text-xs font-medium">{e.notes}</p>}
                    {e.tips && <p className="mt-1 text-xs text-muted">{e.tips}</p>}
                  </div>
                  {e.media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.media_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
                  )}
                </li>
              ))}
            </ol>
            <div className="border-t border-border p-3">
              <Link href={`/app/entreno#${d.id}`} className="btn btn-primary w-full"><Play size={16} fill="currentColor" aria-hidden /> {t('member.startWorkout')}</Link>
            </div>
          </details>
        ))}
      </div>

      <section aria-labelledby="doubts">
        <h2 id="doubts" className="font-display mb-2 text-2xl font-bold">{t('routine.doubts')}</h2>
        <CommentThread memberId={userId} routineId={routine.id} currentUserId={userId} comments={(comments ?? []) as CommentRow[]} names={names} />
      </section>
    </div>
  )
}
