import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth'
import { MemberShell } from './shell'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(['member'])
  const t = await getTranslations()
  return (
    <MemberShell name={profile.full_name.split(' ')[0]} pendingText={profile.status === 'pending' ? t('member.pendingBanner') : undefined}>
      {children}
    </MemberShell>
  )
}
