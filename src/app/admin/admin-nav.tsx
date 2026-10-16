'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BarChart3, CalendarRange, Dumbbell, History, LayoutDashboard, ListChecks, Megaphone, MessageSquare, Newspaper,
  Receipt, Settings, ShieldCheck, Trophy, Users, DoorOpen, UserRoundCog,
} from 'lucide-react'
import { can, type Module } from '@/lib/permissions'
import type { Role } from '@/lib/types'

export interface NavItem { href: string; key: string; icon: typeof Users; module: Module; exact?: boolean; adminOnly?: boolean }
export interface NavGroup { key: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { key: 'clubGroup', items: [
    { href: '/admin', key: 'dashboard', icon: LayoutDashboard, module: 'dashboard', exact: true },
    { href: '/admin/persones', key: 'people', icon: Users, module: 'people' },
    { href: '/admin/acces', key: 'access', icon: DoorOpen, module: 'access' },
    { href: '/admin/reserves', key: 'bookings', icon: CalendarRange, module: 'bookings' },
    { href: '/admin/facturacio', key: 'billing', icon: Receipt, module: 'billing' },
  ] },
  { key: 'sportGroup', items: [
    { href: '/admin/seccions', key: 'sections', icon: Trophy, module: 'sections' },
    { href: '/admin/comunicacio', key: 'comms', icon: Newspaper, module: 'comms' },
  ] },
  { key: 'gymGroup', items: [
    { href: '/admin/socis', key: 'gymMembers', icon: UserRoundCog, module: 'gym' },
    { href: '/admin/rutines', key: 'routines', icon: ListChecks, module: 'gym' },
    { href: '/admin/exercicis', key: 'exercises', icon: Dumbbell, module: 'gym' },
    { href: '/admin/comentaris', key: 'comments', icon: MessageSquare, module: 'gym' },
    { href: '/admin/avisos', key: 'announcements', icon: Megaphone, module: 'gym' },
    { href: '/admin/monitors', key: 'trainers', icon: ShieldCheck, module: 'gym', adminOnly: true },
  ] },
  { key: 'manageGroup', items: [
    { href: '/admin/informes', key: 'reports', icon: BarChart3, module: 'reports' },
    { href: '/admin/auditoria', key: 'audit', icon: History, module: 'audit' },
    { href: '/admin/configuracio', key: 'settings', icon: Settings, module: 'settings' },
  ] },
]

export function visibleNav(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(role, i.module) && (!i.adminOnly || role === 'admin') && !(i.module === 'dashboard' && (role === 'coordinator' || role === 'coach'))) })).filter((g) => g.items.length)
}

export function AdminNav({ role }: { role: Role }) {
  const t = useTranslations('club.nav')
  const path = usePathname()
  return (
    <nav aria-label={t('label')} className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3 lg:px-3">
      {visibleNav(role).map((g) => (
        <div key={g.key}>
          <p className="px-3.5 pb-1 text-[0.68rem] font-bold uppercase tracking-widest text-muted">{t(g.key)}</p>
          <ul className="flex gap-1 lg:flex-col">
            {g.items.map(({ href, key, icon: Icon, exact }) => {
              const active = exact ? path === href : path.startsWith(href)
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-fg shadow-sm' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
                  >
                    <Icon size={17} aria-hidden /> {t(key)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
