import { getLocale, getTranslations } from 'next-intl/server'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadProgressData } from '@/lib/progress-data'
import { ProgressView } from './progress-view'

export const metadata = { title: 'Progrés' }

export default async function ProgressPage() {
  const { userId, profile } = (await getSessionProfile())!
  const locale = await getLocale()
  const t = await getTranslations()
  const supabase = await createClient()
  const data = await loadProgressData(supabase, userId, locale)
  return <ProgressView units={profile.units} locale={locale} title={t('progress.title')} memberId={userId} {...data} />
}
