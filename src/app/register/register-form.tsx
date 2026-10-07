'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function RegisterForm() {
  const t = useTranslations()
  const locale = useLocale()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError(t('auth.passwordShort'))
    if (!consent) return setError(t('auth.consentRequired'))
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim(), locale, consent: 'true' },
        emailRedirectTo: `${location.origin}/auth/callback?next=/app`,
      },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="card animate-rise p-6 text-center">
        <MailCheck className="mx-auto text-success" size={44} aria-hidden />
        <p className="font-display mt-3 text-2xl font-bold">{t('auth.checkEmail')}</p>
        <p className="mt-1 text-sm text-muted">{t('auth.pendingValidation')}</p>
        <Link href="/login" className="btn btn-primary mt-5">{t('auth.signIn')}</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card animate-rise space-y-4 p-5" noValidate>
      <div>
        <label htmlFor="name" className="label">{t('auth.fullName')}</label>
        <input id="name" autoComplete="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="r-email" className="label">{t('auth.email')}</label>
        <input id="r-email" type="email" autoComplete="email" inputMode="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="r-password" className="label">{t('auth.passwordNew')}</label>
        <input id="r-password" type="password" autoComplete="new-password" minLength={8} required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--primary)]" />
        <span>
          {t('auth.consentText')}{' '}
          <Link href="/privacy" target="_blank" className="font-semibold text-primary-text underline">{t('legal.privacyTitle')}</Link>{' '}
          {t('common.and')}{' '}
          <Link href="/terms" target="_blank" className="font-semibold text-primary-text underline">{t('legal.termsTitle')}</Link>.
        </span>
      </label>
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 text-sm font-medium text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy || !name || !email || !password}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : t('auth.createAccount')}
      </button>
      <p className="text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-primary-text underline underline-offset-2">{t('auth.signIn')}</Link>
      </p>
    </form>
  )
}
