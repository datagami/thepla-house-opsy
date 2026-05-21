import { describe, it, expect } from 'vitest';
import { getInitials } from '@/lib/utils';

describe('getInitials', () => {
  it('uses first letters of first and last whitespace-separated tokens', () => {
    expect(getInitials('Rohit Kumar')).toBe('RK');
  });

  it('returns a single uppercase letter for one-word names', () => {
    expect(getInitials('Rohit')).toBe('R');
  });

  it('ignores middle tokens', () => {
    expect(getInitials('Rohit Kumar Singh')).toBe('RS');
  });

  it('collapses extra whitespace', () => {
    expect(getInitials('  Rohit   Kumar  ')).toBe('RK');
  });

  it('returns "?" for null/undefined/empty input', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });

  it('uppercases lowercase input', () => {
    expect(getInitials('rohit kumar')).toBe('RK');
  });
});
