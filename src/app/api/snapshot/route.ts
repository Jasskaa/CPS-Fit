import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { buildSnapshot } from '@/lib/snapshot'

export async function GET() {
  const session = await getSessionProfile()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const snap = await buildSnapshot(supabase, session.userId, session.profile.locale, session.profile.units)
  return NextResponse.json(snap, { headers: { 'Cache-Control': 'no-store' } })
}
