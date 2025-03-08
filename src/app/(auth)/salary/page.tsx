import { SalaryManagement } from '@/components/salary/salary-management'

import { redirect } from 'next/navigation'
import {auth} from "@/auth";

export default async function SalaryPage() {
  const session = await auth();
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Salary Management</h1>
      <SalaryManagement />
    </div>
  )
} 
