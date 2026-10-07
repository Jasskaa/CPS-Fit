'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(t('auth.invalid'))
      setBusy(false)
      return
    }
    router.replace(next && next.startsWith('/') ? next : '/app')
    router.refresh()
  }

  async function magicLink() {
    if (!email) return setError(t('auth.emailFirst'))
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next ?? '/app')}`, shouldCreateUser: false },
    })
    setBusy(false)
    if (error) setError(t('auth.magicError'))
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="card animate-rise p-6 text-center">
        <Mail className="mx-auto text-primary-text" size={40} aria-hidden />
        <p className="font-display mt-3 text-2xl font-bold">{t('auth.checkEmail')}</p>
        <p className="mt-1 text-sm text-muted">{t('auth.magicSent', { email })}</p>
        <button className="btn btn-ghost mt-5" onClick={() => setSent(false)}>{t('common.back')}</button>
      </div>
    )
  }

  return (
    <form onSubmit={signIn} className="card animate-rise space-y-4 p-5" noValidate>
      <div>
        <label htmlFor="email" className="label">{t('auth.email')}</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="label">{t('auth.password')}</label>
        <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 text-sm font-medium text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy || !email || !password}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : t('auth.signIn')}
      </button>
      <button type="button" className="btn btn-ghost w-full" onClick={magicLink} disabled={busy}>
        <Mail size={18} aria-hidden /> {t('auth.magicLink')}
      </button>
      <p className="pt-1 text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-primary-text underline underline-offset-2">{t('auth.register')}</Link>
      </p>
    </form>
  )
}
