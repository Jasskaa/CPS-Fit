'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import type { MemberStatus } from '@/lib/types'
import { assignRoutine, saveTrainerNotes, setMemberStatus } from '../actions'

export function StatusSelect({ memberId, status }: { memberId: string; status: MemberStatus }) {
  const t = useTranslations('status')
  const [pending, start] = useTransition()
  return (
    <label className="block">
      <span className="label">{t('label')}</span>
      <select className="input min-w-44" value={status} disabled={pending} onChange={(e) => start(() => setMemberStatus(memberId, e.target.value as MemberStatus))}>
        {(['active', 'pending', 'paused', 'inactive'] as const).map((s) => <option key={s} value={s}>{t(s)}</option>)}
      </select>
    </label>
  )
}

export function AssignForm({ memberId, templates }: { memberId: string; templates: { id: string; name: string; duration_weeks: number | null }[] }) {
  const t = useTranslations('admin.member')
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)
  const [weeks, setWeeks] = useState(templates[0]?.duration_weeks ?? 6)
  return (
    <form
      className="grid gap-3 rounded-2xl bg-surface-2 p-3 sm:grid-cols-[1fr_6rem_9rem_auto] sm:items-end"
      action={(fd) => start(async () => { fd.set('member', memberId); const r = await assignRoutine(String(fd.get('routine')), fd); setDone(Boolean(r?.ok)); setTimeout(() => setDone(false), 3000) })}
    >
      <label className="block"><span className="label">{t('assignTemplate')}</span>
        <select name="routine" required className="input" onChange={(e) => setWeeks(templates.find((x) => x.id === e.target.value)?.duration_weeks ?? 6)}>
          {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <label className="block"><span className="label">{t('weeks')}</span><input name="weeks" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="input" /></label>
      <label className="block"><span className="label">{t('start')}</span><input name="start" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></label>
      <button className="btn btn-primary" disabled={pending || templates.length === 0}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : done ? t('assigned') : t('assign')}</button>
    </form>
  )
}

export function NotesForm({ memberId, goal, limitations, notes }: { memberId: string; goal: string; limitations: string; notes: string }) {
  const t = useTranslations('admin.member')
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  return (
    <form className="mt-3 grid gap-3" action={(fd) => start(async () => { await saveTrainerNotes(memberId, fd); setSaved(true); setTimeout(() => setSaved(false), 2500) })}>
      <label className="block"><span className="label">{t('goal')}</span><input name="goal" className="input" defaultValue={goal} /></label>
      <label className="block"><span className="label">{t('limitations')}</span><textarea name="limitations" rows={2} className="input" defaultValue={limitations} /></label>
      <label className="block"><span className="label">{t('privateNotes')}</span><textarea name="trainer_notes" rows={3} className="input" defaultValue={notes} /></label>
      <div><button className="btn btn-primary" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : saved ? t('saved') : t('save')}</button></div>
    </form>
  )
}
