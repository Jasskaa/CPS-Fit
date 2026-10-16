import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { pageCtx, pick } from '@/lib/ctx'
import { Field, Section } from '@/components/club-ui'
import { ActionForm, Modal } from '@/components/club-client'
import { createTeam, updateSection } from '../actions'

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t, locale, supabase, profile } = await pageCtx('sections')
  const { data: s } = await supabase.from('sections').select('*, people:coordinator_person_id(first_name, last_name)').eq('id', id).maybeSingle()
  if (!s) notFound()
  const { data: teams } = await supabase.from('teams').select('id, name, category, gender, league, seasons(name), team_members(count), coach:coach_person_id(first_name, last_name)').eq('section_id', id).order('name')
  const canEdit = profile.role === 'admin' || profile.role === 'coordinator'
  const coord = s.people as { first_name: string; last_name: string } | null

  return (
    <div className="space-y-5">
      <Link href="/admin/seccions" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-text"><ArrowLeft size={16} aria-hidden /> {t('club.sections.title')}</Link>
      <header className="card overflow-hidden">
        <div className="h-2" style={{ background: s.color ?? 'var(--primary)' }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none">{pick(s, 'name', locale)}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">{pick(s, 'description', locale)}</p>
            <p className="mt-2 flex flex-wrap gap-2 text-xs">{coord && <span className="chip">{t('club.sections.coordinator')}: {coord.first_name} {coord.last_name}</span>}{s.email && <span className="chip">{s.email}</span>}{s.founded_year && <span className="chip">{t('club.sections.founded', { y: s.founded_year })}</span>}{s.discount_pct > 0 && <span className="chip chip-success">−{s.discount_pct}% {t('club.sections.discount')}</span>}</p>
          </div>
          {canEdit && (
            <Modal label={t('club.common.edit')} title={pick(s, 'name', locale)} className="btn btn-ghost">
              <ActionForm action={updateSection.bind(null, id)} submit={t('club.common.save')}>
                <Field label="Descripció (ca)"><textarea name="description_ca" defaultValue={s.description_ca ?? ''} rows={3} className="input" /></Field>
                <Field label="Descripción (es)"><textarea name="description_es" defaultValue={s.description_es ?? ''} rows={3} className="input" /></Field>
                <Field label="Email"><input name="email" type="email" defaultValue={s.email ?? ''} className="input" /></Field>
                <Field label={t('club.sections.discount') + ' %'}><input name="discount_pct" type="number" min={0} max={100} defaultValue={s.discount_pct} className="input" /></Field>
              </ActionForm>
            </Modal>
          )}
        </div>
      </header>
      <Section title={t('club.sections.teams')} icon={<Users size={20} className="text-primary-text" aria-hidden />} action={canEdit && (
        <Modal label={<><Plus size={15} aria-hidden /> {t('club.sections.newTeam')}</>} title={t('club.sections.newTeam')} className="btn btn-primary !min-h-9 text-sm">
          <ActionForm action={createTeam.bind(null, id)} submit={t('club.common.save')} className="grid gap-3 sm:grid-cols-2">
            <Field label={t('club.common.name')}><input name="name" required className="input" /></Field>
            <Field label={t('club.sections.category')}><input name="category" className="input" /></Field>
            <Field label={t('club.sections.gender')}><select name="gender" className="input"><option value="">—</option><option value="m">M</option><option value="f">F</option><option value="mixed">Mixt</option></select></Field>
            <Field label={t('club.sections.league')}><input name="league" className="input" /></Field>
          </ActionForm>
        </Modal>
      )}>
        {(teams?.length ?? 0) === 0 ? <p className="py-6 text-center text-sm text-muted">{t('club.sections.noTeams')}</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{teams!.map((tm) => {
            const coach = tm.coach as unknown as { first_name: string; last_name: string } | null
            return <li key={tm.id}><Link href={`/admin/seccions/equip/${tm.id}`} className="block rounded-xl border border-border p-3 transition hover:border-primary hover:bg-primary-soft/40">
              <p className="font-semibold">{tm.name}</p><p className="text-xs text-muted">{[tm.category, tm.league].filter(Boolean).join(' · ')}</p>
              <p className="mt-2 flex items-center justify-between text-xs"><span className="chip"><Users size={12} aria-hidden /> {(tm.team_members as unknown as { count: number }[])[0]?.count ?? 0}</span><span className="text-muted">{coach ? `${coach.first_name} ${coach.last_name}` : ''}</span></p>
            </Link></li>
          })}</ul>
        )}
      </Section>
    </div>
  )
}
