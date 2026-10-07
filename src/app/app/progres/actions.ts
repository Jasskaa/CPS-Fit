'use server'

import { revalidatePath } from 'next/cache'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const FIELDS = ['weight_kg', 'body_fat_pct', 'waist_cm', 'chest_cm', 'hip_cm', 'arm_cm', 'thigh_cm'] as const

export async function addMeasurement(fd: FormData) {
  const session = await getSessionProfile()
  if (!session) return
  const row: Record<string, number | string> = { member_id: session.userId }
  let any = false
  for (const f of FIELDS) {
    const raw = String(fd.get(f) ?? '').replace(',', '.')
    const n = Number(raw)
    if (raw !== '' && Number.isFinite(n) && n > 0 && n < 1000) { row[f] = n; any = true }
  }
  if (!any) return
  const supabase = await createClient()
  await supabase.from('body_measurements').insert(row)
  revalidatePath('/app/progres')
}
