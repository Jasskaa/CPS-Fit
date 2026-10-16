'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { useTranslations } from 'next-intl'
import { Search, User } from 'lucide-react'
import { visibleNav } from './admin-nav'
import { searchPeopleAction } from './persones/actions'
import type { Role } from '@/lib/types'

export function CommandPalette({ role }: { role: Role }) {
  const t = useTranslations('club')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [people, setPeople] = useState<{ id: string; name: string; sub: string }[]>([])
  const [, start] = useTransition()
  const canPeople = visibleNav(role).some((g) => g.items.some((i) => i.module === 'people'))

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  useEffect(() => {
    if (!open || !canPeople || q.trim().length < 2) { setPeople([]); return }
    const h = setTimeout(() => start(async () => setPeople(await searchPeopleAction(q))), 180)
    return () => clearTimeout(h)
  }, [q, open, canPeople])

  const go = (href: string) => { setOpen(false); setQ(''); router.push(href) }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 text-left text-sm text-muted hover:text-text" aria-label={t('palette.open')}>
        <Search size={15} aria-hidden /> <span className="flex-1 truncate">{t('palette.open')}</span>
        <kbd className="rounded border border-border bg-surface px-1.5 text-[0.65rem]">⌘K</kbd>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-start bg-black/50 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <Command label={t('palette.open')} shouldFilter={false} className="card mx-auto w-full max-w-xl overflow-hidden !rounded-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search size={16} className="text-muted" aria-hidden />
              <Command.Input autoFocus value={q} onValueChange={setQ} placeholder={t('palette.placeholder')} className="h-14 w-full bg-transparent text-base outline-none" />
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="p-6 text-center text-sm text-muted">{t('palette.empty')}</Command.Empty>
              <Command.Group heading={t('palette.pages')} className="text-xs font-semibold uppercase tracking-wide text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                {visibleNav(role).flatMap((g) => g.items).filter((i) => !q || t(`nav.${i.key}`).toLowerCase().includes(q.toLowerCase())).map((i) => (
                  <Command.Item key={i.href} value={i.href} onSelect={() => go(i.href)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium normal-case tracking-normal text-text aria-selected:bg-primary-soft aria-selected:text-primary-text">
                    <i.icon size={16} aria-hidden /> {t(`nav.${i.key}`)}
                  </Command.Item>
                ))}
              </Command.Group>
              {people.length > 0 && (
                <Command.Group heading={t('palette.people')} className="text-xs font-semibold uppercase tracking-wide text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                  {people.map((p) => (
                    <Command.Item key={p.id} value={p.id} onSelect={() => go(`/admin/persones/${p.id}`)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium normal-case tracking-normal text-text aria-selected:bg-primary-soft aria-selected:text-primary-text">
                      <User size={16} aria-hidden /> <span className="flex-1 truncate">{p.name}</span><span className="text-xs text-muted">{p.sub}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>,
        document.body,
      )}
    </>
  )
}
