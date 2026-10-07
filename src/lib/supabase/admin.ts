import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Solo servidor. Requiere SUPABASE_SERVICE_ROLE_KEY (nunca al cliente ni al repo). */
export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
