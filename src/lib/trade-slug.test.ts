import { describe, expect, it } from 'vitest';
import { ALL_TRADES, tradeFromSlug, tradeSlug } from './trade-types';

describe('trade page addresses', () => {
  it('turns a trade name into a readable address', () => {
    expect(tradeSlug('Waterproofing & Roofing')).toBe('waterproofing-and-roofing');
    expect(tradeSlug('Ceilings, Partitions & Interiors')).toBe('ceilings-partitions-and-interiors');
    expect(tradeSlug('ELV, Security & Automation')).toBe('elv-security-and-automation');
  });

  it('gives every trade its own address that leads back to it', () => {
    const slugs = ALL_TRADES.map(tradeSlug);
    expect(new Set(slugs).size).toBe(ALL_TRADES.length);
    for (const trade of ALL_TRADES) expect(tradeFromSlug(tradeSlug(trade))?.trade).toBe(trade);
  });

  it('knows nothing about an address that is not a trade', () => {
    expect(tradeFromSlug('not-a-trade')).toBeNull();
  });
});
