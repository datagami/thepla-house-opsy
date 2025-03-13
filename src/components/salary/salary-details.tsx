'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { CalendarIcon, AlertCircle, Edit, Save, X, CheckCircle } from 'lucide-react'
import { Progress } from "@/components/ui/progress"
import { AdvancePaymentInstallment, Salary } from "@/models/models"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from 'sonner';

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
  const [editMode, setEditMode] = useState(false)
  const [advanceDeductions, setAdvanceDeductions] = useState<Array<{
    advanceId: string;
    amount: number;
    id: string;
    originalAmount: number;
  }>>([])
  const [confirmReject, setConfirmReject] = useState<AdvancePaymentInstallment | null>(null)

  // Initialize advance deductions from salary installments
  useEffect(() => {
    if (salary.installments) {
      setAdvanceDeductions(
        salary.installments.map(installment => ({
          advanceId: installment.advanceId,
          amount: installment.amountPaid,
          id: installment.id,
          originalAmount: installment.amountPaid
        }))
      )
    }
  }, [salary.installments])

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

  const handleAdvanceInstallment = async (action: 'APPROVE' | 'REJECT', installment: AdvancePaymentInstallment) => {
    try {
      setIsUpdating(true)
      
      // Close dialog if rejecting
      if (action === 'REJECT') {
        setConfirmReject(null)
      }
      
      const response = await fetch(`/api/salary/${salary.id}/advance-installment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          installmentId: installment.id,
          action 
        }),
      })

      if (response.ok) {
        toast.success(`Installment ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`)
        router.refresh()
      } else {
        const error = await response.text()
        toast.error(error || `Failed to ${action.toLowerCase()} installment`)
      }
    } catch (error) {
      console.error('Error updating advance installment:', error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsUpdating(false)
    }
  }

  // Handle amount change for an advance deduction
  const handleAmountChange = (id: string, newAmount: number) => {
    setAdvanceDeductions(prev => 
      prev.map(item => 
        item.id === id ? { ...item, amount: newAmount } : item
      )
    )
  }

  // Save updated advance deductions
  const saveAdvanceDeductions = async () => {
    try {
      setIsUpdating(true)
      
      // Format the data for the API
      const deductionsForApi = advanceDeductions.map(item => ({
        advanceId: item.advanceId,
        amount: item.amount
      }))
      
      const response = await fetch('/api/salary/generate', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salaryId: salary.id,
          advanceDeductions: deductionsForApi
        }),
      })

      if (response.ok) {
        toast.success("Advance deductions updated successfully")
        setEditMode(false)
        router.refresh()
      } else {
        const error = await response.text()
        toast.error(error || "Failed to update advance deductions")
      }
    } catch (error) {
      console.error('Error updating advance deductions:', error)
      toast.error("An unexpected error occurred",)
    } finally {
      setIsUpdating(false)
    }
  }

  // Remove an advance deduction
  const removeAdvanceDeduction = (id: string) => {
    setAdvanceDeductions(prev => prev.filter(item => item.id !== id))
  }

  const renderAdvanceInstallmentSection = () => {
    if (!salary.installments || salary.installments.length === 0) return null

    // Group installments by status for better organization
    const pendingInstallments = salary.installments.filter(i => i.status === 'PENDING');
    const approvedInstallments = salary.installments.filter(i => i.status === 'APPROVED');
    const hasInstallments = pendingInstallments.length > 0 || approvedInstallments.length > 0;

    if (!hasInstallments && !editMode) return null;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Advance Payment Installments</CardTitle>
            <CardDescription>
              {editMode ? 'Edit installments for this salary period' : 
               pendingInstallments.length > 0 ? 'Pending installments require approval' : 
               'Approved installments for this salary period'}
            </CardDescription>
          </div>
          {salary.status === 'PENDING' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setEditMode(!editMode)}
              disabled={isUpdating}
            >
              {editMode ? <X className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
              {editMode ? 'Cancel' : 'Edit'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {editMode ? (
              // Edit mode view
              advanceDeductions.length > 0 ? (
                advanceDeductions.map((deduction) => (
                  <div key={deduction.id} className="flex items-center space-x-4 p-4 border rounded-md">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Advance Installment</p>
                      <p className="text-sm text-muted-foreground">Original: {formatCurrency(deduction.originalAmount)}</p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={deduction.amount}
                        onChange={(e) => handleAmountChange(deduction.id, parseFloat(e.target.value) || 0)}
                        min="0"
                        step="100"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAdvanceDeduction(deduction.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No advance installments to edit
                </div>
              )
            ) : (
              // View mode - show pending and approved separately
              <div className="space-y-6">
                {pendingInstallments.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Pending Approval</h4>
                    {pendingInstallments.map((installment) => (
                      <Alert 
                        key={installment.id}
                        variant="default"
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex-1">
                          <AlertCircle className="h-4 w-4 mb-2" />
                          <AlertTitle>Pending Installment</AlertTitle>
                          <AlertDescription>
                            Amount: {formatCurrency(installment.amountPaid)}
                          </AlertDescription>
                        </div>
                        {salary.status === 'PENDING' && (
                          <div className="flex gap-2 mt-2 sm:mt-0">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAdvanceInstallment('APPROVE', installment)}
                              disabled={isUpdating}
                            >
                              {isUpdating ? 'Processing...' : 'Approve'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setConfirmReject(installment)}
                              disabled={isUpdating}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </Alert>
                    ))}
                  </div>
                )}
                
                {approvedInstallments.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Approved Installments</h4>
                    {approvedInstallments.map((installment) => (
                      <Alert 
                        key={installment.id}
                        variant="success"
                        className="bg-green-50 border-green-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <AlertTitle>Approved Installment</AlertTitle>
                          </div>
                          <AlertDescription>
                            <p>Amount: {formatCurrency(installment.amountPaid)}</p>
                            {installment.approvedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Approved on: {new Date(installment.approvedAt).toLocaleDateString()}
                              </p>
                            )}
                          </AlertDescription>
                        </div>
                      </Alert>
                    ))}
                  </div>
                )}
                
                {pendingInstallments.length === 0 && approvedInstallments.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No advance installments for this salary period
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
        {editMode && advanceDeductions.length > 0 && (
          <CardFooter>
            <Button 
              onClick={saveAdvanceDeductions} 
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
              {!isUpdating && <Save className="ml-2 h-4 w-4" />}
            </Button>
          </CardFooter>
        )}
      </Card>
    )
  }

  // Render confirmation dialog
  const renderConfirmationDialog = () => {
    return (
      <Dialog open={!!confirmReject} onOpenChange={(open) => !open && setConfirmReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rejection</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this advance installment? 
              This will remove the deduction of {confirmReject && formatCurrency(confirmReject.amountPaid)} 
              from this salary period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmReject(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => confirmReject && handleAdvanceInstallment('REJECT', confirmReject)}
              disabled={isUpdating}
            >
              {isUpdating ? 'Processing...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="container mx-auto p-10 space-y-6">
      {renderConfirmationDialog()}
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
                <span>({(salary.baseSalary / totalDaysInMonth).toFixed(2)} per day)</span>
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
              {salary.leavesEarned > 0 && (
                <div className="flex justify-between">
                  <span>Earned Leaves ({salary.leavesEarned} days):</span>
                  <span className="text-green-500">{formatCurrency(salary.leaveSalary)}</span>
                </div>
              )}
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

          {/* Earned Leaves Section */}
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Earned Leaves</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  {salary.leavesEarned} {salary.leavesEarned === 1 ? 'day' : 'days'} earned this month
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {attendanceStats.regularDays + attendanceStats.overtime + attendanceStats.halfDay} days present
                  {attendanceStats.regularDays + attendanceStats.overtime + attendanceStats.halfDay >= 25 
                    ? ' (2 leaves earned for 25+ days)'
                    : attendanceStats.regularDays + attendanceStats.overtime + attendanceStats.halfDay >= 15
                      ? ' (1 leave earned for 15-24 days)'
                      : ' (no leaves earned for <15 days)'}
                </p>
              </div>
              <Badge variant="outline" className="bg-green-50">
                +{formatCurrency(salary.leaveSalary)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {renderAdvanceInstallmentSection()}

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
                <span>({(salary.baseSalary / totalDaysInMonth).toFixed(2)} per day)</span>
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
              {salary.leavesEarned > 0 && (
                <div className="flex justify-between">
                  <span>Earned Leaves ({salary.leavesEarned} days):</span>
                  <span className="text-green-500">{formatCurrency(salary.leaveSalary)}</span>
                </div>
              )}
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
