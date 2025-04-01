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
        },
        include: {
          advance: true
        }
      }
    }
  }) as unknown as Salary;

  if (!salary) {
    throw new Error('Salary not found')
  }

  return salary;
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
  const salary = await getSalaryDetails(id);

  return <SalaryDetails salary={salary} month={month} year={year} />
} 
