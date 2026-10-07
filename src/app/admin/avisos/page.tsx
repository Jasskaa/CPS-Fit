import { getLocale, getTranslations } from 'next-intl/server'
import { Pin, Trash2 } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Announcement } from '@/lib/types'
import { EmptyState } from '@/components/ui'
import { createAnnouncement, deleteAnnouncement } from './actions'

export const metadata = { title: 'Avisos' }

export default async function AnnouncementsPage() {
  await requireRole(['admin', 'trainer'])
  const t = await getTranslations()
  const locale = await getLocale()
  const supabase = await createClient()
  const { data } = await supabase.from('announcements').select('*').order('starts_at', { ascending: false })
  const list = (data ?? []) as Announcement[]
  const now = Date.now()
  const state = (a: Announcement) => (new Date(a.starts_at).getTime() > now ? 'scheduled' : a.ends_at && new Date(a.ends_at).getTime() < now ? 'expired' : 'live')

  return (
    <div className="space-y-5">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{t('admin.nav.announcements')}</h1>
      <div className="grid gap-5 xl:grid-cols-[24rem_1fr]">
        <form action={createAnnouncement} className="card h-fit space-y-3 p-4">
          <h2 className="font-display text-2xl font-bold">{t('admin.announcements.new')}</h2>
          <label className="block"><span className="label">{t('admin.announcements.titleCa')}</span><input name="title_ca" required className="input" /></label>
          <label className="block"><span className="label">{t('admin.announcements.titleEs')}</span><input name="title_es" className="input" /></label>
          <label className="block"><span className="label">{t('admin.announcements.bodyCa')}</span><textarea name="body_ca" rows={2} className="input" /></label>
          <label className="block"><span className="label">{t('admin.announcements.bodyEs')}</span><textarea name="body_es" rows={2} className="input" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="label">{t('admin.announcements.from')}</span><input type="datetime-local" name="starts_at" className="input" /></label>
            <label className="block"><span className="label">{t('admin.announcements.until')}</span><input type="datetime-local" name="ends_at" className="input" /></label>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" name="pinned" className="h-5 w-5 accent-[var(--primary)]" /><span className="text-sm font-semibold">{t('admin.announcements.pin')}</span></label>
          <button className="btn btn-primary w-full">{t('admin.announcements.publish')}</button>
        </form>

        {list.length === 0 ? <EmptyState title={t('admin.announcements.empty')} /> : (
          <ul className="space-y-3">
            {list.map((a) => (
              <li key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {a.pinned && <Pin size={14} className="text-primary-text" aria-label={t('member.pinned')} />}
                      {a.title_ca}
                      <span className={`chip ${state(a) === 'live' ? 'chip-success' : state(a) === 'scheduled' ? 'chip-warn' : ''}`}>{t(`admin.announcements.state.${state(a)}`)}</span>
                    </p>
                    {a.body_ca && <p className="mt-1 text-sm text-muted">{a.body_ca}</p>}
                    <p className="mt-2 text-xs text-muted tnum">{new Date(a.starts_at).toLocaleString(locale)} → {a.ends_at ? new Date(a.ends_at).toLocaleString(locale) : '∞'}</p>
                  </div>
                  <form action={deleteAnnouncement.bind(null, a.id)}><button className="btn btn-danger !min-h-11 !w-11 !px-0" aria-label={t('common.delete')}><Trash2 size={16} aria-hidden /></button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
