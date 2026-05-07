import { describe, it, expect, afterEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/offer-letter-snippets/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

afterEach(async () => {
  await prisma.offerLetterSnippet.deleteMany({
    where: { title: { startsWith: '__test_' } },
  })
  await prisma.user.deleteMany({
    where: { email: { startsWith: '__test_offer_snippet_' } },
  })
  vi.resetAllMocks()
})

async function asHR() {
  await prisma.user.upsert({
    where: { id: 'hr-1' },
    update: {},
    create: {
      id: 'hr-1',
      name: '__test_offer_snippet_hr',
      email: '__test_offer_snippet_hr@example.test',
      role: 'HR',
      status: 'ACTIVE',
    },
  })
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'hr-1', role: 'HR' },
  })
}

function asEmployee() {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'e-1', role: 'EMPLOYEE' },
  })
}

describe('GET /api/offer-letter-snippets', () => {
  it('returns 401 for non-HR sessions', async () => {
    asEmployee()
    const res = await GET(new Request('http://localhost/api/offer-letter-snippets'))
    expect(res.status).toBe(401)
  })

  it('returns active-only by default, all when ?all=true', async () => {
    await asHR()
    await prisma.offerLetterSnippet.create({
      data: { title: '__test_active', category: 'OTHER', htmlBody: '<p>a</p>', isActive: true },
    })
    await prisma.offerLetterSnippet.create({
      data: { title: '__test_inactive', category: 'OTHER', htmlBody: '<p>b</p>', isActive: false },
    })

    const res1 = await GET(new Request('http://localhost/api/offer-letter-snippets'))
    const j1 = await res1.json()
    expect(j1.snippets.find((s: { title: string }) => s.title === '__test_active')).toBeTruthy()
    expect(j1.snippets.find((s: { title: string }) => s.title === '__test_inactive')).toBeFalsy()

    const res2 = await GET(new Request('http://localhost/api/offer-letter-snippets?all=true'))
    const j2 = await res2.json()
    expect(j2.snippets.find((s: { title: string }) => s.title === '__test_inactive')).toBeTruthy()
  })
})

describe('POST /api/offer-letter-snippets', () => {
  it('returns 401 for non-HR', async () => {
    asEmployee()
    const res = await POST(new Request('http://localhost/api/offer-letter-snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '__test_x', category: 'OTHER', htmlBody: '<p>a</p>' }),
    }))
    expect(res.status).toBe(401)
  })

  it('creates a snippet with sanitized HTML', async () => {
    await asHR()
    const res = await POST(new Request('http://localhost/api/offer-letter-snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '__test_create',
        category: 'OTHER',
        htmlBody: '<p>Hi</p><script>alert(1)</script>',
      }),
    }))
    expect(res.status).toBe(201)
    const j = await res.json()
    expect(j.snippet.htmlBody).not.toContain('<script>')
    expect(j.snippet.htmlBody).toContain('<p>Hi</p>')
  })

  it('rejects empty htmlBody after sanitization', async () => {
    await asHR()
    const res = await POST(new Request('http://localhost/api/offer-letter-snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '__test_empty',
        category: 'OTHER',
        htmlBody: '<script>alert(1)</script>',
      }),
    }))
    expect(res.status).toBe(400)
  })
})
