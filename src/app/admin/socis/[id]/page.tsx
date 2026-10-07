import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { AlertTriangle, ArrowLeft, Pencil } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadProgressData } from '@/lib/progress-data'
import { adherence } from '@/lib/training'
import type { CommentRow, MemberDetails, Profile } from '@/lib/types'
import { ProgressView } from '@/app/app/progres/progress-view'
import { CommentThread } from '@/app/app/comment-thread'
import { AssignForm, NotesForm, StatusSelect } from './member-controls'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()

  const { data: member } = await supabase.from('profiles').select('*').eq('id', id).eq('role', 'member').maybeSingle<Profile>()
  if (!member) notFound()

  const [{ data: details }, { data: assignment }, { data: templates }, { data: comments }, { data: authors }, progress] = await Promise.all([
    supabase.from('member_details').select('*').eq('member_id', id).single<MemberDetails>(),
    supabase.from('routine_assignments').select('id, routine_id, start_date, end_date, routines(name, duration_weeks)').eq('member_id', id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('routines').select('id, name, duration_weeks').eq('is_template', true).eq('archived', false).order('name'),
    supabase.from('comments').select('*').eq('member_id', id).order('created_at'),
    supabase.from('profiles').select('id, full_name'),
    loadProgressData(supabase, id, locale),
  ])
  const names = Object.fromEntries((authors ?? []).map((a) => [a.id, a.full_name]))
  const act = assignment as unknown as { id: string; routine_id: string; start_date: string; end_date: string | null; routines: { name: string; duration_weeks: number | null } | null } | null

  const month = progress.sessions.filter((s) => Date.now() - new Date(s.started_at).getTime() < 30 * 86400000).length
  const adh = act && details ? adherence(progress.sessions.filter((s) => new Date(s.started_at) >= new Date(act.start_date)).length, details.days_per_week ?? 3, new Date(act.start_date)) : null
  const lastAt = progress.sessions[0]?.started_at

  return (
    <div className="space-y-6">
      <Link href="/admin/socis" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text"><ArrowLeft size={16} aria-hidden /> {t('admin.nav.members')}</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{member.full_name}</h1>
          <p className="mt-1 text-sm text-muted">{member.email} · {t('admin.member.since', { date: new Date(details?.joined_at ?? member.created_at).toLocaleDateString(locale) })}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {details?.goal && <span className="chip chip-primary">{details.goal}</span>}
            {details && <span className="chip">{t(`profile.levels.${details.level}`)}</span>}
            {details?.days_per_week && <span className="chip">{t('admin.member.daysWeek', { n: details.days_per_week })}</span>}
          </div>
        </div>
        <StatusSelect memberId={id} status={member.status} />
      </header>

      {details?.limitations && (
        <p role="note" className="flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-sm font-medium"><AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden /> <span><strong>{t('admin.member.limitations')}:</strong> {details.limitations}</span></p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-muted">{t('admin.member.last30')}</p><p className="font-display text-4xl font-extrabold tnum">{month}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-muted">{t('admin.member.adherence')}</p><p className="font-display text-4xl font-extrabold tnum">{adh === null ? '—' : `${adh}%`}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-muted">{t('admin.member.lastWorkout')}</p><p className="font-display text-2xl font-extrabold">{lastAt ? new Date(lastAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '—'}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-muted">{t('admin.member.records')}</p><p className="font-display text-4xl font-extrabold tnum">{progress.prs.length}</p></div>
      </section>

      <section className="card space-y-4 p-4" aria-labelledby="routine">
        <h2 id="routine" className="font-display text-2xl font-bold">{t('admin.member.activeRoutine')}</h2>
        {act ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-3xl font-bold">{act.routines?.name}</p>
              <p className="text-sm text-muted tnum">{new Date(act.start_date).toLocaleDateString(locale)} → {act.end_date ? new Date(act.end_date).toLocaleDateString(locale) : '—'}</p>
            </div>
            <Link href={`/admin/rutines/${act.routine_id}`} className="btn btn-ghost"><Pencil size={16} aria-hidden /> {t('admin.member.editRoutine')}</Link>
          </div>
        ) : <p className="text-sm text-muted">{t('admin.member.noRoutine')}</p>}
        <AssignForm memberId={id} templates={templates ?? []} />
      </section>

      <ProgressView readOnly memberId={id} units={member.units} locale={locale} title={t('admin.member.progress')} {...progress} />

      <section className="card p-4" aria-labelledby="notes">
        <h2 id="notes" className="font-display text-2xl font-bold">{t('admin.member.notes')}</h2>
        <NotesForm memberId={id} goal={details?.goal ?? ''} limitations={details?.limitations ?? ''} notes={details?.trainer_notes ?? ''} />
      </section>

      <section id="comentaris" aria-labelledby="comments" className="scroll-mt-6">
        <h2 id="comments" className="mb-2 font-display text-2xl font-bold">{t('admin.member.comments')}</h2>
        <CommentThread memberId={id} currentUserId={userId} comments={(comments ?? []) as CommentRow[]} names={names} />
      </section>
    </div>
  )
}
