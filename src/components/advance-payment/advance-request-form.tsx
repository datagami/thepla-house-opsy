'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface AdvanceRequestFormProps {
  userId: string
  onSuccess?: () => void
}

export function AdvanceRequestForm({ userId, onSuccess }: AdvanceRequestFormProps) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [emiAmount, setEmiAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/advance-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: parseFloat(amount),
          emiAmount: parseFloat(emiAmount),
          reason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit advance request')
      }

      toast.success('Advance payment request submitted successfully')
      setAmount('')
      setEmiAmount('')
      setReason('')
      onSuccess?.()
    } catch (error) {
      console.error('Error submitting advance request:', error)
      toast.error('Failed to submit advance request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Advance Amount
        </label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Monthly EMI Amount
        </label>
        <Input
          type="number"
          value={emiAmount}
          onChange={(e) => setEmiAmount(e.target.value)}
          placeholder="Enter monthly EMI amount"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Reason
        </label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for advance payment"
          required
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Request'}
      </Button>
    </form>
  )
} 