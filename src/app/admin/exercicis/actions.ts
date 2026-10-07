'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const list = (v: FormDataEntryValue | null) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const opt = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null

const schema = z.object({
  name_ca: z.string().trim().min(1).max(120),
  name_es: z.string().trim().min(1).max(120),
  primary_muscle: z.string().trim().min(1).max(40),
  equipment: z.string().trim().min(1).max(60),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
})

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export async function saveExercise(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireRole(['admin', 'trainer'])
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const id = opt(fd.get('id'))
  const row = {
    ...parsed.data,
    secondary_muscles: list(fd.get('secondary_muscles')),
    tags: list(fd.get('tags')),
    description_ca: opt(fd.get('description_ca')), description_es: opt(fd.get('description_es')),
    tips_ca: opt(fd.get('tips_ca')), tips_es: opt(fd.get('tips_es')),
    mistakes_ca: opt(fd.get('mistakes_ca')), mistakes_es: opt(fd.get('mistakes_es')),
    media_url: opt(fd.get('media_url')),
    is_timed: fd.get('is_timed') === 'on',
  }
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('exercises').update(row).eq('id', id)
    : await supabase.from('exercises').insert({ ...row, slug: `${slugify(row.name_ca)}-${Math.random().toString(36).slice(2, 6)}`, created_by: userId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/exercicis')
  return { ok: true }
}

export async function deleteExercise(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) return { ok: false, error: error.code === '23503' ? 'in_use' : error.message }
  revalidatePath('/admin/exercicis')
  return { ok: true }
}
