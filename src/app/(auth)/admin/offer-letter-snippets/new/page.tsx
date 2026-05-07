import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SnippetForm } from '@/components/admin/offer-letter-snippets/snippet-form'

export default async function NewSnippetPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // @ts-expect-error - role is not in the User type
  if (!['HR', 'MANAGEMENT'].includes(session.user.role)) redirect('/dashboard')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">New Offer Letter Snippet</h1>
      <SnippetForm />
    </div>
  )
}
