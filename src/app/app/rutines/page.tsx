import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Check, Copy, Plus, UserCheck } from 'lucide-react'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { activateRoutine, createOwnRoutine, duplicateAsOwn } from './actions'

export const metadata = { title: 'Les meves rutines' }

export default async function MyRoutinesPage() {
  const { userId } = (await getSessionProfile())!
  const t = await getTranslations()
  const supabase = await createClient()
  const [{ data: routines }, { data: active }] = await Promise.all([
    supabase.from('routines').select('id, name, created_by, routine_days(id)').eq('owner_id', userId).eq('archived', false).order('created_at', { ascending: false }),
    supabase.from('routine_assignments').select('routine_id').eq('member_id', userId).eq('status', 'active').limit(1).maybeSingle(),
  ])

  return (
    <div className="space-y-5">
      <Link href="/app/rutina" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text"><ArrowLeft size={16} aria-hidden /> {t('common.back')}</Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('member.myRoutines')}</h1>

      <form action={createOwnRoutine} className="card flex gap-2 p-3">
        <label htmlFor="new-name" className="sr-only">{t('editor.name')}</label>
        <input id="new-name" name="name" className="input" placeholder={t('member.newRoutinePlaceholder')} maxLength={80} />
        <button className="btn btn-primary shrink-0"><Plus size={18} aria-hidden /> {t('member.create')}</button>
      </form>

      <ul className="space-y-3">
        {(routines ?? []).map((r) => {
          const isActive = active?.routine_id === r.id
          const byTrainer = r.created_by !== userId
          return (
            <li key={r.id} className={`card p-4 ${isActive ? 'border-primary' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display truncate text-2xl font-bold">{r.name}</p>
                  <p className="text-xs text-muted">{t('member.dayCount', { n: r.routine_days?.length ?? 0 })}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isActive && <span className="chip chip-success"><Check size={12} aria-hidden /> {t('member.activeRoutine')}</span>}
                  {byTrainer && <span className="chip chip-primary"><UserCheck size={12} aria-hidden /> {t('member.fromTrainer')}</span>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/app/rutines/${r.id}`} className="btn btn-ghost !min-h-11 text-sm">{t('common.edit')}</Link>
                {!isActive && (
                  <form action={activateRoutine.bind(null, r.id)}>
                    <button className="btn btn-primary !min-h-11 text-sm">{t('member.makeActive')}</button>
                  </form>
                )}
                <form action={duplicateAsOwn.bind(null, r.id)}>
                  <button className="btn btn-ghost !min-h-11 text-sm"><Copy size={15} aria-hidden /> {t('member.duplicate')}</button>
                </form>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
