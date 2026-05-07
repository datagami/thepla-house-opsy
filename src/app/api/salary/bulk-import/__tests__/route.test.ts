import { describe, it, expect, afterEach } from 'vitest'
import { POST } from '@/app/api/salary/bulk-import/route'
import { buildBulkWorkbook } from '@/lib/services/salary-bulk'
import { prisma } from '@/lib/prisma'

// Mock auth as HR for these tests.
import { auth } from '@/auth'
import { vi } from 'vitest'
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

const TEST_MONTH = 8
const TEST_YEAR = 2099

afterEach(async () => {
  await prisma.salary.deleteMany({ where: { year: TEST_YEAR } })
  await prisma.user.deleteMany({ where: { email: { contains: '@rt.bulk-import.test' } } })
  vi.resetAllMocks()
})

function asHR() {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'hr-1', role: 'HR' },
  })
}

async function seedActiveSalary() {
  const u = await prisma.user.create({
    data: {
      name: 'RT', email: `rt+${Date.now()}@rt.bulk-import.test`,
      role: 'EMPLOYEE', status: 'ACTIVE',
    },
  })
  return prisma.salary.create({
    data: {
      userId: u.id, month: TEST_MONTH, year: TEST_YEAR,
      baseSalary: 30000, presentDays: 30, netSalary: 30000,
      otherBonuses: 0, otherDeductions: 0, status: 'PENDING',
    },
  })
}

function makeRequest(buffer: Buffer, qs: string) {
  const fd = new FormData()
  fd.set('file', new File([buffer], 'upload.xlsx'))
  return new Request(`http://localhost/api/salary/bulk-import?${qs}`, {
    method: 'POST',
    body: fd,
  })
}

describe('POST /api/salary/bulk-import', () => {
  it('returns 401 for non-HR sessions', async () => {
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'x', role: 'EMPLOYEE' },
    })
    const res = await POST(makeRequest(Buffer.from(''), 'month=4&year=2026'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no salaries exist for the month', async () => {
    asHR()
    const res = await POST(makeRequest(Buffer.from(''), `month=1&year=${TEST_YEAR}`))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('No salaries exist for this month')
  })

  it('round-trips a generated workbook', async () => {
    asHR()
    await seedActiveSalary()
    const buf = await buildBulkWorkbook(prisma, TEST_MONTH, TEST_YEAR)
    const res = await POST(makeRequest(buf, `month=${TEST_MONTH}&year=${TEST_YEAR}`))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.perSheet.Active.unchanged).toBe(1)
  })

  it('returns Invalid workbook for garbage data', async () => {
    asHR()
    await seedActiveSalary()
    const res = await POST(
      makeRequest(Buffer.from('not an xlsx'), `month=${TEST_MONTH}&year=${TEST_YEAR}`)
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid workbook')
  })
})
