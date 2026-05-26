import { describe, it, expect } from 'vitest';
import { toISTDate, toISTTimeString } from '@/lib/kiosk-time';

describe('toISTTimeString', () => {
  it('formats a UTC instant as IST HH:mm (24h)', () => {
    // 2026-05-26T03:30:00Z == 09:00 IST
    expect(toISTTimeString(new Date('2026-05-26T03:30:00Z'))).toBe('09:00');
  });

  it('handles midnight crossover correctly', () => {
    // 2026-05-26T18:30:00Z == 00:00 IST on 2026-05-27
    expect(toISTTimeString(new Date('2026-05-26T18:30:00Z'))).toBe('00:00');
  });

  it('zero-pads single-digit hours', () => {
    // 2026-05-26T02:00:00Z == 07:30 IST
    expect(toISTTimeString(new Date('2026-05-26T02:00:00Z'))).toBe('07:30');
  });
});

describe('toISTDate', () => {
  it('returns the IST calendar date at midnight UTC of that IST day', () => {
    // 2026-05-26T20:00:00Z == 01:30 IST on 2026-05-27
    const d = toISTDate(new Date('2026-05-26T20:00:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-05-27');
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it('keeps the same calendar day for a noon-IST punch', () => {
    // 2026-05-26T06:30:00Z == 12:00 IST on 2026-05-26
    const d = toISTDate(new Date('2026-05-26T06:30:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-05-26');
  });

  it('handles the IST day boundary near 18:30 UTC', () => {
    // 18:29 UTC = 23:59 IST same day
    const a = toISTDate(new Date('2026-05-26T18:29:00Z'));
    expect(a.toISOString().slice(0, 10)).toBe('2026-05-26');
    // 18:30 UTC = 00:00 IST next day
    const b = toISTDate(new Date('2026-05-26T18:30:00Z'));
    expect(b.toISOString().slice(0, 10)).toBe('2026-05-27');
  });
});
