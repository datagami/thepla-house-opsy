import { redirect } from 'next/navigation'
import { auth } from '@/auth'

// Minimal layout for printable / standalone pages — no app header,
// no sidebar, no toasts. Just the page content.
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')
  return <>{children}</>
}
