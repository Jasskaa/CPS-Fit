import { getTranslations } from 'next-intl/server'
import { getSessionProfile } from '@/lib/auth'
import { OnboardingForm } from './onboarding-form'

export const metadata = { title: 'Benvinguda' }

export default async function OnboardingPage() {
  const { profile } = (await getSessionProfile())!
  const t = await getTranslations()
  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('onboarding.title', { name: profile.full_name.split(' ')[0] })}</h1>
        <p className="mt-1 text-muted">{t('onboarding.hint')}</p>
      </header>
      <OnboardingForm />
    </div>
  )
}
