import { homeFor } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth'

export default async function Home() {
  const session = await getSessionProfile()
  if (!session) redirect('/login')
  redirect(homeFor(session.profile.role))
}
