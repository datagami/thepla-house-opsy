'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { CalendarIcon } from 'lucide-react'
import { Progress } from "@/components/ui/progress"
import {Salary} from "@/models/models";

interface SalaryDetailsProps {
  salary: Salary
  attendanceStats: {
    regularDays: number
    absent: number
    halfDay: number
    leave: number
    total: number
    overtime: number
  }
}

function daysInMonth (month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function SalaryDetails({ salary, attendanceStats }: SalaryDetailsProps) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  const handleUpdateStatus = async () => {
    try {
      setIsUpdating(true)
      const response = await fetch(`/api/salary/${salary.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'PROCESSING' }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating salary status:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const calculatePercentage = (value: number) => {
    return ((value / attendanceStats.total) * 100).toFixed(1)
  }

  const totalDaysInMonth = daysInMonth(salary.month, salary.year)

  return (
    <div className="container mx-auto p-10 space-y-6">
      <Card>
        <CardHeader>
          {salary.user && salary.user.name && <CardTitle>Salary Details - {salary.user.name}</CardTitle>}
          <CardDescription>
            For {new Date(salary.year + '-' + salary.month + '-' + '15').toLocaleString('default', { month: 'long', year: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Status:</span>
              <Badge variant={
                salary.status === 'PAID' ? 'default' :
                salary.status === 'PROCESSING' ? 'secondary' :
                salary.status === 'FAILED' ? 'destructive' :
                'outline'
              }>
                {salary.status}
              </Badge>
            </div>
            
            <div className="grid gap-4">
              <div className="flex justify-between">
                <span>Base Salary:</span>
                <span>{formatCurrency(salary.baseSalary)}</span>
                <span>({(salary.baseSalary / totalDaysInMonth).toFixed(2) } per day)</span>
              </div>
              <div className="flex justify-between">
                <span>Regular Day Salary:</span>
                <span className="text-green-500">{formatCurrency(attendanceStats.regularDays * (salary.baseSalary / totalDaysInMonth))}</span>
              </div>
              <div className="flex justify-between">
                <span>Overtime Salary:</span>
                <span className="text-green-500">{formatCurrency(attendanceStats.overtime * 1.5 * (salary.baseSalary / totalDaysInMonth))}</span>
              </div>
              <div className="flex justify-between">
                <span>Half Day Salary:</span>
                <span className="text-green-500">{formatCurrency(attendanceStats.halfDay * 0.5 * (salary.baseSalary / totalDaysInMonth))}</span>
              </div>
              <div className="flex justify-between">
                <span>Deductions:</span>
                <span className="text-red-500">
                  -{formatCurrency(salary.deductions)}
                </span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Net Salary:</span>
                <span>{formatCurrency(salary.netSalary)}</span>
              </div>
            </div>

            {salary.status === 'PENDING' && (
              <Button
                onClick={handleUpdateStatus}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : 'Move to Processing'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Attendance Overview
          </CardTitle>
          <CardDescription>
            Monthly attendance breakdown affecting salary calculation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Present Days */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Regular Days</span>
              <span className="font-medium">
                {attendanceStats.regularDays} days ({calculatePercentage(attendanceStats.regularDays)}%)
              </span>
            </div>
            <Progress value={Number(calculatePercentage(attendanceStats.regularDays))} className="h-2"/>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Overtimes Days</span>
              <span className="font-medium">
                {attendanceStats.overtime} days ({calculatePercentage(attendanceStats.overtime)}%)
              </span>
            </div>
            <Progress value={Number(calculatePercentage(attendanceStats.overtime))} className="h-2"/>
          </div>

          {/* Half Days */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Half Days</span>
              <span className="font-medium">
                {attendanceStats.halfDay} days ({calculatePercentage(attendanceStats.halfDay)}%)
              </span>
            </div>
            <Progress value={Number(calculatePercentage(attendanceStats.halfDay))} className="h-2"/>
          </div>

          {/* Absents */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Absents</span>
              <span className="font-medium text-destructive">
                {attendanceStats.absent} days ({calculatePercentage(attendanceStats.absent)}%)
              </span>
            </div>
            <Progress value={Number(calculatePercentage(attendanceStats.absent))} className="h-2"/>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Salary Breakdown</CardTitle>
          <CardDescription>Detailed calculation of the final salary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="flex justify-between">
                <span>Base Salary:</span>
                <span>{formatCurrency(salary.baseSalary)}</span>
              </div>


              <div className="border-t pt-4 flex justify-between font-bold">
                <span>Net Salary:</span>
                <span>{formatCurrency(salary.netSalary)}</span>
              </div>
            </div>

            {salary.status === 'PENDING' && (
              <Button
                onClick={handleUpdateStatus}
                disabled={isUpdating}
                className="w-full mt-6"
              >
                {isUpdating ? 'Updating...' : 'Move to Processing'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
