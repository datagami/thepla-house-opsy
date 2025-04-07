'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SalaryStatsDTO, fetchSalaryStats } from '@/lib/types/salary-stats.dto'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface SalaryStatsTableProps {
  salaryId: string
}

export function SalaryStatsTable({ salaryId }: SalaryStatsTableProps) {
  const [stats, setStats] = useState<SalaryStatsDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true)
        const data = await fetchSalaryStats(salaryId)
        setStats(data)
        setError(null)
      } catch (err) {
        console.error('Failed to load salary stats:', err)
        setError('Failed to load salary calculation details')
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [salaryId])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-1/3" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-1/2" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary Calculation Details</CardTitle>
        <CardDescription>
          Detailed breakdown of salary calculation for {stats.employee.name} - 
          {new Date(stats.salary.year, stats.salary.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Employee Information */}
          <div>
            <h3 className="text-lg font-medium mb-2">Employee Information</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Base Salary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{stats.employee.id}</TableCell>
                  <TableCell>{stats.employee.name}</TableCell>
                  <TableCell>{stats.employee.email}</TableCell>
                  <TableCell>{formatCurrency(stats.salary.baseSalary)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Attendance Summary */}
          <div>
            <h3 className="text-lg font-medium mb-2">Attendance Summary</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regular Days</TableHead>
                  <TableHead>Half Days</TableHead>
                  <TableHead>Overtime Days</TableHead>
                  <TableHead>Leave Days</TableHead>
                  <TableHead>Absent Days</TableHead>
                  <TableHead>Total Present</TableHead>
                  <TableHead>Total Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{stats.attendance.regularDays}</TableCell>
                  <TableCell>{stats.attendance.halfDays}</TableCell>
                  <TableCell>{stats.attendance.overtimeDays}</TableCell>
                  <TableCell>{stats.attendance.leaveDays}</TableCell>
                  <TableCell>{stats.attendance.absentDays}</TableCell>
                  <TableCell>{stats.attendance.presentDays.toFixed(1)}</TableCell>
                  <TableCell>{stats.attendance.totalDaysInMonth}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Salary Calculation */}
          <div>
            <h3 className="text-lg font-medium mb-2">Salary Calculation</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Calculation</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Per Day Salary</TableCell>
                  <TableCell>{formatCurrency(stats.salary.baseSalary)} ÷ {stats.attendance.totalDaysInMonth} days</TableCell>
                  <TableCell>{formatCurrency(stats.calculation.perDaySalary)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Present Days Salary (A)</TableCell>
                  <TableCell>{stats.attendance.presentDays.toFixed(1)} days × {formatCurrency(stats.calculation.perDaySalary)}</TableCell>
                  <TableCell className="text-green">{formatCurrency(stats.calculation.presentDaysSalary)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Overtime Bonus (B)</TableCell>
                  <TableCell>{stats.attendance.overtimeDays} days × 0.5 × {formatCurrency(stats.calculation.perDaySalary)}</TableCell>
                  <TableCell className="text-green">{formatCurrency(stats.calculation.overtimeSalary)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Other Bonuses (C)</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-green">{formatCurrency(stats.salary.otherBonuses)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Earned Leaves (D)</TableCell>
                  <TableCell>{stats.calculation.leavesEarned} days × {formatCurrency(stats.calculation.perDaySalary)}</TableCell>
                  <TableCell className="text-green">{formatCurrency(stats.calculation.leaveSalary)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">Base Salary Earned</TableCell>
                  <TableCell>A + B + C + D</TableCell>
                  <TableCell className="font-medium">{formatCurrency(stats.calculation.baseSalaryEarned)}</TableCell>
                </TableRow>
                <TableRow className="text-destructive">
                  <TableCell>Deductions (E)</TableCell>
                  <TableCell>
                    Approved Advance Payment Installments
                    ({stats.deductions.filter(d => d.status === 'APPROVED').length} of {stats.deductions.length})
                  </TableCell>
                  <TableCell className="text-destructive">- {formatCurrency(stats.calculation.totalAdvanceDeductions)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Other Deductions (F)</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-destructive">- {formatCurrency(stats.calculation.totalOtherDeductions)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">Total Deductions</TableCell>
                  <TableCell>E + F</TableCell>
                  <TableCell className="font-medium">{formatCurrency(stats.calculation.totalDeductions)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">Net Salary</TableCell>
                  <TableCell className="font-medium">Base Salary Earned - Total Deductions</TableCell>
                  <TableCell className="font-bold">{formatCurrency(stats.calculation.netSalary)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Deductions */}
          <div>
            <h3 className="text-lg font-medium mb-2">Advance Payment Deductions</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advance Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approved Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.deductions.length > 0 ? (
                  stats.deductions.map((deduction) => (
                    <TableRow key={deduction.id}>
                      <TableCell>{deduction.advanceTitle}</TableCell>
                      <TableCell>{formatCurrency(deduction.amount)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          deduction.status === 'APPROVED' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {deduction.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {deduction.approvedAt 
                          ? new Date(deduction.approvedAt).toLocaleDateString() 
                          : 'Pending'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      No advance payment deductions for this salary
                    </TableCell>
                  </TableRow>
                )}
                {stats.deductions.length > 0 && (
                  <TableRow className="font-medium bg-muted/50">
                    <TableCell colSpan={1}>Total Deductions</TableCell>
                    <TableCell colSpan={3} className="text-right">
                      {formatCurrency(stats.calculation.totalDeductions)}
                      <span className="text-sm text-muted-foreground ml-2">
                        (Only approved deductions are counted in final salary)
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
