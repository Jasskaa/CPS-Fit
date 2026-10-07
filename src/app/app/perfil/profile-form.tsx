'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2, LogOut, Trash2 } from 'lucide-react'
import type { MemberDetails, Profile } from '@/lib/types'
import { LocaleSwitch } from '@/components/ui'
import { ThemeToggle } from '@/components/theme'
import { signOut } from '@/app/actions'
import { deleteAccount, saveProfile } from './actions'

export function ProfileForm({ profile, details }: { profile: Profile; details: MemberDetails | null }) {
  const t = useTranslations('profile')
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  const [units, setUnits] = useState(profile.units)
  const [restAlert, setRestAlert] = useState(() => (typeof localStorage === 'undefined' ? true : localStorage.getItem('cps-rest-alert') !== 'off'))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <form
        className="card space-y-3 p-4"
        action={(fd) => start(async () => { await saveProfile(fd); setSaved(true); setTimeout(() => setSaved(false), 2500) })}
      >
        <h2 className="font-display text-2xl font-bold">{t('data')}</h2>
        <label className="block"><span className="label">{t('name')}</span><input name="full_name" className="input" defaultValue={profile.full_name} required /></label>
        <label className="block"><span className="label">{t('email')}</span><input className="input opacity-70" value={profile.email ?? ''} readOnly /></label>
        <label className="block"><span className="label">{t('goal')}</span><input name="goal" className="input" defaultValue={details?.goal ?? ''} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">{t('level')}</span>
            <select name="level" className="input" defaultValue={details?.level ?? 'beginner'}>
              <option value="beginner">{t('levels.beginner')}</option><option value="intermediate">{t('levels.intermediate')}</option><option value="advanced">{t('levels.advanced')}</option>
            </select>
          </label>
          <label className="block"><span className="label">{t('daysPerWeek')}</span>
            <select name="days_per_week" className="input" defaultValue={details?.days_per_week ?? 3}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
        </div>
        <label className="block"><span className="label">{t('limitations')}</span><textarea name="limitations" rows={2} className="input" defaultValue={details?.limitations ?? ''} placeholder={t('limitationsHint')} /></label>

        <h2 className="font-display pt-2 text-2xl font-bold">{t('preferences')}</h2>
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{t('language')}</span><LocaleSwitch /></div>
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{t('theme')}</span><ThemeToggle /></div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{t('units')}</span>
          <div role="group" aria-label={t('units')} className="inline-flex rounded-xl border border-border bg-surface p-1 text-sm font-bold">
            {(['kg', 'lb'] as const).map((u) => (
              <button type="button" key={u} aria-pressed={units === u} onClick={() => setUnits(u)} className={`h-10 min-w-12 rounded-lg px-3 ${units === u ? 'bg-primary text-primary-fg' : 'text-muted'}`}>{u}</button>
            ))}
          </div>
          <input type="hidden" name="units" value={units} />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span><span className="block text-sm font-semibold">{t('restAlert')}</span><span className="text-xs text-muted">{t('restAlertHint')}</span></span>
          <input type="checkbox" checked={restAlert} className="h-6 w-6 accent-[var(--primary)]" onChange={(e) => { setRestAlert(e.target.checked); localStorage.setItem('cps-rest-alert', e.target.checked ? 'on' : 'off') }} />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span><span className="block text-sm font-semibold">{t('sharePhotos')}</span><span className="text-xs text-muted">{t('sharePhotosHint')}</span></span>
          <input type="checkbox" name="shares_photos" defaultChecked={details?.shares_photos ?? false} className="h-6 w-6 accent-[var(--primary)]" />
        </label>
        <button className="btn btn-primary btn-lg w-full" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : saved ? t('saved') : t('save')}</button>
      </form>

      <section className="card space-y-3 p-4" aria-labelledby="privacy">
        <h2 id="privacy" className="font-display text-2xl font-bold">{t('privacy')}</h2>
        <p className="text-sm text-muted">{t('privacyHint')}</p>
        <a href="/api/export" className="btn btn-ghost w-full"><Download size={18} aria-hidden /> {t('export')}</a>
        {!confirmDelete ? (
          <button className="btn btn-danger w-full" onClick={() => setConfirmDelete(true)}><Trash2 size={18} aria-hidden /> {t('deleteAccount')}</button>
        ) : (
          <div className="animate-rise space-y-2 rounded-xl bg-danger-soft p-3">
            <p className="text-sm font-semibold text-danger">{t('deleteConfirm')}</p>
            {deleteError && <p role="alert" className="text-sm text-danger">{deleteError}</p>}
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setConfirmDelete(false)}>{t('cancel')}</button>
              <button className="btn flex-1 bg-danger text-bg" onClick={() => start(async () => { const r = await deleteAccount(); if (r && !r.ok) setDeleteError(t('deleteError')) })}>{t('deleteNow')}</button>
            </div>
          </div>
        )}
      </section>

      <form action={signOut}><button className="btn btn-ghost w-full"><LogOut size={18} aria-hidden /> {t('signOut')}</button></form>
    </div>
  )
}
