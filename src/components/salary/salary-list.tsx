'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Salary } from "@/models/models"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PencilIcon } from 'lucide-react'

interface SalaryListProps {
  month: number
  year: number
}

export function SalaryList({ month, year }: SalaryListProps) {
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (month && year) {
      fetchSalaries()
    }
  }, [month, year])

  const fetchSalaries = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/salary?month=${month}&year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setSalaries(data)
      }
    } catch (error) {
      console.error('Error fetching salaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  if (!month || !year) {
    return null
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Base Salary</TableHead>
            <TableHead className="text-right">
              Deductions
              <HoverCard>
                <HoverCardTrigger>
                  <InfoIcon className="h-4 w-4 ml-1 inline-block text-muted-foreground" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Deduction Breakdown</h4>
                    <p className="text-sm text-muted-foreground">
                      • Attendance based deductions
                      <br />
                      • Advance/EMI deductions
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </TableHead>
            <TableHead className="text-right">
              Bonuses
              <HoverCard>
                <HoverCardTrigger>
                  <InfoIcon className="h-4 w-4 ml-1 inline-block text-muted-foreground" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Bonus Breakdown</h4>
                    <p className="text-sm text-muted-foreground">
                      • Overtime bonus (50% of per day salary)
                      <br />
                      • Performance bonus
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </TableHead>
            <TableHead>Net Salary</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {salaries.map((salary: Salary) => (
            <TableRow key={salary.id}>
              <TableCell>{salary.user.name}</TableCell>
              <TableCell>{formatCurrency(salary.baseSalary)}</TableCell>
              <TableCell className="text-right">
                <HoverCard>
                  <HoverCardTrigger className="cursor-help">
                    {formatCurrency(salary.deductions)}
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Deduction Details</h4>
                      <div className="text-sm">
                        <div className="flex justify-between">
                          <span>Attendance Deductions:</span>
                          <span>{formatCurrency(salary.attendanceDeduction || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Advance/EMI:</span>
                          <span>{formatCurrency(salary.advanceDeduction || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </TableCell>
              <TableCell className="text-right">
                <HoverCard>
                  <HoverCardTrigger className="cursor-help">
                    {formatCurrency(salary.bonuses)}
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Bonus Details</h4>
                      <div className="text-sm">
                        <div className="flex justify-between">
                          <span>Overtime Bonus:</span>
                          <span>{formatCurrency(salary.overtimeBonus || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Performance Bonus:</span>
                          <span>{formatCurrency(salary.performanceBonus || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </TableCell>
              <TableCell>{formatCurrency(salary.netSalary)}</TableCell>
              <TableCell>
                <Badge variant={
                  salary.status === 'PAID' ? 'default' :
                  salary.status === 'PROCESSING' ? 'secondary' :
                  salary.status === 'FAILED' ? 'destructive' :
                  'outline'
                }>
                  {salary.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <Link href={`/salary/${salary.id}`}>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Details
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
} 
