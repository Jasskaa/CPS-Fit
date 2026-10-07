import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Check, MessageSquare } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui'
import { resolveComment } from '@/app/app/comment-actions'

export const metadata = { title: 'Comentaris' }

export default async function CommentsPage() {
  await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()
  const [{ data: comments }, { data: people }] = await Promise.all([
    supabase.from('comments').select('id, member_id, author_id, body, created_at, resolved, routines(name)').order('created_at', { ascending: false }).limit(200),
    supabase.from('profiles').select('id, full_name'),
  ])
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))
  const threads = new Map<string, NonNullable<typeof comments>>()
  for (const c of comments ?? []) threads.set(c.member_id, [...(threads.get(c.member_id) ?? []), c])
  const rows = [...threads.entries()].map(([member, list]) => ({ member, last: list[0], count: list.length }))

  return (
    <div className="space-y-5">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('admin.nav.comments')}</h1>
      {rows.length === 0 ? <EmptyState icon={<MessageSquare size={28} />} title={t('admin.comments.empty')} /> : (
        <ul className="space-y-2">
          {rows.map(({ member, last, count }) => {
            const waiting = last.author_id === member && !last.resolved
            return (
              <li key={member} className={`card flex flex-wrap items-center gap-3 p-4 ${waiting ? 'border-primary' : ''}`}>
                <Link href={`/admin/socis/${member}#comentaris`} className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{names.get(member)} {waiting && <span className="chip chip-warn">{t('admin.comments.waiting')}</span>}<span className="chip">{count}</span></p>
                  <p className="truncate text-sm text-muted">{last.author_id === member ? '' : `${t('routine.you')}: `}{last.body}</p>
                  <p className="text-xs text-muted">{new Date(last.created_at).toLocaleString(locale)}</p>
                </Link>
                {waiting && <form action={resolveComment.bind(null, last.id, true)}><button className="btn btn-ghost !min-h-11 text-sm"><Check size={15} aria-hidden /> {t('admin.comments.resolve')}</button></form>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
