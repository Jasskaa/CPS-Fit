'use client'

import { usePathname } from 'next/navigation'
import { BrandMark } from '@/components/ui'
import { MemberNav } from './nav'
import { OutboxSync } from './outbox-sync'

/** Marco de la app del socio. El modo entreno va a pantalla completa, sin cabecera ni pestañas. */
export function MemberShell({ name, pendingText, children }: { name: string; pendingText?: string; children: React.ReactNode }) {
  const path = usePathname()
  if (path.startsWith('/app/entreno')) {
    return (
      <>
        {children}
        <OutboxSync />
      </>
    )
  }
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <BrandMark size={34} />
        <span className="max-w-[40%] truncate text-sm font-semibold text-muted">{name}</span>
      </header>
      {pendingText && <p role="status" className="mx-4 mt-3 rounded-xl bg-warn-soft p-3 text-sm font-medium">{pendingText}</p>}
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <MemberNav />
      <OutboxSync />
    </div>
  )
}
