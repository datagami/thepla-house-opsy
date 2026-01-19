'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SalaryList } from './salary-list'
import { toast } from "sonner";
import { useRouter } from 'next/navigation'
import { DownloadENETButton } from './download-enet-button'
import { DownloadReportButton } from './download-report-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import { formatDateOnly } from '@/lib/utils'

interface SalaryManagementProps {
  initialYear?: number
  initialMonth?: number
}

type ConflictWarning = {
  message: string
  conflictsCount: number
  sampleConflicts?: {
    userId?: string
    userName: string | null
    date: string
    entries: number
  }[]
}

export function SalaryManagement({ initialYear, initialMonth }: SalaryManagementProps) {
  const router = useRouter()
  const [selectedYear, setSelectedYear] = useState(initialYear || new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date().getMonth() + 1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isProcessingReferrals, setIsProcessingReferrals] = useState(false)
  const [conflictWarning, setConflictWarning] = useState<ConflictWarning | null>(null)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  // Update URL when selection changes
  const updateUrlParams = useCallback((year: number, month: number) => {
    const params = new URLSearchParams()
    params.set('year', year.toString())
    params.set('month', month.toString())
    router.push(`/salary?${params.toString()}`, { scroll: false })
  }, [router])

  // Handle year change
  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    updateUrlParams(year, selectedMonth)
  }

  // Handle month change
  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
    updateUrlParams(selectedYear, month)
  }

  const handleGenerateSalaries = async () => {
    if (!selectedMonth || !selectedYear) {
      toast.success('Please select both month and year')
      return
    }

    try {
      setIsGenerating(true)
      const response = await fetch('/api/salary/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: parseInt(selectedMonth.toString()),
          year: parseInt(selectedYear.toString()),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        if (payload?.conflictsCount) {
          setConflictWarning({
            message: payload.error ?? 'Duplicate attendance entries detected',
            conflictsCount: payload.conflictsCount,
            sampleConflicts: payload.sampleConflicts,
          })
          toast.error(payload?.error ?? 'Cannot generate salaries until attendance conflicts are resolved')
        } else {
          toast.error(payload?.error ?? 'Failed to generate salaries')
        }
        return
      }

      setConflictWarning(null)
      toast.success('Salaries generated successfully');
      setRefreshKey(prev => prev + 1) // Trigger list refresh
    } catch (error) {
      console.log(error)
      toast.error('Failed to generate salaries')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6 p-8">
      {conflictWarning && (
        <Alert variant="destructive">
          <AlertTitle>Attendance duplicates detected</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {conflictWarning.message} ({conflictWarning.conflictsCount}{' '}
              {conflictWarning.conflictsCount === 1 ? 'day' : 'days'} impacted)
            </p>
            {conflictWarning.sampleConflicts && conflictWarning.sampleConflicts.length > 0 && (
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {conflictWarning.sampleConflicts.map((conflict, index) => (
                  <li key={`${conflict.userId ?? index}-${conflict.date}`}>
                    {conflict.userName ?? 'Unknown user'} — {formatDateOnly(conflict.date)} ({conflict.entries} entries)
                  </li>
                ))}
              </ul>
            )}
            <p>
              <Link
                href={`/hr/attendance-conflicts?month=${selectedMonth}&year=${selectedYear}`}
                className="underline font-medium"
              >
                Review attendance conflicts
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Generate Monthly Salaries</CardTitle>
          <CardDescription>
            Select month and year to generate salaries for all employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => handleMonthChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => handleYearChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleGenerateSalaries}
                disabled={isGenerating || !selectedMonth || !selectedYear}>
                {isGenerating ? 'Generating...' : 'Generate Salaries'}
              </Button>

              <Button
                onClick={async () => {
                  try {
                    setIsProcessingReferrals(true)
                    const res = await fetch('/api/salary/process-referrals', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ month: selectedMonth, year: selectedYear })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Failed to process referrals')
                    toast.success('Referral bonuses processed')
                    setRefreshKey(prev => prev + 1)
                  } catch (e) {
                    console.error(e)
                    toast.error('Failed to process referrals')
                  } finally {
                    setIsProcessingReferrals(false)
                  }
                }}
                disabled={isProcessingReferrals}
                variant="outline"
              >
                {isProcessingReferrals ? 'Processing...' : 'Process Referral Bonuses'}
              </Button>

              <DownloadENETButton 
                year={selectedYear}
                month={selectedMonth}
              />
              <DownloadReportButton 
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <SalaryList 
        key={refreshKey}
        month={selectedMonth}
        year={selectedYear}
      />
    </div>
  )
} 
