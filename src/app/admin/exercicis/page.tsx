import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Exercise } from '@/lib/types'
import { ExerciseManager } from './exercise-manager'

export const metadata = { title: 'Exercicis' }

export default async function ExercisesPage() {
  await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const supabase = await createClient()
  const { data } = await supabase.from('exercises').select('*').order('name_ca')
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('admin.nav.exercises')}</h1>
        <p className="mt-1 text-muted">{t('admin.exercises.count', { n: data?.length ?? 0 })}</p>
      </header>
      <ExerciseManager exercises={(data ?? []) as Exercise[]} />
    </div>
  )
}
