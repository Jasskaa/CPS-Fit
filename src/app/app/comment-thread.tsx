'use client'

import { useRef, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'
import type { CommentRow } from '@/lib/types'
import { addComment } from './comment-actions'

/** Hilo sencillo socio ↔ monitor. Se usa en la app del socio y en la ficha del monitor. */
export function CommentThread({
  memberId, routineId, currentUserId, comments, names,
}: { memberId: string; routineId?: string | null; currentUserId: string; comments: CommentRow[]; names: Record<string, string> }) {
  const t = useTranslations('routine')
  const [pending, start] = useTransition()
  const ref = useRef<HTMLFormElement>(null)
  return (
    <div className="card p-4">
      {comments.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted">{t('noComments')}</p>
      ) : (
        <ul className="space-y-3" aria-live="polite">
          {comments.map((c) => {
            const mine = c.author_id === currentUserId
            return (
              <li key={c.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-md bg-primary text-primary-fg' : 'rounded-bl-md bg-surface-2'}`}>{c.body}</div>
                <span className="mt-0.5 px-1 text-[11px] text-muted">{mine ? t('you') : (names[c.author_id] ?? '')} · {new Date(c.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            )
          })}
        </ul>
      )}
      <form
        ref={ref}
        className="mt-3 flex gap-2"
        action={(fd) => start(async () => { await addComment(memberId, routineId ?? null, String(fd.get('body') ?? '')); ref.current?.reset() })}
      >
        <label htmlFor={`c-${memberId}`} className="sr-only">{t('writeComment')}</label>
        <input id={`c-${memberId}`} name="body" className="input" placeholder={t('writeComment')} maxLength={2000} required autoComplete="off" />
        <button className="btn btn-primary !w-12 !px-0" disabled={pending} aria-label={t('send')}><Send size={18} aria-hidden /></button>
      </form>
    </div>
  )
}
