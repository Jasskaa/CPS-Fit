import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { makeCardToken } from '@/modules/access/qr'

// Devuelve el token rotatorio del carnet de la persona autenticada (o de la que indique ?person= si el usuario puede verla por RLS).
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  if (!auth?.claims?.sub) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const secret = process.env.CARD_QR_SECRET
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  const asked = new URL(req.url).searchParams.get('person')
  const query = supabase.from('people').select('id, first_name, last_name, status')
  const { data: p } = await (asked ? query.eq('id', asked) : query.eq('user_id', auth.claims.sub)).limit(1).maybeSingle()
  if (!p) return NextResponse.json({ error: 'no_person' }, { status: 404 })
  const { data: card } = await supabase.from('cards').select('number, status').eq('person_id', p.id).maybeSingle()
  return NextResponse.json(
    { token: await makeCardToken(secret, p.id), name: `${p.first_name} ${p.last_name}`, card: card?.number ?? null, cardStatus: card?.status ?? null, ttl: 60 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
