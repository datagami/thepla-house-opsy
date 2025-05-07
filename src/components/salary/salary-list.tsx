'use client'

import { useEffect, useState } from 'react'
import {Branch, Salary} from "@/models/models"
import { Button } from '@/components/ui/button'
import { useRouter, useSearchParams } from 'next/navigation'
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

import { SearchIcon } from 'lucide-react'
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarDays, Clock, CalendarOff, CalendarCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { calculateNetSalaryFromObject } from '@/lib/services/salary-calculator'

interface SalaryListProps {
  month: number
  year: number
}

export function SalaryList({ month, year }: SalaryListProps) {
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [roles, setRoles] = useState([])
  const [, setBranchNames] = useState<Record<string, string>>({});
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedSalaries, setSelectedSalaries] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState({
    deductions: 'all',
    status: 'all',
    search: '',
    branch: 'all',
    role: 'all'
  })

  // Get current year and month from URL
  const currentYear = searchParams.get('year')
  const currentMonth = searchParams.get('month')

  useEffect(() => {
    if (month && year) {
      fetchSalaries()
      fetchBranches()
      fetchRoles()
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

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches')
      if (response.ok) {
        const data = await response.json()
        setBranches(data)
        const branchNames = data.reduce((acc: Record<string, string>, branch: Branch) => {
          acc[branch.id] = branch.name;
          return acc;
        }, {});
        setBranchNames(branchNames);
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles')
      if (response.ok) {
        const data = await response.json()
        setRoles(data)
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
    }
  }

  const getFilteredSalaries = () => {
    return salaries.filter(salary => {
      // Search filter
      const matchesSearch = !selectedFilters.search || 
        salary.user.name?.toLowerCase().includes(selectedFilters.search.toLowerCase()) ||
        salary.user.email?.toLowerCase().includes(selectedFilters.search.toLowerCase()) ||
        salary.user.numId?.toString().includes(selectedFilters.search)

      // Branch filter
      const matchesBranch = selectedFilters.branch === 'all' || 
        salary.user.branchId === selectedFilters.branch

      // Role filter
      const matchesRole = selectedFilters.role === 'all' || 
        salary.user.role === selectedFilters.role

      // Deductions filter
      const matchesDeductions = 
        selectedFilters.deductions === 'all' ? true :
        selectedFilters.deductions === 'with-deductions' ? salary.installments.length > 0 :
        selectedFilters.deductions === 'without-deductions' ? salary.installments.length === 0 :
        true

      // Status filter
      const matchesStatus = selectedFilters.status === 'all' ? true :
        salary.status === selectedFilters.status

      return matchesSearch && matchesBranch && matchesRole && 
             matchesDeductions && matchesStatus
    })
  }

  const filteredSalaries = getFilteredSalaries()

  const formatDays = (days: number) => {
    return days % 1 === 0 ? days.toString() : days.toFixed(1)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all PENDING and PROCESSING salaries
      const selectableSalaryIds = filteredSalaries
        .filter(salary => ['PENDING', 'PROCESSING'].includes(salary.status))
        .map(salary => salary.id)
      setSelectedSalaries(selectableSalaryIds)
    } else {
      setSelectedSalaries([])
    }
  }

  const handleSelectSalary = (salaryId: string, checked: boolean) => {
    if (checked) {
      setSelectedSalaries(prev => [...prev, salaryId])
    } else {
      setSelectedSalaries(prev => prev.filter(id => id !== salaryId))
    }
  }

  const handleUpdateStatus = async (salaryId: string, newStatus: 'PAID' | 'FAILED') => {
    try {
      setIsProcessing(true)
      const response = await fetch(`/api/salary/${salaryId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to update salary status')
        return
      }

      // Update local state
      setSalaries(prevSalaries => 
        prevSalaries.map(salary => 
          salary.id === salaryId 
            ? { ...salary, status: newStatus }
            : salary
        )
      )

      toast.success(`Salary status updated to ${newStatus}`)
      router.refresh()
    } catch (error) {
      console.error('Error updating salary status:', error)
      toast.error('Failed to update salary status')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkUpdateStatus = async (newStatus: 'PAID' | 'FAILED' | 'PROCESSING') => {
    try {
      setIsProcessing(true)
      const response = await fetch('/api/salary/bulk-update-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salaryIds: selectedSalaries,
          status: newStatus
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.details) {
          toast.error(`Salary ${data.detail.salaryId}: ${data.detail.error}`)
        } else {
          toast.error(data.error || 'Failed to update salaries')
        }
        return
      }

      // Update local state
      setSalaries(prevSalaries => 
        prevSalaries.map(salary => 
          selectedSalaries.includes(salary.id)
            ? { ...salary, status: newStatus }
            : salary
        )
      )

      toast.success(`Successfully updated ${data.processedIds.length} salaries to ${newStatus}`)
      setSelectedSalaries([])
      router.refresh()
    } catch (error) {
      console.error('Error updating salaries:', error)
      toast.error('Failed to update salaries')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleViewDetails = (salaryId: string) => {
    const params = new URLSearchParams()
    if (currentYear) params.set('year', currentYear)
    if (currentMonth) params.set('month', currentMonth)
    
    router.push(`/salary/${salaryId}?${params.toString()}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'PROCESSING':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getSelectedSalariesStatus = () => {
    const selectedSalariesData = filteredSalaries.filter(salary => selectedSalaries.includes(salary.id));
    const allProcessing = selectedSalariesData.every(salary => salary.status === 'PROCESSING');
    const allPending = selectedSalariesData.every(salary => salary.status === 'PENDING');
    
    return {
      allProcessing,
      allPending,
      mixed: !allProcessing && !allPending
    };
  };

  if (!month || !year) {
    return null
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Search</label>
          <div className="relative">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or employee ID"
              value={selectedFilters.search}
              onChange={(e) => setSelectedFilters(prev => ({
                ...prev,
                search: e.target.value
              }))}
              className="pl-8"
            />
          </div>
        </div>
        <div className="w-[200px]">
          <label className="text-sm font-medium mb-2 block">Branch</label>
          <Select 
            value={selectedFilters.branch}
            onValueChange={(value) => setSelectedFilters(prev => ({
              ...prev,
              branch: value
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch: Branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <label className="text-sm font-medium mb-2 block">Role</label>
          <Select 
            value={selectedFilters.role}
            onValueChange={(value) => setSelectedFilters(prev => ({
              ...prev,
              role: value
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((role: string, index: number) => (
                <SelectItem key={role + index} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <label className="text-sm font-medium mb-2 block">Deductions</label>
          <Select 
            value={selectedFilters.deductions}
            onValueChange={(value) => setSelectedFilters(prev => ({
              ...prev,
              deductions: value
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Deductions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Salaries</SelectItem>
              <SelectItem value="with-deductions">With Deductions</SelectItem>
              <SelectItem value="without-deductions">Without Deductions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <label className="text-sm font-medium mb-2 block">Status</label>
          <Select 
            value={selectedFilters.status}
            onValueChange={(value) => setSelectedFilters(prev => ({
              ...prev,
              status: value
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(selectedFilters.deductions !== 'all' || 
          selectedFilters.status !== 'all' || 
          selectedFilters.search || 
          selectedFilters.branch || 
          selectedFilters.role) && (
          <Button
            variant="outline"
            onClick={() => setSelectedFilters({
              deductions: 'all',
              status: 'all',
              search: '',
              branch: 'all',
              role: 'all'
            })}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Checkbox
            checked={selectedSalaries.length === filteredSalaries.filter(s => ['PENDING', 'PROCESSING'].includes(s.status)).length}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedSalaries.length} selected
          </span>
        </div>
        {selectedSalaries.length > 0 && (
          <div className="flex gap-2">
            {(() => {
              const { allProcessing, allPending, mixed } = getSelectedSalariesStatus();
              
              if (mixed) {
                return (
                  <Button
                    variant="outline"
                    disabled={true}
                    className="text-muted-foreground"
                  >
                    Select salaries with same status
                  </Button>
                );
              }

              if (allProcessing) {
                return (
                  <>
                    <Button
                      onClick={() => handleBulkUpdateStatus('PAID')}
                      disabled={isProcessing}
                      variant="outline"
                      className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                    >
                      {isProcessing ? 'Processing...' : 'Mark as Paid'}
                    </Button>
                    <Button
                      onClick={() => handleBulkUpdateStatus('FAILED')}
                      disabled={isProcessing}
                      variant="outline"
                      className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                    >
                      {isProcessing ? 'Processing...' : 'Mark as Failed'}
                    </Button>
                  </>
                );
              }

              if (allPending) {
                return (
                  <Button
                    onClick={() => handleBulkUpdateStatus('PROCESSING')}
                    disabled={isProcessing}
                    variant="outline"
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                  >
                    {isProcessing ? 'Processing...' : 'Move to Processing'}
                  </Button>
                );
              }

              return null;
            })()}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSalaries.map((salary) => (
          <Card key={salary.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {['PENDING', 'PROCESSING'].includes(salary.status) && (
                    <Checkbox
                      checked={selectedSalaries.includes(salary.id)}
                      onCheckedChange={(checked) => handleSelectSalary(salary.id, checked as boolean)}
                    />
                  )}
                  <div>
                    <CardTitle>{salary.user.name}</CardTitle>
                    <CardDescription>
                      {new Date(salary.year, salary.month - 1).toLocaleString('default', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={getStatusColor(salary.status)}>
                  {salary.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Base Salary</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR'
                    }).format(salary.baseSalary)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t">
                  <span className="text-sm font-medium">Net Salary</span>
                  <span className="font-semibold text-green-600">
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR'
                    }).format(calculateNetSalaryFromObject(salary))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CalendarCheck className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Present</p>
                    <p className="text-sm font-medium">{formatDays(salary.presentDays)} days</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <CalendarDays className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Half Days</p>
                    <p className="text-sm font-medium">{salary.halfDays} days</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overtime</p>
                    <p className="text-sm font-medium">{salary.overtimeDays} days</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <CalendarOff className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Leaves</p>
                    <p className="text-sm font-medium">{salary.leavesEarned} days</p>
                  </div>
                </div>
              </div>

              {salary.advanceDeduction > 0 && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground flex items-center justify-between">
                    <span>Advance Deduction</span>
                    <span className="text-destructive font-medium">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR'
                      }).format(salary.advanceDeduction)}
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => handleViewDetails(salary.id)}
              >
                View Details
              </Button>
              {(salary.status) === 'PROCESSING' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                    onClick={() => handleUpdateStatus(salary.id, 'PAID')}
                    disabled={isProcessing}
                  >
                    Paid
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                    onClick={() => handleUpdateStatus(salary.id, 'FAILED')}
                    disabled={isProcessing}
                  >
                    Failed
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredSalaries.length === 0 && (
        <div className="text-center py-4">
          No salaries found matching the selected filters
        </div>
      )}
    </div>
  )
} 
