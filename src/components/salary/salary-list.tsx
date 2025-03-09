'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {Branch, Salary} from "@/models/models"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PencilIcon, SearchIcon } from 'lucide-react'
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SalaryListProps {
  month: number
  year: number
}

export function SalaryList({ month, year }: SalaryListProps) {
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [branches, setBranches] = useState([])
  const [roles, setRoles] = useState([])

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

  const filteredSalaries = salaries.filter((salary: Salary) => {
    const matchesSearch = searchTerm === '' || 
      salary.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      salary.user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      salary.user.numId?.toString().includes(searchTerm)

    const matchesBranch = !selectedBranch || salary.user.branchId === selectedBranch
    const matchesRole = !selectedRole || salary.user.role === selectedRole

    return matchesSearch && matchesBranch && matchesRole
  })

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Base Salary</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Bonuses</TableHead>
              <TableHead>Net Salary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSalaries.map((salary: Salary) => (
              <TableRow key={salary.id}>
                <TableCell>{salary.user.numId || 'N/A'}</TableCell>
                <TableCell>{salary.user.name}</TableCell>
                <TableCell>{salary.user.email}</TableCell>
                <TableCell>{salary.user.branch?.name || 'N/A'}</TableCell>
                <TableCell>{salary.user.role || 'N/A'}</TableCell>
                <TableCell>{formatCurrency(salary.baseSalary)}</TableCell>
                <TableCell className="text-right">
                  <HoverCard>
                    <HoverCardTrigger className="cursor-help">
                      {formatCurrency(salary.deductions)}
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Deduction Details</h4>
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span>Attendance Deductions:</span>
                            <span>{formatCurrency(salary.attendanceDeduction || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Advance/EMI:</span>
                            <span>{formatCurrency(salary.advanceDeduction || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell className="text-right">
                  <HoverCard>
                    <HoverCardTrigger className="cursor-help">
                      {formatCurrency(salary.bonuses)}
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Bonus Details</h4>
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span>Overtime Bonus:</span>
                            <span>{formatCurrency(salary.overtimeBonus || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Performance Bonus:</span>
                            <span>{formatCurrency(salary.performanceBonus || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell>{formatCurrency(salary.netSalary)}</TableCell>
                <TableCell>
                  <Badge variant={
                    salary.status === 'PAID' ? 'default' :
                    salary.status === 'PROCESSING' ? 'secondary' :
                    salary.status === 'FAILED' ? 'destructive' :
                    'outline'
                  }>
                    {salary.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <Link href={`/salary/${salary.id}`}>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Details
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 
