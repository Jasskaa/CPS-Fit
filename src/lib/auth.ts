import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MemberDetails, Profile, Role } from '@/lib/types'

export const getSessionProfile = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single<Profile>()
  return profile ? { userId, profile } : null
})

/** Exige sesión y uno de los roles indicados; si no, redirige. */
export async function requireRole(roles: Role[]) {
  const session = await getSessionProfile()
  if (!session) redirect('/login')
  if (!roles.includes(session.profile.role)) {
    redirect(session.profile.role === 'member' ? '/app' : '/admin')
  }
  return session
}

export async function getMemberDetails(memberId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('member_details').select('*').eq('member_id', memberId).single<MemberDetails>()
  return data
}
