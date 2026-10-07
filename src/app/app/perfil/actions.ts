'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin'

const schema = z.object({
  full_name: z.string().trim().min(1).max(80),
  goal: z.string().trim().max(120).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  days_per_week: z.coerce.number().int().min(1).max(7),
  limitations: z.string().trim().max(500).optional(),
  units: z.enum(['kg', 'lb']),
})

export async function saveProfile(fd: FormData) {
  const session = await getSessionProfile()
  if (!session) return
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return
  const p = parsed.data
  const supabase = await createClient()
  await supabase.from('profiles').update({ full_name: p.full_name, units: p.units }).eq('id', session.userId)
  await supabase.from('member_details').update({
    goal: p.goal || null, level: p.level, days_per_week: p.days_per_week,
    limitations: p.limitations || null, shares_photos: fd.get('shares_photos') === 'on',
  }).eq('member_id', session.userId)
  revalidatePath('/app', 'layout')
}

/** RGPD · derecho de supresión. Con service role se borra también el usuario de Auth. */
export async function deleteAccount() {
  const session = await getSessionProfile()
  if (!session) return { ok: false }
  const supabase = await createClient()
  if (hasServiceRole()) {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(session.userId) // cascada a profiles y datos
    if (error) return { ok: false }
  } else {
    // Sin service role: se borran todos los datos (cascada desde profiles) y se cierra sesión.
    const { error } = await supabase.from('profiles').delete().eq('id', session.userId)
    if (error) return { ok: false }
  }
  await supabase.auth.signOut()
  redirect('/login')
}
