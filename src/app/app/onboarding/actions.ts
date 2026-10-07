'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  goal: z.string().trim().min(1).max(120),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  days_per_week: z.coerce.number().int().min(1).max(7),
  limitations: z.string().trim().max(500).optional(),
})

export async function completeOnboarding(fd: FormData) {
  const session = await getSessionProfile()
  if (!session) redirect('/login')
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return
  const supabase = await createClient()
  await supabase.from('member_details').update({ ...parsed.data, limitations: parsed.data.limitations || null }).eq('member_id', session.userId)
  redirect('/app')
}
