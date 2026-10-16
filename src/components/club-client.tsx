'use client'

import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

type Result = { ok: boolean; error?: string; id?: string } | void
const CloseCtx = createContext<() => void>(() => {})

/** Diálogo nativo accesible (focus trap y Escape gratis). */
export function Modal({ label, title, children, className = 'btn btn-primary' }: { label: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const t = useTranslations('club.common')
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>{label}</button>
      <dialog ref={ref} className="card m-auto w-[min(92vw,34rem)] max-h-[90vh] overflow-y-auto p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button type="button" className="btn btn-ghost !min-h-9 !px-2" aria-label={t('close')} onClick={() => ref.current?.close()}><X size={16} /></button>
        </div>
        <CloseCtx.Provider value={() => ref.current?.close()}><div className="p-5">{children}</div></CloseCtx.Provider>
      </dialog>
    </>
  )
}

/** Formulario que llama a una server action, muestra el error y refresca la página. */
export function ActionForm({ action, children, submit, className = 'space-y-3', variant = 'btn-primary' }: {
  action: (fd: FormData) => Promise<Result>
  children: React.ReactNode
  submit: string
  className?: string
  variant?: string
}) {
  const router = useRouter()
  const close = useContext(CloseCtx)
  const t = useTranslations('club.common')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        start(async () => {
          setError(null)
          const r = await action(fd)
          if (r && !r.ok) { setError(r.error === 'invalid' ? t('error') : r.error?.startsWith('rule:') ? r.error.slice(5).split(',').map((c) => t(`rule.${c}`)).join(' · ') : (r.error ?? t('error'))); return }
          router.refresh()
          close()
        })
      }}
    >
      {children}
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 text-sm font-medium text-danger">{error}</p>}
      <button className={`btn ${variant}`} disabled={pending}>{pending ? t('loading') : submit}</button>
    </form>
  )
}

export function ActionButton({ action, args = [], label, className = 'btn btn-ghost !min-h-9 text-sm', confirm }: { action: (...a: never[]) => Promise<Result>; args?: unknown[]; label: React.ReactNode; className?: string; confirm?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return
          start(async () => {
            const r = await (action as (...a: unknown[]) => Promise<Result>)(...args)
            if (r && !r.ok) setError(r.error ?? 'error'); else { setError(null); router.refresh() }
          })
        }}
      >{label}</button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </>
  )
}

/** Diálogo controlado desde fuera (abre/cierra según `open`). */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const t = useTranslations('club.common')
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className={`card m-auto max-h-[90vh] overflow-y-auto p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm ${wide ? 'w-[min(94vw,46rem)]' : 'w-[min(92vw,34rem)]'}`}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <button type="button" className="btn btn-ghost !min-h-9 !px-2" aria-label={t('close')} onClick={onClose}><X size={16} /></button>
      </div>
      <CloseCtx.Provider value={onClose}><div className="p-5">{open ? children : null}</div></CloseCtx.Provider>
    </dialog>
  )
}

/** Selector de persona con búsqueda; deja el id en un input oculto `name` para usarlo en un ActionForm. */
export function PersonPicker({ search, name = 'person_id', placeholder }: { search: (q: string) => Promise<{ id: string; name: string }[]>; name?: string; placeholder: string }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ id: string; name: string }[]>([])
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    if (q.trim().length < 2 || picked) { setFound([]); return }
    const h = setTimeout(async () => setFound(await search(q)), 200)
    return () => clearTimeout(h)
  }, [q, picked, search])
  return (
    <div className="space-y-1">
      <input type="hidden" name={name} value={picked?.id ?? ''} />
      {picked ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"><span className="font-semibold">{picked.name}</span><button type="button" className="text-primary-text underline" onClick={() => { setPicked(null); setQ('') }}>✕</button></div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input" autoComplete="off" />
          <ul className="divide-y divide-border rounded-xl border border-border empty:hidden">{found.map((p) => <li key={p.id}><button type="button" className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold hover:bg-surface-2" onClick={() => setPicked(p)}>{p.name}</button></li>)}</ul>
        </>
      )}
    </div>
  )
}
