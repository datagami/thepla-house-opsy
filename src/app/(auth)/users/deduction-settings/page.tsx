import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { DeductionSettingsPage } from '@/components/users/deduction-settings-page'

export default async function Page() {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    redirect('/dashboard')
  }
  return <DeductionSettingsPage />
}
