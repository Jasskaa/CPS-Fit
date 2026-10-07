import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadRoutinePayload } from '@/lib/routines'
import { RoutineEditor } from '@/components/routine-editor'
import type { Exercise } from '@/lib/types'
import { saveAdminRoutine } from '../actions'
import { AssignMany } from './assign-many'

export default async function RoutineEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const supabase = await createClient()
  const loaded = await loadRoutinePayload(supabase, id)
  if (!loaded) notFound()
  const [{ data: library }, { data: members }, { data: owner }, { count }] = await Promise.all([
    supabase.from('exercises').select('*').order('name_ca'),
    supabase.from('profiles').select('id, full_name').eq('role', 'member').eq('status', 'active').order('full_name'),
    loaded.routine.owner_id ? supabase.from('profiles').select('full_name').eq('id', loaded.routine.owner_id).single() : Promise.resolve({ data: null }),
    supabase.from('routine_assignments').select('id', { count: 'exact', head: true }).eq('routine_id', id).eq('status', 'active'),
  ])

  return (
    <div className="space-y-5">
      <Link href="/admin/rutines" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text"><ArrowLeft size={16} aria-hidden /> {t('admin.nav.routines')}</Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-muted">
          {loaded.routine.is_template ? t('admin.routines.templateLabel') : owner ? t('admin.routines.ofMember', { name: owner.full_name }) : t('admin.nav.routines')} · v{loaded.routine.version}
        </p>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{loaded.routine.name}</h1>
        {Boolean(count) && <p className="mt-1 text-sm text-muted">{t('admin.routines.activeAssignments', { n: count ?? 0 })}</p>}
      </header>

      <RoutineEditor mode="trainer" canVersion initial={loaded.payload} library={(library ?? []) as Exercise[]} onSave={saveAdminRoutine} />

      {loaded.routine.is_template && <AssignMany routineId={id} defaultWeeks={Number(loaded.routine.duration_weeks ?? 6)} members={members ?? []} />}
    </div>
  )
}
