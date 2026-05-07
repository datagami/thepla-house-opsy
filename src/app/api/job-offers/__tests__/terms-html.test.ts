import { describe, it, expect, afterEach, vi } from 'vitest'
import { POST } from '@/app/api/job-offers/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

afterEach(async () => {
  await prisma.jobOffer.deleteMany({ where: { name: { startsWith: '__test_' } } })
  await prisma.user.deleteMany({ where: { name: { startsWith: '__test_' } } })
  await prisma.department.deleteMany({ where: { name: { startsWith: '__test_' } } })
  vi.resetAllMocks()
})

function asHR() {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'hr-1', role: 'HR' },
  })
}

async function makeDepartment() {
  return prisma.department.create({
    data: {
      name: `__test_department_${Date.now()}`,
      isActive: true,
    },
  })
}

describe('POST /api/job-offers — termsHtml', () => {
  it('strips <script> from termsHtml on save', async () => {
    asHR()
    const department = await makeDepartment()
    const req = new Request('http://localhost/api/job-offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '__test_offer',
        name: '__test_offer',
        designation: 'Cashier',
        role: 'EMPLOYEE',
        departmentId: department.id,
        totalSalary: 240000,
        salaryComponents: [{ name: 'Gross', perAnnum: 240000, perMonth: 20000 }],
        deductions: [],
        joiningDate: '2026-06-01',
        termsHtml: '<p>Hi</p><script>alert(1)</script>',
      }),
    }) as unknown as Parameters<typeof POST>[0]
    const res = await POST(req)
    expect(res.status).toBe(201)
    const created = await prisma.jobOffer.findFirst({ where: { name: '__test_offer' } })
    expect(created?.termsHtml).toBeTruthy()
    expect(created?.termsHtml).not.toContain('<script>')
    expect(created?.termsHtml).toContain('<p>Hi</p>')
  })
})
