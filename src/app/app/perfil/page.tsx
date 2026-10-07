import { getTranslations } from 'next-intl/server'
import { getMemberDetails, getSessionProfile } from '@/lib/auth'
import { ProfileForm } from './profile-form'

export const metadata = { title: 'Perfil' }

export default async function ProfilePage() {
  const { profile } = (await getSessionProfile())!
  const details = await getMemberDetails(profile.id)
  const t = await getTranslations()
  return (
    <div className="space-y-4">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('profile.title')}</h1>
      <ProfileForm profile={profile} details={details} />
    </div>
  )
}
