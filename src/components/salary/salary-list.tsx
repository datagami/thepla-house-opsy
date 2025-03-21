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

interface SalaryListProps {
  month: number
  year: number
  filter: string
}

const getRowColorClass = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-50 hover:bg-yellow-100'
    case 'PROCESSING':
      return 'bg-blue-50 hover:bg-blue-100'
    case 'PAID':
      return 'bg-green-50 hover:bg-green-100'
    case 'FAILED':
      return 'bg-red-50 hover:bg-red-100'
    default:
      return ''
  }
}

export function SalaryList({ month, year, filter }: SalaryListProps) {
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [branches, setBranches] = useState([])
  const [roles, setRoles] = useState([])
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedSalaries, setSelectedSalaries] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  const filterSalaries = (salaries: Salary[]) => {
    switch (filter) {
      case 'with-deductions':
        return salaries.filter(salary => 
          salary.installments && salary.installments.length > 0
        )
      case 'without-deductions':
        return salaries.filter(salary => 
          !salary.installments || salary.installments.length === 0
        )
      default:
        return salaries
    }
  }

  const filteredSalaries = filterSalaries(salaries).filter((salary: Salary) => {
    const matchesSearch = searchTerm === '' || 
      salary.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      salary.user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      salary.user.numId?.toString().includes(searchTerm)

    const matchesBranch = !selectedBranch || salary.user.branchId === selectedBranch
    const matchesRole = !selectedRole || salary.user.role === selectedRole

    return matchesSearch && matchesBranch && matchesRole
  })

  const formatDays = (days: number) => {
    return days % 1 === 0 ? days.toString() : days.toFixed(1)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select PENDING salaries
      const pendingSalaryIds = filteredSalaries
        .filter(salary => salary.status === 'PENDING')
        .map(salary => salary.id)
      setSelectedSalaries(pendingSalaryIds)
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

  const handleMoveToProcessing = async () => {
    if (selectedSalaries.length === 0) {
      toast.error("Please select at least one salary")
      return
    }

    try {
      setIsProcessing(true)
      const response = await fetch('/api/salary/bulk-update-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salaryIds: selectedSalaries,
          status: 'PROCESSING'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update salaries')
      }

      toast.success(`${selectedSalaries.length} salaries moved to processing`)
      setSelectedSalaries([])
      router.refresh()
    } catch (error) {
      toast.error('Failed to update salaries')
      console.error(error)
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

  if (!month || !year) {
    return null
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Search</label>
          <div className="relative">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or employee ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="w-[200px]">
          <label className="text-sm font-medium mb-2 block">Branch</label>
          <Select 
            value={selectedBranch || undefined} 
            onValueChange={setSelectedBranch}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch: Branch,) => (
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
            value={selectedRole || undefined}
            onValueChange={setSelectedRole}
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
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Checkbox
            checked={selectedSalaries.length === filteredSalaries.filter(s => s.status === 'PENDING').length}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedSalaries.length} selected
          </span>
        </div>
        {selectedSalaries.length > 0 && (
          <Button
            onClick={handleMoveToProcessing}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Move to Processing'}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSalaries.map((salary) => (
          <Card key={salary.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {salary.status === 'PENDING' && (
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
              {/* Salary Information */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Net Salary</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR'
                  }).format(salary.netSalary)}
                </span>
              </div>

              {/* Attendance Metrics */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* Present Days */}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CalendarCheck className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Present</p>
                    <p className="text-sm font-medium">{formatDays(salary.presentDays)} days</p>
                  </div>
                </div>

                {/* Half Days */}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <CalendarDays className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Half Days</p>
                    <p className="text-sm font-medium">{salary.halfDays} days</p>
                  </div>
                </div>

                {/* Overtime Days */}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overtime</p>
                    <p className="text-sm font-medium">{salary.overtimeDays} days</p>
                  </div>
                </div>

                {/* Leave Days */}
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

              {/* Deductions Info if any */}
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
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleViewDetails(salary.id)}
              >
                View Details
              </Button>
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
