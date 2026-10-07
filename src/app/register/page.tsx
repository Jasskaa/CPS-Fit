import { getTranslations } from 'next-intl/server'
import { LocaleSwitch } from '@/components/ui'
import { ThemeToggle } from '@/components/theme'
import { Emblem } from '@/components/ui'
import { RegisterForm } from './register-form'

export default async function RegisterPage() {
  const t = await getTranslations()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <LocaleSwitch />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-6 py-6">
        <div className="flex items-center gap-3">
          <Emblem size={56} />
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{t('auth.registerTitle')}</h1>
            <p className="text-sm text-muted">{t('auth.registerHint')}</p>
          </div>
        </div>
        <RegisterForm />
      </div>
    </main>
  )
}
