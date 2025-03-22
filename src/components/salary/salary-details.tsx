'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, DollarSign, ArrowLeft } from 'lucide-react'
import { AdvancePaymentInstallment, Salary } from "@/models/models"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from 'sonner';
import { SalaryStatsTable } from '@/components/salary/salary-stats-table'
import { Input } from "@/components/ui/input"

interface SalaryDetailsProps {
  salary: Salary;
  month?: string;
  year?: string;
}

export function SalaryDetails({ salary, month, year }: SalaryDetailsProps) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [, setAdvanceDeductions] = useState<Array<{
    advanceId: string;
    amount: number;
    id: string;
    originalAmount: number;
  }>>([])
  const [confirmReject, setConfirmReject] = useState<AdvancePaymentInstallment | null>(null)
  const [editingInstallment, setEditingInstallment] = useState<{
    id: string;
    amountPaid: number;
    originalAmount: number;
    advanceRemainingAmount: number;
  } | null>(null)

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
      const response = await fetch('/api/salary/generate', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          salaryId: salary.id,
          status: 'PROCESSING'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to update status')
      }

      toast.success('Salary moved to processing')
      router.refresh()
    } catch (error) {
      console.error('Error updating salary status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleInstallmentAction = async (installmentId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      setIsUpdating(true)
      
      if (action === 'REJECT') {
        setConfirmReject(null)
      }
      
      const response = await fetch('/api/salary/generate', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          salaryId: salary.id,
          installmentId,
          installmentAction: action
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || `Failed to ${action.toLowerCase()} installment`)
      }
      
      toast.success(`Installment ${action.toLowerCase()}ed successfully`)
      router.refresh()
    } catch (error) {
      console.error(`Error ${action.toLowerCase()}ing installment:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to ${action.toLowerCase()} installment`)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleBack = () => {
    // Preserve the year and month when going back
    const params = new URLSearchParams()
    if (year) params.set('year', year)
    if (month) params.set('month', month)
    
    const queryString = params.toString()
    router.push(`/salary${queryString ? `?${queryString}` : ''}`)
  }

  const handleEditInstallment = async (newAmount: number) => {
    if (!editingInstallment) return

    try {
      setIsUpdating(true)
      const response = await fetch('/api/salary/generate', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          salaryId: salary.id,
          installmentId: editingInstallment.id,
          installmentAction: 'EDIT',
          amount: newAmount
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to update installment')
      }

      toast.success('Installment amount updated successfully')
      setEditingInstallment(null)
      router.refresh()
    } catch (error) {
      console.error('Error updating installment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update installment')
    } finally {
      setIsUpdating(false)
    }
  }

  const renderAdvanceInstallments = () => {
    if (!salary.installments || salary.installments.length === 0) {
      return null
    }

    // Group installments by status
    const pendingInstallments = salary.installments.filter(i => i.status === 'PENDING')
    const approvedInstallments = salary.installments.filter(i => i.status === 'APPROVED')

    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Advance Payment Installments
            </CardTitle>
            <CardDescription>
              Manage advance payment deductions for this salary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pending Installments */}
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
                      <AlertDescription className="space-y-1">
                        <p>Amount: {formatCurrency(installment.amountPaid)}</p>
                        {installment.advance && (
                          <p className="text-sm text-muted-foreground">
                            Remaining on Advance: {formatCurrency(installment.advance.remainingAmount)}
                          </p>
                        )}
                      </AlertDescription>
                    </div>
                    {salary.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingInstallment({
                            id: installment.id,
                            amountPaid: installment.amountPaid,
                            originalAmount: installment.amountPaid,
                            advanceRemainingAmount: installment.advance?.remainingAmount || 0
                          })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleInstallmentAction(installment.id, 'APPROVE')}
                          disabled={isUpdating}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleInstallmentAction(installment.id, 'REJECT')}
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

            {/* Approved Installments */}
            {approvedInstallments.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Approved Installments</h4>
                {approvedInstallments.map((installment) => (
                  <Alert 
                    key={installment.id}
                    variant="default"
                    className="bg-green-50 border-green-200"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <AlertTitle>Approved Installment</AlertTitle>
                        <AlertDescription>
                          Amount: {formatCurrency(installment.amountPaid)}
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            )}

            {pendingInstallments.length === 0 && approvedInstallments.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No advance payment installments for this salary
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingInstallment} onOpenChange={(open) => !open && setEditingInstallment(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Installment Amount</DialogTitle>
              <DialogDescription>
                Update the installment amount. Maximum amount allowed is{' '}
                {editingInstallment && formatCurrency(editingInstallment.advanceRemainingAmount)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  value={editingInstallment?.amountPaid}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    if (editingInstallment) {
                      setEditingInstallment({
                        ...editingInstallment,
                        amountPaid: value
                      })
                    }
                  }}
                  min={0}
                  max={editingInstallment?.advanceRemainingAmount}
                  step={100}
                />
              </div>
              {editingInstallment && editingInstallment.amountPaid > editingInstallment.advanceRemainingAmount && (
                <p className="text-sm text-destructive">
                  Amount cannot exceed the remaining advance amount
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingInstallment(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => editingInstallment && handleEditInstallment(editingInstallment.amountPaid)}
                disabled={
                  isUpdating || 
                  !editingInstallment || 
                  editingInstallment.amountPaid <= 0 ||
                  editingInstallment.amountPaid > editingInstallment.advanceRemainingAmount
                }
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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
              onClick={() => confirmReject && handleInstallmentAction(confirmReject.id, 'REJECT')}
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
      <Button
        variant="ghost"
        onClick={handleBack}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Salaries
      </Button>

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

            {salary.status === 'PENDING' && (
              <Button
                onClick={handleUpdateStatus}
                disabled={isUpdating || salary.installments?.some(i => i.status === 'PENDING')}
              >
                {isUpdating ? 'Updating...' : 'Move to Processing'}
                {salary.installments?.some(i => i.status === 'PENDING') && 
                  ' (Pending installments need approval)'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <SalaryStatsTable salaryId={salary.id} />

      {renderAdvanceInstallments()}

    </div>
  )
} 
