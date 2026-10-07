import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ChevronRight, Search } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hasServiceRole } from '@/lib/supabase/admin'
import { EmptyState } from '@/components/ui'
import { InviteMember } from './invite-member'

export const metadata = { title: 'Socis' }

const STATUS_TONE: Record<string, string> = { active: 'chip-success', pending: 'chip-warn', paused: '', inactive: 'chip-danger' }

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams
  const { profile } = await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()

  let query = supabase.from('profiles').select('id, full_name, email, status, member_details(goal, level), routine_assignments(status, routines(name))').eq('role', 'member').order('full_name')
  if (sp.q) query = query.or(`full_name.ilike.%${sp.q.replace(/[%,()]/g, '')}%,email.ilike.%${sp.q.replace(/[%,()]/g, '')}%`)
  if (sp.status) query = query.eq('status', sp.status)
  const { data: members } = await query

  const ids = (members ?? []).map((m) => m.id)
  const { data: last } = ids.length
    ? await supabase.from('workout_sessions').select('member_id, started_at').in('member_id', ids).order('started_at', { ascending: false }).limit(1000)
    : { data: [] }
  const lastBy = new Map<string, string>()
  last?.forEach((s) => { if (!lastBy.has(s.member_id)) lastBy.set(s.member_id, s.started_at) })

  const statuses = ['', 'active', 'pending', 'paused', 'inactive']

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('admin.nav.members')}</h1>
          <p className="mt-1 text-muted">{t('admin.members.count', { n: members?.length ?? 0 })}</p>
        </div>
        <InviteMember canInvite={hasServiceRole()} isAdmin={profile.role === 'admin'} />
      </header>

      <form className="card flex flex-wrap items-end gap-3 p-3" role="search">
        <div className="relative min-w-52 flex-1">
          <label htmlFor="q" className="sr-only">{t('common.search')}</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input id="q" name="q" defaultValue={sp.q} className="input !pl-9" placeholder={t('admin.members.searchPlaceholder')} />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">{t('admin.members.status')}</label>
          <select id="status" name="status" defaultValue={sp.status ?? ''} className="input">
            {statuses.map((s) => <option key={s} value={s}>{s ? t(`status.${s}`) : t('admin.members.allStatuses')}</option>)}
          </select>
        </div>
        <button className="btn btn-primary">{t('common.filter')}</button>
      </form>

      {(members ?? []).length === 0 ? (
        <EmptyState title={t('admin.members.empty')} hint={t('admin.members.emptyHint')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">{t('admin.members.name')}</th>
                <th scope="col" className="px-4 py-3">{t('admin.members.goal')}</th>
                <th scope="col" className="px-4 py-3">{t('admin.members.routine')}</th>
                <th scope="col" className="px-4 py-3">{t('admin.members.lastWorkout')}</th>
                <th scope="col" className="px-4 py-3">{t('admin.members.status')}</th>
                <th scope="col" className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(members ?? []).map((m) => {
                const details = Array.isArray(m.member_details) ? m.member_details[0] : m.member_details
                const act = (m.routine_assignments as unknown as { status: string; routines: { name: string } | null }[] | null)?.find((a) => a.status === 'active')
                const lastAt = lastBy.get(m.id)
                const days = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000) : null
                return (
                  <tr key={m.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3"><Link href={`/admin/socis/${m.id}`} className="font-semibold after:absolute after:inset-0 hover:text-primary-text">{m.full_name}</Link><span className="block text-xs text-muted">{m.email}</span></td>
                    <td className="px-4 py-3 text-muted">{details?.goal ?? '—'}</td>
                    <td className="px-4 py-3">{act?.routines?.name ?? <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3 tnum">{days === null ? <span className="text-muted">—</span> : days === 0 ? t('admin.members.today') : <span className={days >= 7 ? 'font-semibold text-danger' : ''}>{t('admin.dashboard.daysAgo', { n: days })}</span>}{lastAt && <span className="block text-xs text-muted">{new Date(lastAt).toLocaleDateString(locale)}</span>}</td>
                    <td className="px-4 py-3"><span className={`chip ${STATUS_TONE[m.status]}`}>{t(`status.${m.status}`)}</span></td>
                    <td className="relative px-2"><ChevronRight size={18} className="text-muted" aria-hidden /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
