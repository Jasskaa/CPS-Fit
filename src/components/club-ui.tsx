import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { initials } from '@/lib/format'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.38 }} className="grid shrink-0 place-items-center rounded-full bg-primary-soft font-display font-extrabold text-primary-text">
      {initials(name)}
    </span>
  )
}

const TONES: Record<string, string> = {
  active: 'chip-success', paid: 'chip-success', succeeded: 'chip-success', confirmed: 'chip-success', collected: 'chip-success', ok: 'chip-success', closed: 'chip-success',
  pending: 'chip-warn', paused: 'chip-warn', prospect: 'chip-warn', draft: '', submitted: 'chip-primary', waitlist: 'chip-warn', open: 'chip-primary',
  overdue: 'chip-danger', failed: 'chip-danger', left: 'chip-danger', returned: 'chip-danger', no_show: 'chip-danger', cancelled: '', void: '', ended: '', refunded: 'chip-warn', blocked: 'chip-danger', denied: 'chip-danger',
}
export function StatusChip({ value, label }: { value: string; label?: string }) {
  return <span className={`chip ${TONES[value] ?? ''}`}>{label ?? value}</span>
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null
  const cls = 'btn btn-ghost !min-h-10 !px-3'
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-2">
      {page > 1 ? <Link className={cls} href={href(page - 1)} aria-label="Anterior"><ChevronLeft size={16} /></Link> : <span className={`${cls} opacity-40`}><ChevronLeft size={16} /></span>}
      <span className="text-sm tnum text-muted">{page} / {pages}</span>
      {page < pages ? <Link className={cls} href={href(page + 1)} aria-label="Següent"><ChevronRight size={16} /></Link> : <span className={`${cls} opacity-40`}><ChevronRight size={16} /></span>}
    </nav>
  )
}

export function DataTable({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm" aria-label={label}>{children}</table>
    </div>
  )
}
export const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted'
export const td = 'px-4 py-3 align-middle'
export const trow = 'border-t border-border hover:bg-surface-2/60'

export function Section({ title, icon, children, action, id }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="card p-4" aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd>
    </div>
  )
}
