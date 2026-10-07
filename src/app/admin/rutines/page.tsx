import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Archive, ArchiveRestore, Copy, Pencil, Plus } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui'
import { createTemplate, duplicateRoutineAction, setArchived } from './actions'

export const metadata = { title: 'Rutines' }

export default async function RoutinesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'templates' } = await searchParams
  await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()

  let q = supabase.from('routines').select('id, name, goal, duration_weeks, version, updated_at, owner_id, archived, is_template, routine_days(id), owner:profiles!routines_owner_id_fkey(full_name)').order('updated_at', { ascending: false })
  if (tab === 'templates') q = q.eq('is_template', true).eq('archived', false)
  else if (tab === 'members') q = q.eq('is_template', false).eq('archived', false).not('owner_id', 'is', null)
  else q = q.eq('archived', true)
  const { data } = await q.limit(200)
  const rows = (data ?? []) as unknown as { id: string; name: string; goal: string | null; duration_weeks: number | null; version: number; updated_at: string; owner: { full_name: string } | null; archived: boolean; routine_days: unknown[] }[]

  const tabs = [['templates', t('admin.routines.templates')], ['members', t('admin.routines.members')], ['archived', t('admin.routines.archived')]] as const

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('admin.nav.routines')}</h1>
        <form action={createTemplate} className="flex gap-2">
          <label className="sr-only" htmlFor="tpl-name">{t('editor.name')}</label>
          <input id="tpl-name" name="name" className="input w-52" placeholder={t('admin.routines.newPlaceholder')} />
          <button className="btn btn-primary"><Plus size={18} aria-hidden /> {t('admin.routines.newTemplate')}</button>
        </form>
      </header>

      <div role="tablist" className="flex gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} role="tab" aria-selected={tab === k} href={`/admin/rutines?tab=${k}`} className={`btn !min-h-11 ${tab === k ? 'btn-primary' : 'btn-ghost'}`}>{label}</Link>
        ))}
      </div>

      {rows.length === 0 ? <EmptyState title={t('admin.routines.empty')} /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/rutines/${r.id}`} className="font-display text-2xl font-bold leading-tight hover:text-primary-text">{r.name}</Link>
                <span className="chip">v{r.version}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{r.owner ? `${r.owner.full_name} · ` : ''}{r.goal ?? '—'}</p>
              <p className="mt-1 text-xs text-muted tnum">{t('member.dayCount', { n: r.routine_days.length })}{r.duration_weeks ? ` · ${t('routine.weeks', { n: r.duration_weeks })}` : ''} · {new Date(r.updated_at).toLocaleDateString(locale)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/admin/rutines/${r.id}`} className="btn btn-ghost !min-h-11 text-sm"><Pencil size={15} aria-hidden /> {t('common.edit')}</Link>
                <form action={duplicateRoutineAction.bind(null, r.id)}><button className="btn btn-ghost !min-h-11 text-sm"><Copy size={15} aria-hidden /> {t('member.duplicate')}</button></form>
                <form action={setArchived.bind(null, r.id, !r.archived)}>
                  <button className="btn btn-ghost !min-h-11 text-sm">{r.archived ? <ArchiveRestore size={15} aria-hidden /> : <Archive size={15} aria-hidden />} {r.archived ? t('admin.routines.restore') : t('admin.routines.archive')}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
