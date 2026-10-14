import { describe, expect, it } from 'vitest';
import { MAX_BUILT_UP_AREA_SQFT, NEEDED_BY_OPTIONS, formatArea, formatTrades } from './project-fields';

describe('formatArea', () => {
  it('groups digits the Indian way and adds the unit', () => {
    expect(formatArea(30000)).toBe('30,000 sq ft');
    expect(formatArea(125000)).toBe('1,25,000 sq ft');
  });
  it('returns null when there is no usable area', () => {
    expect(formatArea(null)).toBeNull();
    expect(formatArea(undefined)).toBeNull();
    expect(formatArea(0)).toBeNull();
  });
});

describe('formatTrades', () => {
  it('joins trades with commas and is empty for none', () => {
    expect(formatTrades(['Electrical', 'Plumbing & Sanitation'])).toBe('Electrical, Plumbing & Sanitation');
    expect(formatTrades([])).toBe('');
    expect(formatTrades(null)).toBe('');
  });
});

describe('limits', () => {
  it('keeps the timing options and area ceiling the forms rely on', () => {
    expect(NEEDED_BY_OPTIONS).toHaveLength(4);
    expect(MAX_BUILT_UP_AREA_SQFT).toBeGreaterThan(1_000_000);
  });
});
