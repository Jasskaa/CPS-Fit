import { getTranslations } from 'next-intl/server'
import { LogOut } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { signOut } from '@/app/actions'
import { BrandMark, LocaleSwitch } from '@/components/ui'
import { ThemeToggle } from '@/components/theme'
import { AdminNav } from './admin-nav'
import { Monitor } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  return (
    <>
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center md:hidden">
      <BrandMark size={44} />
      <span className="grid h-20 w-20 place-items-center rounded-full bg-primary-soft text-primary-text"><Monitor size={36} aria-hidden /></span>
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{t('admin.mobile.title')}</h1>
      <p className="max-w-xs text-muted">{t('admin.mobile.body')}</p>
      <form action={signOut}><button className="btn btn-ghost"><LogOut size={16} aria-hidden /> {t('profile.signOut')}</button></form>
    </div>
    <div className="hidden min-h-dvh md:block lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg">{t('admin.skip')}</a>
      <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          <BrandMark size={38} />
          <p className="hidden pt-2 text-xs font-semibold uppercase tracking-wide text-muted lg:block">{profile.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleTrainer')}</p>
        </div>
        <AdminNav isAdmin={profile.role === 'admin'} />
        <div className="hidden space-y-3 border-t border-border p-4 lg:mt-auto lg:block">
          <div className="flex items-center justify-between"><LocaleSwitch /><ThemeToggle /></div>
          <p className="truncate text-sm font-semibold">{profile.full_name}</p>
          <form action={signOut}><button className="btn btn-ghost w-full !min-h-11 text-sm"><LogOut size={16} aria-hidden /> {t('profile.signOut')}</button></form>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-8">
        <div className="mb-4 flex items-center justify-between gap-2 lg:hidden"><LocaleSwitch /><ThemeToggle /></div>
        {children}
      </main>
    </div>
    </>
  )
}
