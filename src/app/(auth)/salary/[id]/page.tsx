import { SalaryDetails } from '@/components/salary/salary-details'
import { prisma } from '@/lib/prisma'
import {Salary} from "@/models/models";
import { auth } from '@/auth'

async function getSalaryDetails(id: string) {
  const session = await auth();

  //@ts-expect-error - role is not defined in the session type
  const role = session?.user?.role;
  const salary = await prisma.salary.findUnique({
    where: { id },
    include: {
      user: true,
      installments: {
        where: {
          OR: [
            { status: 'PENDING' },
            { status: 'APPROVED' }
          ]
        },
        include: {
          advance: true
        }
      },
      referrals: {
        include: {
          referredUser: true,
        }
      }
    }
  }) as unknown as Salary;

  if (!salary) {
    throw new Error('Salary not found')
  }

  const activeWarningCount = await prisma.warning.count({
    where: { userId: salary.userId, isArchived: false },
  });

  return {
    salary,
    canEdit: role === 'HR' || role === 'MANAGEMENT',
    activeWarningCount,
  }
}

export default async function SalaryDetailsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const {id} = await params;
  const {month, year} = await searchParams;
  const {salary, canEdit, activeWarningCount} = await getSalaryDetails(id);

  return <SalaryDetails salary={salary} month={month} year={year} canEdit={canEdit} activeWarningCount={activeWarningCount} />
} 
