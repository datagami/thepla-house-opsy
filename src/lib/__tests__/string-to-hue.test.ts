import { describe, it, expect } from 'vitest';
import { stringToHue } from '@/lib/utils';

describe('stringToHue', () => {
  it('returns a number in [0, 359]', () => {
    const h = stringToHue('Rohit Kumar');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it('is deterministic for the same input', () => {
    expect(stringToHue('Anya Sharma')).toBe(stringToHue('Anya Sharma'));
  });

  it('produces different hues for different inputs', () => {
    expect(stringToHue('Rohit')).not.toBe(stringToHue('Anya'));
  });

  it('handles the empty string', () => {
    expect(stringToHue('')).toBe(0);
  });
});
