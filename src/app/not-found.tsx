import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Emblem } from '@/components/ui'

export default async function NotFound() {
  const t = await getTranslations('errors')
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Emblem size={88} />
      <p className="font-display text-8xl font-extrabold leading-none text-primary-text">404</p>
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{t('notFoundTitle')}</h1>
      <p className="text-muted">{t('notFoundBody')}</p>
      <Link href="/" className="btn btn-primary">{t('home')}</Link>
    </main>
  )
}
