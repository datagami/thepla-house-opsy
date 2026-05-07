import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SnippetList } from '@/components/admin/offer-letter-snippets/snippet-list'

export default async function OfferLetterSnippetsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // @ts-expect-error - role is not in the User type
  if (!['HR', 'MANAGEMENT'].includes(session.user.role)) redirect('/dashboard')

  return (
    <div className="p-8">
      <SnippetList />
    </div>
  )
}
