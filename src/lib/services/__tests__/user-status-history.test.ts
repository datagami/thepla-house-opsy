import { describe, it, expect } from 'vitest';
import { resolveStatusOnDate, NOT_WORKING_STATUSES } from '@/lib/services/user-status-history';
import type { UserStatusHistory } from '@prisma/client';

const mkRow = (toStatus: 'ACTIVE' | 'INACTIVE' | 'PARTIAL_INACTIVE' | 'PENDING', changedAt: string, fromStatus: 'ACTIVE' | 'INACTIVE' | 'PARTIAL_INACTIVE' | 'PENDING' | null = null): UserStatusHistory => ({
  id: `r-${changedAt}`,
  userId: 'u1',
  fromStatus: fromStatus as any,
  toStatus: toStatus as any,
  changedAt: new Date(changedAt),
  changedById: null,
  reason: null,
});

describe('NOT_WORKING_STATUSES', () => {
  it('contains INACTIVE and PARTIAL_INACTIVE', () => {
    expect(NOT_WORKING_STATUSES.has('INACTIVE' as any)).toBe(true);
    expect(NOT_WORKING_STATUSES.has('PARTIAL_INACTIVE' as any)).toBe(true);
  });
  it('does not contain ACTIVE or PENDING', () => {
    expect(NOT_WORKING_STATUSES.has('ACTIVE' as any)).toBe(false);
    expect(NOT_WORKING_STATUSES.has('PENDING' as any)).toBe(false);
  });
});

describe('resolveStatusOnDate', () => {
  const history = [
    mkRow('ACTIVE', '2026-01-01'),
    mkRow('INACTIVE', '2026-02-15', 'ACTIVE'),
    mkRow('ACTIVE', '2026-04-01', 'INACTIVE'),
  ];

  it('returns null for dates before any history entry', () => {
    expect(resolveStatusOnDate(history, new Date('2025-12-31'))).toBeNull();
  });

  it('returns ACTIVE for dates between first and second entry', () => {
    expect(resolveStatusOnDate(history, new Date('2026-01-15'))).toBe('ACTIVE');
  });

  it('returns INACTIVE for dates between second and third entry', () => {
    expect(resolveStatusOnDate(history, new Date('2026-03-15'))).toBe('INACTIVE');
  });

  it('returns ACTIVE for dates after the final entry', () => {
    expect(resolveStatusOnDate(history, new Date('2026-06-01'))).toBe('ACTIVE');
  });

  it('treats the changedAt boundary inclusively (status on the day-of equals the new status)', () => {
    expect(resolveStatusOnDate(history, new Date('2026-02-15'))).toBe('INACTIVE');
  });

  it('returns null for empty history', () => {
    expect(resolveStatusOnDate([], new Date('2026-01-01'))).toBeNull();
  });
});
