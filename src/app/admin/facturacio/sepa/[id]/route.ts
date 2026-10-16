import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// Descarga del fichero pain.008 de una remesa (RLS: solo administración y junta).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireRole(['admin', 'board'])
  const supabase = await createClient()
  const { data } = await supabase.from('sepa_batches').select('reference, xml').eq('id', id).maybeSingle()
  if (!data?.xml) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return new NextResponse(data.xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${data.reference}.xml"`, 'Cache-Control': 'no-store' } })
}
