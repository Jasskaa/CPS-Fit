'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ImageUp, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Exercise } from '@/lib/types'
import { deleteExercise, saveExercise } from './actions'

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const

export function ExerciseManager({ exercises }: { exercises: Exercise[] }) {
  const t = useTranslations('admin.exercises')
  const tp = useTranslations('profile.levels')
  const locale = useLocale()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const muscles = useMemo(() => [...new Set(exercises.map((e) => e.primary_muscle))].sort(), [exercises])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return exercises.filter((e) => (!muscle || e.primary_muscle === muscle) && (!s || `${e.name_ca} ${e.name_es} ${e.equipment}`.toLowerCase().includes(s)))
  }, [exercises, q, muscle])

  return (
    <>
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <div className="relative min-w-52 flex-1">
          <label htmlFor="ex-q" className="sr-only">{t('search')}</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input id="ex-q" className="input !pl-9" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label={t('muscle')}>
          <option value="">{t('allMuscles')}</option>
          {muscles.map((m) => <option key={m}>{m}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden /> {t('new')}</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr><th scope="col" className="px-4 py-3">{t('name')}</th><th scope="col" className="px-4 py-3">{t('muscle')}</th><th scope="col" className="px-4 py-3">{t('equipment')}</th><th scope="col" className="px-4 py-3">{t('level')}</th><th scope="col" className="w-12" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-surface-2">
                <td className="px-4 py-2.5 font-semibold">{locale === 'es' ? e.name_es : e.name_ca}{e.is_timed && <span className="chip ml-2">⏱</span>}</td>
                <td className="px-4 py-2.5"><span className="chip chip-primary">{e.primary_muscle}</span></td>
                <td className="px-4 py-2.5 text-muted">{e.equipment}</td>
                <td className="px-4 py-2.5 text-muted">{tp(e.level)}</td>
                <td className="px-2"><button className="btn btn-ghost !min-h-11 !w-11 !px-0" onClick={() => setEditing(e)} aria-label={`${t('edit')} ${e.name_ca}`}><Pencil size={16} aria-hidden /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-muted">{t('none')}</p>}
      </div>

      {editing && <ExerciseForm exercise={editing === 'new' ? null : editing} muscles={muscles} onClose={() => setEditing(null)} />}
    </>
  )
}

function ExerciseForm({ exercise: e, muscles, onClose }: { exercise: Exercise | null; muscles: string[]; onClose: () => void }) {
  const t = useTranslations('admin.exercises')
  const tp = useTranslations('profile.levels')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [media, setMedia] = useState(e?.media_url ?? '')
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  async function upload(f: File) {
    setUploading(true)
    setError(null)
    const supabase = createClient()
    const ext = f.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('exercise-media').upload(path, f, { contentType: f.type, upsert: false })
    setUploading(false)
    if (error) return setError(error.message)
    setMedia(supabase.storage.from('exercise-media').getPublicUrl(path).data.publicUrl)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={e ? t('edit') : t('new')} className="animate-rise card mx-auto my-6 w-full max-w-3xl p-5" onClick={(ev) => ev.stopPropagation()}>
        <h2 className="font-display text-3xl font-bold">{e ? t('edit') : t('new')}</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          action={(fd) => start(async () => {
            fd.set('media_url', media)
            const r = await saveExercise(fd)
            if (r.ok) onClose()
            else setError(r.error ?? 'Error')
          })}
        >
          {e && <input type="hidden" name="id" value={e.id} />}
          <label className="block"><span className="label">{t('nameCa')}</span><input name="name_ca" required className="input" defaultValue={e?.name_ca} /></label>
          <label className="block"><span className="label">{t('nameEs')}</span><input name="name_es" required className="input" defaultValue={e?.name_es} /></label>
          <label className="block"><span className="label">{t('muscle')}</span><input name="primary_muscle" required list="muscles" className="input" defaultValue={e?.primary_muscle} /><datalist id="muscles">{muscles.map((m) => <option key={m} value={m} />)}</datalist></label>
          <label className="block"><span className="label">{t('secondary')}</span><input name="secondary_muscles" className="input" defaultValue={e?.secondary_muscles.join(', ')} placeholder="Tríceps, Espatlles" /></label>
          <label className="block"><span className="label">{t('equipment')}</span><input name="equipment" required className="input" defaultValue={e?.equipment ?? 'Pes corporal'} /></label>
          <label className="block"><span className="label">{t('level')}</span>
            <select name="level" className="input" defaultValue={e?.level ?? 'beginner'}>{LEVELS.map((l) => <option key={l} value={l}>{tp(l)}</option>)}</select>
          </label>
          <label className="block"><span className="label">{t('tags')}</span><input name="tags" className="input" defaultValue={e?.tags.join(', ')} /></label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end"><input type="checkbox" name="is_timed" defaultChecked={e?.is_timed} className="h-5 w-5 accent-[var(--primary)]" /><span className="text-sm font-semibold">{t('timed')}</span></label>
          <label className="block sm:col-span-2"><span className="label">{t('descriptionCa')}</span><textarea name="description_ca" rows={2} className="input" defaultValue={e?.description_ca ?? ''} /></label>
          <label className="block sm:col-span-2"><span className="label">{t('descriptionEs')}</span><textarea name="description_es" rows={2} className="input" defaultValue={e?.description_es ?? ''} /></label>
          <label className="block"><span className="label">{t('tipsCa')}</span><textarea name="tips_ca" rows={2} className="input" defaultValue={e?.tips_ca ?? ''} /></label>
          <label className="block"><span className="label">{t('tipsEs')}</span><textarea name="tips_es" rows={2} className="input" defaultValue={e?.tips_es ?? ''} /></label>
          <label className="block"><span className="label">{t('mistakesCa')}</span><textarea name="mistakes_ca" rows={2} className="input" defaultValue={e?.mistakes_ca ?? ''} /></label>
          <label className="block"><span className="label">{t('mistakesEs')}</span><textarea name="mistakes_es" rows={2} className="input" defaultValue={e?.mistakes_es ?? ''} /></label>
          <div className="sm:col-span-2">
            <span className="label">{t('media')}</span>
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-52 flex-1" value={media} onChange={(ev) => setMedia(ev.target.value)} placeholder="https://… (imatge, GIF o vídeo)" aria-label={t('mediaUrl')} />
              <input ref={file} type="file" accept="image/*,video/mp4,video/webm" className="sr-only" aria-label={t('upload')} onChange={(ev) => ev.target.files?.[0] && upload(ev.target.files[0])} />
              <button type="button" className="btn btn-ghost" onClick={() => file.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp size={18} aria-hidden />} {t('upload')}</button>
            </div>
            {media && /\.(mp4|webm)(\?|$)/i.test(media) ? (
              <video src={media} controls className="mt-2 max-h-40 rounded-xl" />
            ) : media ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media} alt="" className="mt-2 max-h-40 rounded-xl" />
            ) : null}
          </div>
          {error && <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{error === 'in_use' ? t('inUse') : error}</p>}
          <div className="flex flex-wrap justify-between gap-2 sm:col-span-2">
            {e ? (
              <button type="button" className="btn btn-danger" onClick={() => start(async () => { const r = await deleteExercise(e.id); if (r.ok) onClose(); else setError(r.error ?? 'Error') })}><Trash2 size={16} aria-hidden /> {t('delete')}</button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : t('save')}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
