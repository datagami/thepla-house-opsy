'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Salary } from '@/models/models'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AddBonusFormProps {
  salary: Salary
  onAdjustmentAdded: (updatedSalary: Salary) => void
}

export function AddBonusForm({ salary, onAdjustmentAdded }: AddBonusFormProps) {
  const [bonusAmount, setBonusAmount] = useState(salary.otherBonuses.toString())
  const [deductionAmount, setDeductionAmount] = useState(salary.otherDeductions.toString())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/salary/${salary.id}/adjustment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bonusAmount: parseFloat(bonusAmount) || 0,
          deductionAmount: parseFloat(deductionAmount) || 0,
        }),
      })

      const updatedSalary = await response.json()
      onAdjustmentAdded(updatedSalary)
      toast.success('Adjustments updated successfully')
    } catch (error) {
      console.log(error);
      toast.error('Failed to update adjustments')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Adjustments</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bonus Amount</label>
              <Input
                type="number"
                placeholder="Enter bonus amount"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deduction Amount</label>
              <Input
                type="number"
                placeholder="Enter deduction amount"
                value={deductionAmount}
                onChange={(e) => setDeductionAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Updating...' : 'Update Adjustments'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
} 
