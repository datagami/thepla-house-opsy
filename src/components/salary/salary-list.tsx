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
import {Branch, Salary} from "@/models/models"
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

export function SalaryList({ month, year }: SalaryListProps) {
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [branches, setBranches] = useState([])
  const [roles, setRoles] = useState([])
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});


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
              <TableHead>Net Salary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSalaries.map((salary: Salary) => (
              <TableRow 
                key={salary.id}
                className={getRowColorClass(salary.status)}
              >
                <TableCell>{salary.user.numId || 'N/A'}</TableCell>
                <TableCell>{salary.user.name}</TableCell>
                <TableCell>{salary.user.email}</TableCell>
                <TableCell>{salary.user.branchId ? branchNames[salary.user.branchId] : 'N/A'}</TableCell>
                <TableCell>{salary.user.role || 'N/A'}</TableCell>
                <TableCell>{formatCurrency(salary.netSalary)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <Link href={`/salary/${salary.id}?month=${month}&year=${year}`}>
                      <PencilIcon className="h-4 w-4 mr-2" />
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
