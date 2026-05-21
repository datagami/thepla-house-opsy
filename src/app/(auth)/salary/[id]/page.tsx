import { SalaryDetails } from '@/components/salary/salary-details'
import { prisma } from '@/lib/prisma'
import { userIdentitySelect } from "@/lib/select-presets";
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
        select: {
          id: true,
          bonusAmount: true,
          referredUserId: true,
          referredUser: {
            select: {
              ...userIdentitySelect,
              status: true,
              doj: true,
            },
          },
        },
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
}: {
  params: Promise<{ id: string }>
}) {
  const {id} = await params;
  const {salary, canEdit, activeWarningCount} = await getSalaryDetails(id);

  return <SalaryDetails salary={salary} canEdit={canEdit} activeWarningCount={activeWarningCount} />
}
