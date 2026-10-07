import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { CLUB } from '@/lib/config'

export const metadata = { title: 'Privacitat' }

export default async function PrivacyPage() {
  const t = await getTranslations()
  const sections = ['controller', 'data', 'purpose', 'legal', 'retention', 'rights', 'security', 'processors'] as const
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/login" className="text-sm font-semibold text-primary-text underline">← {t('common.back')}</Link>
      <h1 className="font-display mt-4 text-5xl font-extrabold uppercase">{t('legal.privacyTitle')}</h1>
      <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm font-medium">{t('legal.draftNotice')}</p>
      {sections.map((s) => (
        <section key={s} className="mt-6">
          <h2 className="font-display text-2xl font-bold">{t(`legal.privacy.${s}.title`)}</h2>
          <p className="mt-1 leading-relaxed text-muted">{t(`legal.privacy.${s}.body`, { club: CLUB.name, email: CLUB.email })}</p>
        </section>
      ))}
    </main>
  )
}
