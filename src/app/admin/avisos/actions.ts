'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const opt = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null
const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '')
  return s ? new Date(s).toISOString() : null
}

export async function createAnnouncement(fd: FormData) {
  const { userId } = await requireRole(['admin', 'trainer'])
  const title = String(fd.get('title_ca') ?? '').trim()
  if (!title) return
  const supabase = await createClient()
  await supabase.from('announcements').insert({
    title_ca: title.slice(0, 120), title_es: opt(fd.get('title_es')),
    body_ca: opt(fd.get('body_ca')), body_es: opt(fd.get('body_es')),
    starts_at: date(fd.get('starts_at')) ?? new Date().toISOString(), ends_at: date(fd.get('ends_at')),
    pinned: fd.get('pinned') === 'on', created_by: userId,
  })
  revalidatePath('/admin/avisos')
  revalidatePath('/app')
}

export async function deleteAnnouncement(id: string) {
  await requireRole(['admin', 'trainer'])
  const supabase = await createClient()
  await supabase.from('announcements').delete().eq('id', id)
  revalidatePath('/admin/avisos')
  revalidatePath('/app')
}
