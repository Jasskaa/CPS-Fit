import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth'

export default async function Home() {
  const session = await getSessionProfile()
  if (!session) redirect('/login')
  redirect(session.profile.role === 'member' ? '/app' : '/admin')
}
