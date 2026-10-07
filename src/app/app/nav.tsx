'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ClipboardList, Home, Info, TrendingUp, User } from 'lucide-react'

const items = [
  { href: '/app', key: 'home', icon: Home, exact: true },
  { href: '/app/rutina', key: 'routine', icon: ClipboardList },
  { href: '/app/progres', key: 'progress', icon: TrendingUp },
  { href: '/app/club', key: 'club', icon: Info },
  { href: '/app/perfil', key: 'profile', icon: User },
] as const

export function MemberNav() {
  const t = useTranslations('nav')
  const path = usePathname()
  if (path.startsWith('/app/entreno')) return null // el modo entreno ocupa toda la pantalla
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, key, icon: Icon, ...rest }) => {
          const active = 'exact' in rest ? path === href : path.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  active ? 'text-primary-text' : 'text-muted'
                }`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${active ? 'bg-primary-soft' : ''}`}>
                  <Icon size={22} aria-hidden />
                </span>
                {t(key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
