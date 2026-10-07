'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, UserPlus } from 'lucide-react'
import { Modal } from '@/app/app/entreno/workout-parts'
import { inviteMember } from './actions'

export function InviteMember({ canInvite, isAdmin }: { canInvite: boolean; isAdmin: boolean }) {
  const t = useTranslations('admin.members')
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)
  return (
    <>
      <button className="btn btn-primary" onClick={() => { setResult(null); setOpen(true) }}><UserPlus size={18} aria-hidden /> {t('invite')}</button>
      {open && (
        <Modal title={t('invite')} onClose={() => setOpen(false)}>
          {!canInvite && <p className="mb-3 rounded-xl bg-warn-soft p-3 text-sm">{t('inviteNoKey')}</p>}
          {result?.ok ? (
            <div className="space-y-3"><p className="rounded-xl bg-success-soft p-3 text-sm font-medium text-success">{t('inviteSent')}</p><button className="btn btn-primary w-full" onClick={() => setOpen(false)}>{t('close')}</button></div>
          ) : (
            <form className="space-y-3" action={(fd) => start(async () => setResult(await inviteMember(fd)))}>
              <label className="block"><span className="label">{t('name')}</span><input name="full_name" required className="input" /></label>
              <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
              {isAdmin && <p className="text-xs text-muted">{t('inviteAdminHint')}</p>}
              {result?.error && <p role="alert" className="text-sm font-medium text-danger">{result.error}</p>}
              <button className="btn btn-primary w-full" disabled={pending || !canInvite}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : t('sendInvite')}</button>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
