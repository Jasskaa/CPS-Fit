import Link from 'next/link'
import { Megaphone, MessageSquare, Plus, Wrench } from 'lucide-react'
import { pageCtx, pick, str } from '@/lib/ctx'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { DataTable, Field, PageHeader, Section, StatusChip, td, th, trow } from '@/components/club-ui'
import { ActionButton, ActionForm, Modal } from '@/components/club-client'
import { EmptyState } from '@/components/ui'
import { addPhoto, createAnnouncement, createPoll, createTask, deleteAnnouncement, deleteHistory, deleteNews, deletePhoto, deletePoll, replyMessage, saveHistory, saveNews, setInventoryQty, setMessageStatus, setTaskStatus } from './actions'

export const metadata = { title: 'Comunicació' }
const TABS = ['news', 'announcements', 'messages', 'polls', 'incidents', 'content'] as const
type Search = Record<string, string | string[] | undefined>

export default async function CommsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const { t, locale, supabase, writable } = await pageCtx('comms')
  const tab = (TABS as readonly string[]).includes(str(sp.tab)) ? str(sp.tab) : 'news'

  return (
    <div className="space-y-5">
      <PageHeader title={t('club.comms.title')} subtitle={t('club.comms.subtitle')} />
      <nav className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1" aria-label={t('club.comms.title')}>
        {TABS.map((x) => <Link key={x} href={`/admin/comunicacio?tab=${x}`} aria-current={tab === x ? 'page' : undefined} className={`flex min-h-10 min-w-fit flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold ${tab === x ? 'bg-surface text-primary-text shadow-sm' : 'text-muted hover:text-text'}`}>{t(`club.comms.tabs.${x}`)}</Link>)}
      </nav>
      {tab === 'news' && <News />}
      {tab === 'announcements' && <Announcements />}
      {tab === 'messages' && <Messages />}
      {tab === 'polls' && <Polls />}
      {tab === 'incidents' && <Incidents />}
      {tab === 'content' && <Content />}
    </div>
  )

  function NewsForm({ n }: { n?: { id: string; title_ca: string; title_es: string | null; excerpt_ca: string | null; body_ca: string | null; category: string; audience: string; status: string; pinned: boolean; cover_url: string | null } }) {
    return (
      <ActionForm action={saveNews.bind(null, n?.id ?? null)} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label={t('club.comms.titleCa')}><input name="title_ca" defaultValue={n?.title_ca} required className="input" /></Field></div>
        <div className="sm:col-span-2"><Field label={t('club.comms.titleEs')}><input name="title_es" defaultValue={n?.title_es ?? ''} className="input" /></Field></div>
        <div className="sm:col-span-2"><Field label={t('club.comms.excerpt')}><input name="excerpt_ca" defaultValue={n?.excerpt_ca ?? ''} className="input" /></Field></div>
        <div className="sm:col-span-2"><Field label={t('club.comms.body')}><textarea name="body_ca" defaultValue={n?.body_ca ?? ''} rows={5} className="input" /></Field></div>
        <Field label={t('club.comms.category')}><input name="category" defaultValue={n?.category ?? 'club'} list="cats" className="input" /></Field>
        <datalist id="cats">{['club', 'serveis', 'gimnas', 'seccions', 'esdeveniments'].map((c) => <option key={c} value={c} />)}</datalist>
        <Field label={t('club.comms.audience')}><select name="audience" defaultValue={n?.audience ?? 'all'} className="input"><option value="all">{t('club.comms.aud.all')}</option><option value="members">{t('club.comms.aud.members')}</option></select></Field>
        <Field label={t('club.common.status')}><select name="status" defaultValue={n?.status ?? 'draft'} className="input">{['draft', 'scheduled', 'published'].map((s) => <option key={s} value={s}>{t(`club.comms.newsStatus.${s}`)}</option>)}</select></Field>
        <Field label={t('club.comms.cover')}><input name="cover_url" defaultValue={n?.cover_url ?? ''} placeholder="https://…" className="input" /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="pinned" defaultChecked={n?.pinned} /> {t('club.comms.pinned')}</label>
      </ActionForm>
    )
  }

  async function News() {
    const { data } = await supabase.from('news').select('id, title_ca, title_es, excerpt_ca, body_ca, category, audience, status, pinned, published_at, cover_url').order('published_at', { ascending: false, nullsFirst: true })
    return (
      <div className="space-y-4">
        {writable && <div className="flex justify-end"><Modal label={<><Plus size={16} aria-hidden /> {t('club.comms.newNews')}</>} title={t('club.comms.newNews')}><NewsForm /></Modal></div>}
        {(data?.length ?? 0) === 0 ? <EmptyState title={t('club.comms.noNews')} /> : (
          <DataTable label={t('club.comms.tabs.news')}>
            <thead><tr><th className={th}>{t('club.comms.titleCa')}</th><th className={th}>{t('club.comms.category')}</th><th className={th}>{t('club.comms.audience')}</th><th className={th}>{t('club.common.status')}</th><th className={th}>{t('club.common.date')}</th><th /></tr></thead>
            <tbody>{data!.map((n) => (
              <tr key={n.id} className={trow}><td className={`${td} font-semibold`}>{n.pinned ? '📌 ' : ''}{pick(n, 'title', locale)}</td><td className={td}><span className="chip">{n.category}</span></td><td className={td}>{t(`club.comms.aud.${n.audience}`)}</td>
                <td className={td}><StatusChip value={n.status === 'published' ? 'ok' : n.status === 'scheduled' ? 'open' : 'draft'} label={t(`club.comms.newsStatus.${n.status}`)} /></td><td className={`${td} tnum text-muted`}>{n.published_at ? fmtDate(n.published_at, locale) : '—'}</td>
                <td className={`${td} text-right`}>{writable && <span className="flex justify-end gap-1"><Modal label={t('club.common.edit')} title={t('club.comms.newNews')} className="btn btn-ghost !min-h-8 text-xs"><NewsForm n={n} /></Modal><ActionButton action={deleteNews} args={[n.id]} label="✕" className="btn btn-ghost !min-h-8 !px-2 text-xs" confirm={t('club.common.confirm') + '?'} /></span>}</td></tr>))}</tbody>
          </DataTable>
        )}
      </div>
    )
  }

  async function Announcements() {
    const [{ data }, { data: secs }, { data: teams }] = await Promise.all([
      supabase.from('announcements').select('id, title_ca, title_es, body_ca, audience, audience_ref, pinned, starts_at, ends_at').order('created_at', { ascending: false }),
      supabase.from('sections').select('id, name_ca, name_es').order('sort'), supabase.from('teams').select('id, name, sections(name_ca)').order('name').limit(100),
    ])
    return (
      <div className="space-y-4">
        {writable && <div className="flex justify-end"><Modal label={<><Plus size={16} aria-hidden /> {t('club.comms.newAnn')}</>} title={t('club.comms.newAnn')}>
          <ActionForm action={createAnnouncement} submit={t('club.comms.publish')} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label={t('club.comms.titleCa')}><input name="title_ca" required className="input" /></Field></div>
            <div className="sm:col-span-2"><Field label={t('club.comms.body')}><textarea name="body_ca" required rows={4} className="input" /></Field></div>
            <Field label={t('club.comms.audience')}><select name="audience" className="input"><option value="all">{t('club.comms.aud.all')}</option><option value="members">{t('club.comms.aud.members')}</option><option value="section">{t('club.comms.aud.section')}</option><option value="team">{t('club.comms.aud.team')}</option></select></Field>
            <Field label={t('club.comms.until')}><input name="ends_at" type="date" className="input" /></Field>
            <Field label={t('club.comms.aud.section')}><select name="section_ref" className="input"><option value="">—</option>{secs?.map((s) => <option key={s.id} value={s.id}>{pick(s, 'name', locale)}</option>)}</select></Field>
            <Field label={t('club.comms.aud.team')}><select name="team_ref" className="input"><option value="">—</option>{teams?.map((x) => <option key={x.id} value={x.id}>{x.name} · {(x.sections as unknown as { name_ca: string })?.name_ca}</option>)}</select></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" /> {t('club.comms.pinned')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked /> {t('club.comms.notify')}</label>
          </ActionForm>
        </Modal></div>}
        {(data?.length ?? 0) === 0 ? <EmptyState title={t('club.comms.noAnn')} icon={<Megaphone size={28} />} /> : (
          <ul className="grid gap-3 lg:grid-cols-2">{data!.map((a) => (
            <li key={a.id} className="card space-y-1 p-4"><p className="flex items-center justify-between gap-2"><span className="font-display text-xl font-bold">{a.pinned ? '📌 ' : ''}{pick(a, 'title', locale)}</span><span className="chip chip-primary">{t(`club.comms.aud.${a.audience}`)}</span></p>
              <p className="text-sm text-muted">{pick(a, 'body', locale)}</p><p className="flex items-center justify-between text-xs text-muted"><span>{fmtDate(a.starts_at, locale)}{a.ends_at ? ` → ${fmtDate(a.ends_at, locale)}` : ''}</span>{writable && <ActionButton action={deleteAnnouncement} args={[a.id]} label={t('club.common.delete')} className="btn btn-ghost !min-h-8 text-xs" confirm={t('club.common.confirm') + '?'} />}</p></li>
          ))}</ul>
        )}
      </div>
    )
  }

  async function Messages() {
    const status = str(sp.status)
    let q = supabase.from('messages').select('id, channel, category, from_name, from_contact, subject, body, status, created_at, people(id, first_name, last_name), message_replies(id, body, created_at)').order('created_at', { ascending: false }).limit(60)
    if (status) q = q.eq('status', status)
    const { data } = await q
    return (
      <div className="space-y-4">
        <div className="flex gap-2">{['', 'new', 'open', 'closed'].map((s) => <Link key={s} href={`/admin/comunicacio?tab=messages${s ? `&status=${s}` : ''}`} className={`chip !min-h-9 !px-4 !text-sm ${status === s ? 'chip-primary' : ''}`}>{s ? t(`club.comms.msgStatus.${s}`) : t('club.common.all')}</Link>)}</div>
        {(data?.length ?? 0) === 0 ? <EmptyState title={t('club.comms.noMessages')} icon={<MessageSquare size={28} />} /> : (
          <ul className="space-y-3">{data!.map((m) => {
            const p = m.people as unknown as { id: string; first_name: string; last_name: string } | null
            const replies = (m.message_replies as { id: string; body: string; created_at: string }[]).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
            return (
              <li key={m.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{m.subject ?? t(`club.comms.cat.${m.category}`)} <span className="chip">{t(`club.comms.cat.${m.category}`)}</span> <span className="chip">{m.channel}</span></p><StatusChip value={m.status === 'new' ? 'pending' : m.status === 'open' ? 'open' : 'closed'} label={t(`club.comms.msgStatus.${m.status}`)} /></div>
                <p className="text-xs text-muted">{p ? <Link className="text-primary-text hover:underline" href={`/admin/persones/${p.id}`}>{p.first_name} {p.last_name}</Link> : m.from_name} · {m.from_contact} · {fmtDateTime(m.created_at, locale)}</p>
                <p className="rounded-lg bg-surface-2 p-3 text-sm">{m.body}</p>
                {replies.map((r) => <p key={r.id} className="ml-6 rounded-lg bg-primary-soft p-3 text-sm"><span className="mb-1 block text-xs text-muted">{fmtDateTime(r.created_at, locale)}</span>{r.body}</p>)}
                {writable && (
                  <div className="flex flex-wrap gap-2">
                    <Modal label={t('club.comms.reply')} title={t('club.comms.reply')} className="btn btn-primary !min-h-9 text-sm"><ActionForm action={replyMessage.bind(null, m.id)} submit={t('club.comms.send')}><Field label={t('club.comms.body')}><textarea name="body" required rows={4} className="input" /></Field></ActionForm></Modal>
                    {m.status !== 'closed' && <ActionButton action={setMessageStatus} args={[m.id, 'closed']} label={t('club.comms.close')} />}{m.status === 'closed' && <ActionButton action={setMessageStatus} args={[m.id, 'open']} label={t('club.comms.reopen')} />}
                  </div>
                )}
              </li>)
          })}</ul>
        )}
      </div>
    )
  }

  async function Polls() {
    const [{ data: polls }, { data: votes }] = await Promise.all([supabase.from('polls').select('id, question_ca, question_es, options, closes_at').order('created_at', { ascending: false }), supabase.from('poll_votes').select('poll_id, option_idx')])
    return (
      <div className="space-y-4">
        {writable && <div className="flex justify-end"><Modal label={<><Plus size={16} aria-hidden /> {t('club.comms.newPoll')}</>} title={t('club.comms.newPoll')}>
          <ActionForm action={createPoll} submit={t('club.comms.publish')}><Field label={t('club.comms.question')}><input name="question_ca" required className="input" /></Field><Field label={t('club.comms.options')} hint={t('club.comms.optionsHint')}><textarea name="options" required rows={4} className="input" /></Field><Field label={t('club.comms.until')}><input type="date" name="closes_at" className="input" /></Field></ActionForm></Modal></div>}
        {(polls?.length ?? 0) === 0 ? <EmptyState title={t('club.comms.noPolls')} /> : (
          <ul className="grid gap-4 lg:grid-cols-2">{polls!.map((p) => {
            const opts = p.options as string[]
            const mine = (votes ?? []).filter((v) => v.poll_id === p.id)
            const total = mine.length
            return <li key={p.id} className="card space-y-3 p-4"><p className="flex items-start justify-between gap-2"><span className="font-display text-xl font-bold">{pick(p, 'question', locale)}</span>{writable && <ActionButton action={deletePoll} args={[p.id]} label="✕" className="btn btn-ghost !min-h-8 !px-2 text-xs" confirm={t('club.common.confirm') + '?'} />}</p>
              <ul className="space-y-2">{opts.map((o, i) => { const n = mine.filter((v) => v.option_idx === i).length; const pct = total ? Math.round((n / total) * 100) : 0; return <li key={i}><p className="flex justify-between text-sm"><span>{o}</span><span className="tnum text-muted">{n} · {pct}%</span></p><div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div></li> })}</ul>
              <p className="text-xs text-muted">{t('club.comms.votes', { n: total })}{p.closes_at ? ` · ${t('club.comms.until')} ${fmtDate(p.closes_at, locale)}` : ''}</p></li>
          })}</ul>
        )}
      </div>
    )
  }

  async function Incidents() {
    const [{ data: tasks }, { data: zones }, { data: inv }] = await Promise.all([
      supabase.from('facility_tasks').select('id, kind, title, description, priority, status, created_at, zones(name_ca, name_es)').order('status').order('created_at', { ascending: false }).limit(60),
      supabase.from('zones').select('id, name_ca, name_es').order('sort'), supabase.from('inventory_items').select('id, name, qty, min_qty, zones(name_ca)').order('name'),
    ])
    const PR: Record<string, string> = { urgent: 'chip-danger', high: 'chip-danger', normal: '', low: '' }
    return (
      <div className="space-y-5" id="incidencies">
        <Section title={t('club.comms.tasks')} icon={<Wrench size={20} className="text-primary-text" aria-hidden />} action={writable && (
          <Modal label={<><Plus size={15} aria-hidden /> {t('club.comms.newTask')}</>} title={t('club.comms.newTask')} className="btn btn-primary !min-h-9 text-sm">
            <ActionForm action={createTask} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label={t('club.comms.titleCa')}><input name="title" required className="input" /></Field></div>
              <Field label={t('club.bookings.type')}><select name="kind" className="input">{['incident', 'maintenance', 'task'].map((k) => <option key={k} value={k}>{t(`club.comms.taskKind.${k}`)}</option>)}</select></Field>
              <Field label={t('club.comms.priority')}><select name="priority" defaultValue="normal" className="input">{['low', 'normal', 'high', 'urgent'].map((k) => <option key={k} value={k}>{t(`club.comms.prio.${k}`)}</option>)}</select></Field>
              <Field label={t('club.people.profile.zone')}><select name="zone_id" className="input"><option value="">—</option>{zones?.map((z) => <option key={z.id} value={z.id}>{pick(z, 'name', locale)}</option>)}</select></Field>
              <Field label={t('club.comms.due')}><input name="due_on" type="date" className="input" /></Field>
              <div className="sm:col-span-2"><Field label={t('club.common.details')}><textarea name="description" rows={3} className="input" /></Field></div>
            </ActionForm>
          </Modal>
        )}>
          <ul className="divide-y divide-border text-sm">{(tasks ?? []).map((k) => (
            <li key={k.id} className={`flex flex-wrap items-center justify-between gap-2 py-3 ${k.status === 'resolved' ? 'opacity-60' : ''}`}>
              <span><span className="block font-semibold">{k.title}</span><span className="text-xs text-muted">{t(`club.comms.taskKind.${k.kind}`)}{k.zones ? ` · ${pick(k.zones as unknown as object, 'name', locale)}` : ''} · {fmtDate(k.created_at, locale)}</span></span>
              <span className="flex items-center gap-2"><span className={`chip ${PR[k.priority]}`}>{t(`club.comms.prio.${k.priority}`)}</span>
                {writable && k.status !== 'resolved' && <>{k.status === 'open' && <ActionButton action={setTaskStatus} args={[k.id, 'in_progress']} label={t('club.comms.start')} />}<ActionButton action={setTaskStatus} args={[k.id, 'resolved']} label={t('club.comms.resolve')} className="btn btn-primary !min-h-9 text-sm" /></>}
                {k.status === 'in_progress' && <span className="chip chip-warn">{t('club.comms.inProgress')}</span>}{k.status === 'resolved' && <span className="chip chip-success">{t('club.comms.resolved')}</span>}</span>
            </li>))}</ul>
        </Section>
        <Section title={t('club.comms.inventory')}>
          <DataTable label={t('club.comms.inventory')}>
            <thead><tr><th className={th}>{t('club.common.name')}</th><th className={th}>{t('club.people.profile.zone')}</th><th className={`${th} text-right`}>{t('club.comms.qty')}</th><th className={`${th} text-right`}>{t('club.comms.min')}</th><th /></tr></thead>
            <tbody>{(inv ?? []).map((i) => <tr key={i.id} className={trow}><td className={`${td} font-semibold`}>{i.name}</td><td className={`${td} text-muted`}>{(i.zones as unknown as { name_ca: string } | null)?.name_ca ?? '—'}</td>
              <td className={`${td} text-right tnum ${i.qty <= i.min_qty ? 'font-bold text-danger' : ''}`}>{i.qty}</td><td className={`${td} text-right tnum text-muted`}>{i.min_qty}</td>
              <td className={`${td} text-right`}>{writable && <Modal label={t('club.common.edit')} title={i.name} className="btn btn-ghost !min-h-8 text-xs"><ActionForm action={setInventoryQty.bind(null, i.id)} submit={t('club.common.save')}><Field label={t('club.comms.qty')}><input name="qty" type="number" min={0} defaultValue={i.qty} className="input" /></Field></ActionForm></Modal>}</td></tr>)}</tbody>
          </DataTable>
        </Section>
      </div>
    )
  }

  async function Content() {
    const [{ data: hist }, { data: photos }] = await Promise.all([supabase.from('club_history').select('id, year, title_ca, title_es, body_ca').order('year'), supabase.from('gallery_photos').select('id, album, caption, url, taken_on').order('created_at', { ascending: false }).limit(40)])
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t('club.comms.history')} action={writable && <Modal label={<><Plus size={15} aria-hidden /> {t('club.comms.addMilestone')}</>} title={t('club.comms.addMilestone')} className="btn btn-primary !min-h-9 text-sm"><ActionForm action={saveHistory} submit={t('club.common.save')}><Field label={t('club.comms.year')}><input name="year" type="number" min={1900} max={2100} required className="input" /></Field><Field label={t('club.comms.titleCa')}><input name="title_ca" required className="input" /></Field><Field label={t('club.comms.body')}><textarea name="body_ca" rows={3} className="input" /></Field></ActionForm></Modal>}>
          <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">{(hist ?? []).map((h) => <li key={h.id} className="relative"><span aria-hidden className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" /><p className="flex items-center justify-between gap-2"><span className="font-display text-xl font-bold">{h.year} · {pick(h, 'title', locale)}</span>{writable && <ActionButton action={deleteHistory} args={[h.id]} label="✕" className="btn btn-ghost !min-h-8 !px-2 text-xs" confirm={t('club.common.confirm') + '?'} />}</p><p className="text-muted">{h.body_ca}</p></li>)}</ol>
        </Section>
        <Section title={t('club.comms.gallery')} action={writable && <Modal label={<><Plus size={15} aria-hidden /> {t('club.comms.addPhoto')}</>} title={t('club.comms.addPhoto')} className="btn btn-primary !min-h-9 text-sm"><ActionForm action={addPhoto} submit={t('club.common.save')}><Field label="URL"><input name="url" required placeholder="https://…" className="input" /></Field><Field label={t('club.comms.album')}><input name="album" defaultValue="General" className="input" /></Field><Field label={t('club.comms.caption')}><input name="caption" className="input" /></Field></ActionForm></Modal>}>
          {(photos?.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-muted">{t('club.comms.noPhotos')}</p> : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos!.map((p) => <li key={p.id} className="group relative overflow-hidden rounded-xl border border-border"><img src={p.url} alt={p.caption ?? p.album ?? ''} loading="lazy" className="aspect-[4/3] w-full object-cover" /><p className="truncate px-2 py-1 text-xs text-muted">{p.album}{p.caption ? ` · ${p.caption}` : ''}</p>{writable && <span className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100"><ActionButton action={deletePhoto} args={[p.id]} label="✕" className="btn btn-danger !min-h-8 !px-2 text-xs" /></span>}</li>)}</ul>
          )}
        </Section>
      </div>
    )
  }
}
