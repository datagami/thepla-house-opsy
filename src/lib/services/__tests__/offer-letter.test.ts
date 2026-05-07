import { describe, it, expect } from 'vitest'
import {
  sanitizeOfferHtml,
  buildReferenceNo,
  formatLetterDate,
} from '@/lib/services/offer-letter'

describe('sanitizeOfferHtml', () => {
  it('preserves the clause structure used by the print stylesheet', () => {
    const html = '<section class="clause"><div class="clause-head">' +
      '<span class="num-mark">03</span>' +
      '<span class="title-en">Working Hours</span>' +
      '<span class="title-hi hi">कार्य समय</span>' +
      '</div><p class="body">9 to 6.</p></section>'
    const out = sanitizeOfferHtml(html)
    expect(out).toContain('<section class="clause">')
    expect(out).toContain('<span class="num-mark">')
    expect(out).toContain('कार्य समय')
    expect(out).toContain('<p class="body">')
  })

  it('strips <script> tags', () => {
    const out = sanitizeOfferHtml('<p>Hi</p><script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('<p>Hi</p>')
  })

  it('strips javascript: hrefs', () => {
    const out = sanitizeOfferHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('strips on* event handlers', () => {
    const out = sanitizeOfferHtml('<p onclick="alert(1)">Hi</p>')
    expect(out).not.toMatch(/onclick/i)
  })

  it('strips <iframe>, <object>, <embed>, <form>', () => {
    const out = sanitizeOfferHtml(
      '<iframe src="x"></iframe><object></object><embed><form></form>'
    )
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('<object')
    expect(out).not.toContain('<embed')
    expect(out).not.toContain('<form')
  })

  it('preserves https://, mailto:, tel:, and # hrefs', () => {
    const out = sanitizeOfferHtml(
      '<a href="https://example.com">a</a>' +
      '<a href="mailto:x@y.com">b</a>' +
      '<a href="tel:+91123">c</a>' +
      '<a href="#anchor">d</a>'
    )
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('href="mailto:x@y.com"')
    expect(out).toContain('href="tel:+91123"')
    expect(out).toContain('href="#anchor"')
  })

  it('returns empty string for empty / whitespace input', () => {
    expect(sanitizeOfferHtml('')).toBe('')
    expect(sanitizeOfferHtml('   ').trim()).toBe('')
  })

  it('returns empty string when only forbidden content is given', () => {
    expect(sanitizeOfferHtml('<script>alert(1)</script>').trim()).toBe('')
  })

  it('preserves <ul>, <ol>, <li>, <strong>, <em>, <table>', () => {
    const html = '<ul><li><strong>Bold</strong></li></ul>' +
      '<table><thead><tr><th>H</th></tr></thead>' +
      '<tbody><tr><td>D</td></tr></tbody></table>'
    const out = sanitizeOfferHtml(html)
    expect(out).toContain('<ul>')
    expect(out).toContain('<li>')
    expect(out).toContain('<strong>')
    expect(out).toContain('<table>')
    expect(out).toContain('<th>')
  })
})

describe('buildReferenceNo', () => {
  it('zero-pads numId to 4 digits', () => {
    expect(buildReferenceNo(42, new Date('2026-05-07'))).toBe('TH/HR/2026/0042')
  })

  it('preserves 4+ digit numIds without truncation', () => {
    expect(buildReferenceNo(12345, new Date('2026-01-01'))).toBe('TH/HR/2026/12345')
  })

  it('uses the offerDate year', () => {
    expect(buildReferenceNo(1, new Date('2024-12-31'))).toBe('TH/HR/2024/0001')
  })
})

describe('formatLetterDate', () => {
  it('formats as en-GB long', () => {
    expect(formatLetterDate(new Date('2026-05-07'))).toBe('7 May 2026')
  })

  it('handles single-digit day', () => {
    expect(formatLetterDate(new Date('2026-01-09'))).toBe('9 January 2026')
  })

  it('handles double-digit day', () => {
    expect(formatLetterDate(new Date('2026-12-25'))).toBe('25 December 2026')
  })
})
