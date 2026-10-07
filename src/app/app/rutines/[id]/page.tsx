import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadRoutinePayload } from '@/lib/routines'
import { RoutineEditor } from '@/components/routine-editor'
import type { Exercise } from '@/lib/types'
import { deleteOwnRoutine, saveOwnRoutine } from '../actions'

export default async function EditOwnRoutine({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = (await getSessionProfile())!
  const t = await getTranslations()
  const supabase = await createClient()
  const loaded = await loadRoutinePayload(supabase, id)
  if (!loaded || loaded.routine.owner_id !== userId) notFound()
  const { data: library } = await supabase.from('exercises').select('*').order('name_ca')

  return (
    <div className="space-y-4">
      <Link href="/app/rutines" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text"><ArrowLeft size={16} aria-hidden /> {t('common.back')}</Link>
      <RoutineEditor mode="member" initial={loaded.payload} library={(library ?? []) as Exercise[]} onSave={saveOwnRoutine} />
      <form action={deleteOwnRoutine.bind(null, id)} className="pt-4">
        <button className="btn btn-danger"><Trash2 size={16} aria-hidden /> {t('member.deleteRoutine')}</button>
      </form>
    </div>
  )
}
