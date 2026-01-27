'use client'

import {useCallback, useEffect, useState} from 'react'
import {Branch, Salary, User} from "@/models/models"
import {Button} from '@/components/ui/button'
import {useRouter, useSearchParams} from 'next/navigation'
import {Checkbox} from "@/components/ui/checkbox"
import {toast} from "sonner"

import {SearchIcon} from 'lucide-react'
import {Input} from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {CalendarDays, Clock, CalendarOff, CalendarCheck, Download} from 'lucide-react'
import {Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {calculateNetSalaryFromObject} from '@/lib/services/salary-calculator'

interface SalaryListProps {
  month: number
  year: number
}

export function SalaryList({month, year}: SalaryListProps) {
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
    role: 'all',
    referralOnly: false,
    userStatus: 'all',
  })
  // Add state for users without salary
  const [usersWithoutSalary, setUsersWithoutSalary] = useState<User[]>([]);

  type DeactivateCandidate = { userId: string; name: string | null; numId: number | null }
  const [deactivateCandidates, setDeactivateCandidates] = useState<DeactivateCandidate[]>([])
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)

  // Get current year and month from URL
  const currentYear = searchParams.get('year')
  const currentMonth = searchParams.get('month')

  const fetchSalaries = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/salary?month=${month}&year=${year}${selectedFilters.referralOnly ? '&referralOnly=true' : ''}`)
      if (response.ok) {
        const data = await response.json()
        setSalaries(data)
      }
    } catch (error) {
      console.error('Error fetching salaries:', error)
    } finally {
      setLoading(false)
    }
  }, [month, year, selectedFilters.referralOnly])

  useEffect(() => {
    if (month && year) {
      fetchSalaries()
      fetchBranches()
      fetchRoles()
    }
  }, [fetchSalaries, month, year])

  // Fetch users without salary for selected month/year if filter is selected
  useEffect(() => {
    if (selectedFilters.status === 'no-salary' && month && year) {
      fetchUsersWithoutSalary();
    } else {
      setUsersWithoutSalary([]); // Clear when not in 'no-salary' mode
    }
    // eslint-disable-next-line
  }, [selectedFilters.status, month, year]);

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

  const fetchUsersWithoutSalary = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/without-salary?month=${month}&year=${year}`);
      if (response.ok) {
        const data = await response.json();
        setUsersWithoutSalary(data);
      } else {
        setUsersWithoutSalary([]);
      }
    } catch (error) {
      console.error('Error fetching users without salary:', error);
      setUsersWithoutSalary([]);
    } finally {
      setLoading(false);
    }
  };

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

      // User status filter
      const matchesUserStatus = selectedFilters.userStatus === 'all' ||
        salary.user.status === selectedFilters.userStatus

      return matchesSearch && matchesBranch && matchesRole &&
        matchesDeductions && matchesStatus && matchesUserStatus
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
      const targetSalary = salaries.find(s => s.id === salaryId)
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
            ? {...salary, status: newStatus}
            : salary
        )
      )

      toast.success(`Salary status updated to ${newStatus}`)
      router.refresh()

      const targetUserId = targetSalary?.userId
      if (
        newStatus === 'PAID' &&
        String(targetSalary?.user?.status) === 'PARTIAL_INACTIVE' &&
        targetUserId
      ) {
        setDeactivateCandidates([
          {
            userId: targetUserId,
            name: targetSalary.user?.name ?? null,
            numId: targetSalary.user?.numId ?? null,
          },
        ])
        setDeactivateDialogOpen(true)
      }
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
      const bulkDeactivateCandidates: DeactivateCandidate[] =
        newStatus === 'PAID'
          ? salaries
            .filter(s => selectedSalaries.includes(s.id) && String(s.user?.status) === 'PARTIAL_INACTIVE')
            .map(s => ({
              userId: s.userId,
              name: s.user?.name ?? null,
              numId: s.user?.numId ?? null,
            }))
          : []

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
            ? {...salary, status: newStatus}
            : salary
        )
      )

      toast.success(`Successfully updated ${data.processedIds.length} salaries to ${newStatus}`)
      setSelectedSalaries([])
      router.refresh()

      if (bulkDeactivateCandidates.length > 0) {
        // Dedupe by userId (defensive)
        const unique = Array.from(
          new Map(bulkDeactivateCandidates.map(c => [c.userId, c])).values()
        )
        setDeactivateCandidates(unique)
        setDeactivateDialogOpen(true)
      }
    } catch (error) {
      console.error('Error updating salaries:', error)
      toast.error('Failed to update salaries')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeactivateUsers = async () => {
    if (deactivateCandidates.length === 0) {
      setDeactivateDialogOpen(false)
      return
    }

    try {
      setIsDeactivating(true)
      const results = await Promise.all(
        deactivateCandidates.map(async (candidate) => {
          const resp = await fetch('/api/users/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: candidate.userId, status: 'INACTIVE' }),
          })
          return { userId: candidate.userId, ok: resp.ok }
        })
      )

      const failed = results.filter(r => !r.ok)
      if (failed.length > 0) {
        toast.error(`Failed to mark ${failed.length} user(s) as inactive`)
      } else {
        toast.success(`Marked ${results.length} user(s) as inactive`)
      }

      setDeactivateDialogOpen(false)
      setDeactivateCandidates([])
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error('Failed to update user status')
    } finally {
      setIsDeactivating(false)
    }
  }

  const handleViewDetails = (salaryId: string) => {
    const params = new URLSearchParams()
    if (currentYear) params.set('year', currentYear)
    if (currentMonth) params.set('month', currentMonth)

    router.push(`/salary/${salaryId}?${params.toString()}`)
  }

  const handleDownloadPayslip = async (salaryId: string, employeeName: string | null, employeeNumId: number, month: number, year: number) => {
    try {
      const response = await fetch(`/api/salary/${salaryId}/payslip`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to download payslip')
      }

      // Create blob from response
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `payslip-${employeeName || `employee-${employeeNumId}`}-${month}-${year}.pdf`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      toast.success('Payslip downloaded successfully')
    } catch (error) {
      console.error('Error downloading payslip:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to download payslip')
    }
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

  const getUserStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'PARTIAL_INACTIVE':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'INACTIVE':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'JOB_OFFER':
        return 'bg-blue-50 text-blue-700 border-blue-200'
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
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark employee(s) as inactive?</DialogTitle>
            <DialogDescription>
              These employees are marked as partial inactive. Since their salary is now paid, you can mark them inactive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {deactivateCandidates.map((c) => (
              <div key={c.userId} className="text-sm">
                {c.name || 'Employee'}{c.numId ? ` (Emp #${c.numId})` : ''}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeactivateDialogOpen(false)
                setDeactivateCandidates([])
              }}
              disabled={isDeactivating}
            >
              Not now
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeactivateUsers}
              disabled={isDeactivating}
            >
              {isDeactivating ? 'Updating...' : 'Mark as Inactive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Search</label>
          <div className="relative">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
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
              <SelectValue placeholder="All Branches"/>
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
              <SelectValue placeholder="All Roles"/>
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
              <SelectValue placeholder="Filter by Deductions"/>
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
              <SelectValue placeholder="Filter by Status"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="no-salary">No Salary Generated</SelectItem> {/* New filter */}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <label className="text-sm font-medium mb-2 block">User Status</label>
          <Select
            value={selectedFilters.userStatus}
            onValueChange={(value) => setSelectedFilters(prev => ({
              ...prev,
              userStatus: value
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by User Status"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All User Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PARTIAL_INACTIVE">Partial Inactive</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(selectedFilters.deductions !== 'all' ||
          selectedFilters.status !== 'all' ||
          selectedFilters.userStatus !== 'all' ||
          selectedFilters.search ||
          selectedFilters.branch ||
          selectedFilters.role ||
          selectedFilters.referralOnly) && (
          <Button
            variant="outline"
            onClick={() => setSelectedFilters({
              deductions: 'all',
              status: 'all',
              search: '',
              branch: 'all',
              role: 'all',
              referralOnly: false,
              userStatus: 'all',
            })}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 -mt-2">
        <Checkbox
          checked={selectedFilters.referralOnly}
          onCheckedChange={(checked) => {
            setSelectedFilters(prev => ({ ...prev, referralOnly: !!checked }))
            // refetch on toggle
            setTimeout(() => fetchSalaries(), 0)
          }}
        />
        <span className="text-sm">Show only salaries with referral bonuses</span>
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
              const {allProcessing, allPending, mixed} = getSelectedSalariesStatus();

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

      {selectedFilters.status === 'no-salary' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {usersWithoutSalary.length > 0 ? usersWithoutSalary.map((user) => (
            <Card key={user.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle>{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <span><b>Role:</b> {user.role}</span>
                  <span><b>Branch:</b> {user.branch?.name || 'N/A'}</span>
                  <span className="text-destructive font-medium">Salary not generated for this month</span>

                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-4 w-full col-span-3">All active users have salary generated for this
              month</div>
          )}
        </div>
      ) : (
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
                  <div className="flex gap-2">
                    <Badge className={getUserStatusColor(salary.user.status)}>
                      {salary.user.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={getStatusColor(salary.status)}>
                      {salary.status}
                    </Badge>
                  </div>
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
              {Array.isArray((salary as unknown as { referrals?: Array<{ bonusAmount?: number }> }).referrals) && (salary as unknown as { referrals: Array<{ bonusAmount?: number }> }).referrals.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Referral Bonus</span>
                  <span className="font-semibold text-green-700">
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR'
                    }).format((salary as unknown as { referrals: Array<{ bonusAmount?: number }> }).referrals.reduce((sum: number, r) => sum + (r.bonusAmount || 0), 0))}
                  </span>
                </div>
              )}
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
                      <CalendarCheck className="h-4 w-4 text-green-600"/>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Present</p>
                      <p className="text-sm font-medium">{formatDays(salary.presentDays)} days</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <CalendarDays className="h-4 w-4 text-orange-600"/>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Half Days</p>
                      <p className="text-sm font-medium">{salary.halfDays} days</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600"/>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Overtime</p>
                      <p className="text-sm font-medium">{salary.overtimeDays} days</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <CalendarOff className="h-4 w-4 text-purple-600"/>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPayslip(salary.id, salary.user.name ?? null, salary.user.numId, salary.month, salary.year)}
                  title="Download Payslip"
                >
                  <Download className="h-4 w-4" />
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
      )}

      {filteredSalaries.length === 0 && (
        <div className="text-center py-4">
          No salaries found matching the selected filters
        </div>
      )}
    </div>
  )
} 
