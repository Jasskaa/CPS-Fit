'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Users } from 'lucide-react'
import { assignRoutine } from '../../socis/actions'

export function AssignMany({ routineId, members, defaultWeeks }: { routineId: string; members: { id: string; full_name: string }[]; defaultWeeks: number }) {
  const t = useTranslations('admin.routines')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <section className="card p-4" aria-labelledby="assign">
      <h2 id="assign" className="flex items-center gap-2 font-display text-2xl font-bold"><Users size={20} aria-hidden /> {t('assignTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t('assignHint')}</p>
      <form className="mt-3 space-y-3" action={(fd) => start(async () => { const r = await assignRoutine(routineId, fd); setMsg(r?.ok ? t('assignedN', { n: r.count ?? 0 }) : t('assignError')) })}>
        <fieldset>
          <legend className="sr-only">{t('assignTitle')}</legend>
          <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 hover:bg-surface-2">
                <input type="checkbox" name="member" value={m.id} className="h-5 w-5 accent-[var(--primary)]" />
                <span className="text-sm font-medium">{m.full_name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="label">{t('start')}</span><input type="date" name="start" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></label>
          <label className="block"><span className="label">{t('durationWeeks')}</span><input type="number" name="weeks" min={1} max={52} defaultValue={defaultWeeks} className="input w-28" /></label>
          <button className="btn btn-primary" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : t('assign')}</button>
          {msg && <p role="status" className="text-sm font-semibold">{msg}</p>}
        </div>
      </form>
    </section>
  )
}
