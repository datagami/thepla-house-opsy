import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'section', 'div', 'span', 'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u',
  'h3', 'h4', 'h5',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a',
]

const ALLOWED_ATTR = [
  'class', 'style', 'href', 'colspan', 'rowspan', 'align',
]

const ALLOWED_URI_REGEXP = /^(?:https?:\/\/|mailto:|tel:|#)/i

function stripEmptyContainers(html: string): string {
  // "Empty-ish" content inside a container: whitespace, <br>, &nbsp;, NBSP char,
  // or another empty inline element. Repeated until stable so nested empties
  // collapse from the inside out.
  const EMPTYISH = '(?:[\\s\\u00A0]|<br\\s*/?>|&nbsp;|&#160;|&#xa0;|<p>\\s*</p>|<span>\\s*</span>)*'
  const reLi = new RegExp(`<li[^>]*>${EMPTYISH}<\\/li>`, 'gi')
  const reP = new RegExp(`<p[^>]*>${EMPTYISH}<\\/p>`, 'gi')
  const reUl = /<ul[^>]*>\s*<\/ul>/gi
  const reOl = /<ol[^>]*>\s*<\/ol>/gi

  let prev: string
  let out = html
  do {
    prev = out
    out = out.replace(reLi, '').replace(reP, '').replace(reUl, '').replace(reOl, '')
  } while (out !== prev)
  return out
}

export function sanitizeOfferHtml(input: string): string {
  if (!input) return ''
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    KEEP_CONTENT: true,
  }) as unknown as string
  return stripEmptyContainers(cleaned)
}

export function buildReferenceNo(numId: number, offerDate: Date): string {
  const year = offerDate.getFullYear()
  const padded = String(numId).padStart(4, '0')
  return `TH/HR/${year}/${padded}`
}

export function formatLetterDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export interface SalaryComponent {
  name: string
  perAnnum: number
  perMonth: number
}

export interface AnnexureInput {
  salaryComponents: SalaryComponent[] | null
  deductions: SalaryComponent[] | null
  totalSalary: number
}

export interface AnnexureSummary {
  grossPerMonth: number
  totalCtcPerAnnum: number
  takeHomePerMonth: number
}

export function computeAnnexureSummary(input: AnnexureInput): AnnexureSummary {
  const components = input.salaryComponents ?? []
  const deductions = input.deductions ?? []

  const grossPerMonth = components.length > 0
    ? Math.round(components.reduce((s, c) => s + c.perMonth, 0))
    : Math.round(input.totalSalary / 12)

  const monthlyDeductions = Math.round(
    deductions.reduce((s, d) => s + d.perMonth, 0)
  )

  return {
    grossPerMonth,
    totalCtcPerAnnum: Math.round(input.totalSalary),
    takeHomePerMonth: grossPerMonth - monthlyDeductions,
  }
}
