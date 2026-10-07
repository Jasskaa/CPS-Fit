import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// RGPD · derecho de acceso/portabilidad: descarga de todos los datos propios en JSON.
export async function GET() {
  const session = await getSessionProfile()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = await createClient()
  const id = session.userId
  const [profile, details, assignments, routines, sessions, records, measurements, comments] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id),
    supabase.from('member_details').select('*').eq('member_id', id),
    supabase.from('routine_assignments').select('*').eq('member_id', id),
    supabase.from('routines').select('*, routine_days(*, routine_exercises(*))').eq('owner_id', id),
    supabase.from('workout_sessions').select('*, workout_sets(*)').eq('member_id', id),
    supabase.from('personal_records').select('*').eq('member_id', id),
    supabase.from('body_measurements').select('*').eq('member_id', id),
    supabase.from('comments').select('*').eq('member_id', id),
  ])
  const body = {
    exportedAt: new Date().toISOString(),
    profile: profile.data, memberDetails: details.data, assignments: assignments.data, routines: routines.data,
    workoutSessions: sessions.data, personalRecords: records.data, bodyMeasurements: measurements.data, comments: comments.data,
  }
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="cpsfit-les-meves-dades.json"',
      'Cache-Control': 'no-store',
    },
  })
}
