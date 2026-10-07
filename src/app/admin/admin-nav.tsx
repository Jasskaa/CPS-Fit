'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Dumbbell, LayoutDashboard, ListChecks, Megaphone, MessageSquare, ShieldCheck, Users } from 'lucide-react'

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('admin.nav')
  const path = usePathname()
  const items = [
    { href: '/admin', key: 'dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/socis', key: 'members', icon: Users },
    { href: '/admin/rutines', key: 'routines', icon: ListChecks },
    { href: '/admin/exercicis', key: 'exercises', icon: Dumbbell },
    { href: '/admin/comentaris', key: 'comments', icon: MessageSquare },
    { href: '/admin/avisos', key: 'announcements', icon: Megaphone },
    ...(isAdmin ? [{ href: '/admin/monitors', key: 'trainers', icon: ShieldCheck }] : []),
  ] as { href: string; key: string; icon: typeof Users; exact?: boolean }[]
  return (
    <nav aria-label={t('label')} className="no-scrollbar overflow-x-auto px-2 pb-2 lg:px-3 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map(({ href, key, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href)
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
              >
                <Icon size={18} aria-hidden /> {t(key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
