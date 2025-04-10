import { SalaryManagement } from '@/components/salary/salary-management'
import { redirect } from 'next/navigation'
import { auth } from "@/auth"

// Add searchParams to get URL parameters
export default async function SalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; }>
}) {
  const session = await auth();
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    redirect('/dashboard')
  }
  const {year, month} = await searchParams;

  // Pass the selected year and month from URL to SalaryManagement
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Salary Management</h1>
      </div>
      <SalaryManagement 
        initialYear={year ? parseInt(year) : undefined}
        initialMonth={month ? parseInt(month) : undefined}
      />
    </div>
  )
} 
