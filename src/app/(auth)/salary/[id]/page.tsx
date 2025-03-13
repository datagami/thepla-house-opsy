import { SalaryDetails } from '@/components/salary/salary-details'
import { prisma } from '@/lib/prisma'
import {Salary} from "@/models/models";

async function getSalaryDetails(id: string) {
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
        }
      }
    }
  }) as Salary;

  console.log(salary);

  if (!salary) {
    throw new Error('Salary not found')
  }

  return {
    ...salary
  }
}

export default async function SalaryDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const {id} = await params;
  const salary = await getSalaryDetails(id);

  return <SalaryDetails salary={salary} />
} 
