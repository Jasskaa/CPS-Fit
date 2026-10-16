'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { eur } from '@/lib/format'
import { tpvCheckout, tpvSearchPeople } from './actions'

export interface TpvProduct { id: string; name: string; kind: string; member: number; non: number }

export function Tpv({ products, locale, cashOpen }: { products: TpvProduct[]; locale: string; cashOpen: boolean }) {
  const t = useTranslations('club.billing.tpv')
  const router = useRouter()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ id: string; name: string; member: boolean }[]>([])
  const [person, setPerson] = useState<{ id: string; name: string; member: boolean } | null>(null)
  const [kind, setKind] = useState('all')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (q.trim().length < 2 || person) { setFound([]); return }
    const h = setTimeout(async () => setFound(await tpvSearchPeople(q)), 200)
    return () => clearTimeout(h)
  }, [q, person])

  const price = (p: TpvProduct) => (person?.member ? p.member : p.non)
  const lines = Object.entries(cart).filter(([, n]) => n > 0).map(([id, n]) => ({ p: products.find((x) => x.id === id)!, n }))
  const total = lines.reduce((a, l) => a + price(l.p) * l.n, 0)
  const kinds = ['all', ...new Set(products.map((p) => p.kind))]
  const add = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }))

  const pay = (method: 'cash' | 'card') => start(async () => {
    const r = await tpvCheckout({ personId: person?.id ?? null, method, items: lines.map((l) => ({ productId: l.p.id, qty: l.n })) })
    if (r.ok) { setMsg({ ok: true, text: t('done', { v: eur(r.total ?? 0, locale) }) }); setCart({}); setPerson(null); setQ(''); router.refresh() }
    else setMsg({ ok: false, text: r.error === 'declined' || r.error === 'card_declined' ? t('declined') : (r.error ?? 'error') })
  })

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">{kinds.map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`chip !min-h-9 !px-4 !text-sm ${kind === k ? 'chip-primary' : ''}`}>{k === 'all' ? t('all') : t(`kind.${k}`)}</button>)}</div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.filter((p) => kind === 'all' || p.kind === kind).map((p) => (
            <li key={p.id}><button type="button" onClick={() => add(p.id, 1)} className="card flex min-h-24 w-full flex-col justify-between p-3 text-left transition active:scale-[.98] hover:border-primary">
              <span className="text-sm font-semibold leading-tight">{p.name}</span>
              <span className="flex items-baseline justify-between"><span className="font-display text-2xl font-extrabold tnum">{eur(price(p), locale)}</span>{(cart[p.id] ?? 0) > 0 && <span className="chip chip-primary tnum">×{cart[p.id]}</span>}</span>
            </button></li>
          ))}
        </ul>
      </div>
      <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-6" aria-label={t('cart')}>
        <h2 className="font-display text-2xl font-bold">{t('cart')}</h2>
        {person ? (
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm"><span className="font-semibold">{person.name} <span className={`chip ${person.member ? 'chip-primary' : ''}`}>{person.member ? t('member') : t('nonMember')}</span></span><button type="button" className="text-primary-text underline" onClick={() => setPerson(null)}>{t('anonymous')}</button></div>
        ) : (
          <div className="space-y-1"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPerson')} aria-label={t('searchPerson')} className="input" />
            <ul className="divide-y divide-border rounded-xl border border-border empty:hidden">{found.map((p) => <li key={p.id}><button type="button" className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-surface-2" onClick={() => setPerson(p)}><span className="font-semibold">{p.name}</span><span className="text-xs text-muted">{p.member ? t('member') : t('nonMember')}</span></button></li>)}</ul>
            <p className="text-xs text-muted">{t('anonymousHint')}</p></div>
        )}
        {lines.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t('empty')}</p> : (
          <ul className="divide-y divide-border text-sm">{lines.map((l) => (
            <li key={l.p.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 flex-1 truncate">{l.p.name}</span>
              <span className="flex items-center gap-1"><button type="button" className="btn btn-ghost !min-h-8 !px-2" onClick={() => add(l.p.id, -1)} aria-label="−"><Minus size={14} /></button><span className="w-5 text-center tnum">{l.n}</span><button type="button" className="btn btn-ghost !min-h-8 !px-2" onClick={() => add(l.p.id, 1)} aria-label="+"><Plus size={14} /></button></span>
              <span className="w-16 text-right tnum">{eur(price(l.p) * l.n, locale)}</span><button type="button" className="text-muted hover:text-danger" onClick={() => setCart((c) => ({ ...c, [l.p.id]: 0 }))} aria-label={t('remove')}><Trash2 size={14} /></button></li>))}</ul>
        )}
        <p className="flex items-baseline justify-between border-t border-border pt-3 font-display text-3xl font-extrabold"><span>{t('total')}</span><span className="tnum">{eur(total, locale)}</span></p>
        {msg && <p role="status" className={`rounded-lg p-2.5 text-sm font-medium ${msg.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>{msg.text}</p>}
        {!cashOpen && <p className="text-xs text-muted">{t('noCash')}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary" disabled={!lines.length || pending} onClick={() => pay('cash')}>{t('cash')}</button>
          <button className="btn btn-accent" disabled={!lines.length || pending} onClick={() => pay('card')}>{t('card')}</button>
        </div>
      </aside>
    </div>
  )
}
