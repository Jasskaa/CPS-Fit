import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionProfile } from '@/lib/auth'
import { Emblem, LocaleSwitch } from '@/components/ui'
import { ThemeToggle } from '@/components/theme'
import { LoginForm } from './login-form'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; registered?: string }> }) {
  const session = await getSessionProfile()
  const sp = await searchParams
  if (session) redirect(session.profile.role === 'member' ? '/app' : '/admin')
  const t = await getTranslations()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <LocaleSwitch />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-8 py-8">
        <div className="animate-rise flex flex-col items-center text-center">
          <Emblem size={112} className="shadow-card" />
          <h1 className="font-display mt-5 text-6xl font-extrabold uppercase leading-none">CPS <span className="text-primary-text">Fit</span></h1>
          <p className="mt-2 text-muted">{t('brand.tagline')}</p>
        </div>
        {sp.registered && <p className="rounded-xl bg-success-soft p-3 text-center text-sm font-medium text-success">{t('auth.registered')}</p>}
        <LoginForm next={sp.next} />
      </div>
      <p className="text-center text-xs text-muted">{t('brand.club')}</p>
    </main>
  )
}
