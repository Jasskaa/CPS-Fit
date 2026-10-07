'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { completeOnboarding } from './actions'

const GOALS = ['strength', 'fatLoss', 'muscle', 'health', 'tone', 'race'] as const

export function OnboardingForm() {
  const t = useTranslations('onboarding')
  const [goal, setGoal] = useState<string>('health')
  const [level, setLevel] = useState('beginner')
  const [days, setDays] = useState(3)
  const [pending, start] = useTransition()
  return (
    <form className="space-y-5" action={(fd) => start(async () => { await completeOnboarding(fd) })}>
      <input type="hidden" name="goal" value={t(`goals.${goal}`)} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="days_per_week" value={days} />

      <fieldset>
        <legend className="label">{t('goal')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <button type="button" key={g} aria-pressed={goal === g} onClick={() => setGoal(g)} className={`btn !min-h-14 ${goal === g ? 'btn-primary' : 'btn-ghost'}`}>{t(`goals.${g}`)}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">{t('level')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
            <button type="button" key={l} aria-pressed={level === l} onClick={() => setLevel(l)} className={`btn !min-h-14 text-sm ${level === l ? 'btn-primary' : 'btn-ghost'}`}>{t(`levels.${l}`)}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">{t('days')}</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button type="button" key={n} aria-pressed={days === n} onClick={() => setDays(n)} className={`btn !min-h-14 flex-1 text-lg ${days === n ? 'btn-primary' : 'btn-ghost'}`}>{n}</button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="label">{t('limitations')}</span>
        <textarea name="limitations" rows={3} className="input" placeholder={t('limitationsHint')} />
        <span className="mt-1 block text-xs text-muted">{t('limitationsPrivacy')}</span>
      </label>
      <button className="btn btn-accent btn-lg w-full" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : t('finish')}</button>
    </form>
  )
}
