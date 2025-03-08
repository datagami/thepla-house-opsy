import { notFound } from 'next/navigation'
import { SalaryDetails } from '@/components/salary/salary-details'
import { prisma } from '@/lib/prisma'
import {Salary} from "@/models/models";

async function getAttendanceStats(userId: string, month: Date) {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)

  const attendances = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  })


  const stats = {
    regularDays: 0,
    absent: 0,
    halfDay: 0,
    leave: 0,
    overtime: 0,
    total: endOfMonth.getDate(), // Total days in month
  }

  attendances.forEach((attendance) => {

    if (attendance.overtime) {
      stats.overtime++;
    }

    if (!attendance.isPresent) {
      stats.absent++
    }

    if (attendance.isHalfDay) {
      stats.halfDay++
    }
  });

  stats.regularDays = stats.total - stats.absent - stats.halfDay - stats.overtime;

  return stats
}

export default async function SalaryDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const {id} = await params;
  const salary = await prisma.salary.findUnique({
    where: { id: id },
    include: {
      user: true
    },
  }) as Salary;

  if (!salary) {
    notFound()
  }

  const attendanceStats = await getAttendanceStats(salary.user?.id, new Date(`${salary.year}-${salary.month}-15`))

  return <SalaryDetails salary={salary} attendanceStats={attendanceStats} />
} 
