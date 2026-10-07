'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Camera, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PhotoRow } from '@/lib/progress-data'

/** Fotos de progreso: opcionales y privadas por defecto (bucket privado, URLs firmadas de corta vida). */
export function Photos({ photos, memberId, readOnly, locale }: { photos: PhotoRow[]; memberId: string; readOnly: boolean; locale: string }) {
  const t = useTranslations('progress')
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!photos.length) return
    const supabase = createClient()
    supabase.storage.from('progress-photos').createSignedUrls(photos.map((p) => p.path), 600).then(({ data }) => {
      const map: Record<string, string> = {}
      data?.forEach((d) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl })
      setUrls(map)
    })
  }, [photos])

  async function upload(file: File) {
    if (file.size > 6 * 1024 * 1024) return setError(true)
    setBusy(true)
    setError(false)
    const supabase = createClient()
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${memberId}/${Date.now()}.${ext}`
    const up = await supabase.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) { setBusy(false); return setError(true) }
    const { error: dbErr } = await supabase.from('progress_photos').insert({ member_id: memberId, storage_path: path })
    setBusy(false)
    if (dbErr) setError(true)
    else router.refresh()
  }

  return (
    <section className="card space-y-3 p-4" aria-labelledby="photos">
      <div className="flex items-center justify-between gap-2">
        <h3 id="photos" className="font-display text-2xl font-bold">{t('photos')}</h3>
        <span className="chip"><Lock size={12} aria-hidden /> {t('private')}</span>
      </div>
      <p className="text-xs text-muted">{readOnly ? t('photosTrainerHint') : t('photosHint')}</p>
      {!readOnly && (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" aria-label={t('addPhoto')} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className="btn btn-ghost w-full" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera size={18} aria-hidden />} {t('addPhoto')}
          </button>
          {error && <p role="alert" className="text-sm text-danger">{t('photoError')}</p>}
        </>
      )}
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
              {urls[p.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[p.path]} alt={t('photoOf', { date: new Date(p.taken_at).toLocaleDateString(locale) })} className="h-full w-full object-cover" loading="lazy" />
              ) : <div className="skeleton h-full w-full" />}
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] font-semibold text-white">{new Date(p.taken_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
