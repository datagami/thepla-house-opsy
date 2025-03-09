'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import {AdvancePayment} from "@/models/models";

interface AdvanceHistoryProps {
  userId: string
}

export function AdvanceHistory({ userId }: AdvanceHistoryProps) {
  const [advances, setAdvances] = useState<AdvancePayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdvances()
  }, [userId])

  const fetchAdvances = async () => {
    try {
      const response = await fetch(`/api/advance-payment?userId=${userId}`)
      if (!response.ok) throw new Error('Failed to fetch advances')
      const data = await response.json()
      setAdvances(data)
    } catch (error) {
      console.error('Error fetching advances:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Advance Payment History</h3>
      {advances.length === 0 ? (
        <p>No advance payments found</p>
      ) : (
        advances.map((advance) => (
          <Card key={advance.id} className="p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">Amount: ₹{advance.amount}</p>
                <p className="text-sm">EMI: ₹{advance.emiAmount}</p>
                <p className="text-sm">Remaining: ₹{advance.remainingAmount}</p>
                {advance.reason && (
                  <p className="text-sm text-gray-600">{advance.reason}</p>
                )}
              </div>
              <div className="text-right">
                <p className={`text-sm ${
                  advance.status === 'APPROVED' ? 'text-green-600' :
                  advance.status === 'REJECTED' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {advance.status}
                </p>
                <p className="text-sm text-gray-600">
                  {formatDate(advance.createdAt)}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
} 
