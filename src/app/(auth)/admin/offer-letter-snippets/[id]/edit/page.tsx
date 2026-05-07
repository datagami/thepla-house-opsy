import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { SnippetForm } from '@/components/admin/offer-letter-snippets/snippet-form'

interface PageProps { params: Promise<{ id: string }> }

export default async function EditSnippetPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // @ts-expect-error - role is not in the User type
  if (!['HR', 'MANAGEMENT'].includes(session.user.role)) redirect('/dashboard')

  const { id } = await params
  const snippet = await prisma.offerLetterSnippet.findUnique({ where: { id } })
  if (!snippet) notFound()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Edit Offer Letter Snippet</h1>
      <SnippetForm snippet={{
        id: snippet.id,
        title: snippet.title,
        category: snippet.category,
        htmlBody: snippet.htmlBody,
        isActive: snippet.isActive,
        sortOrder: snippet.sortOrder,
      }} />
    </div>
  )
}
