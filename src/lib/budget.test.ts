import { describe, expect, it } from 'vitest';
import { displayBudget, formatBudgetLabel, formatRupees, rupeesInWords } from './budget';

describe('rupee sign', () => {
  it('writes new amounts with the rupee sign and Indian grouping', () => {
    expect(formatRupees(1250000)).toBe('₹12,50,000');
    expect(formatBudgetLabel(1250000)).toBe('₹12,50,000');
    expect(formatBudgetLabel(null)).toBe('Not specified');
  });

  it('reads lakh and crore with the rupee sign', () => {
    expect(rupeesInWords(1250000)).toBe('₹12.5 lakh');
    expect(rupeesInWords(30000000)).toBe('₹3 crore');
    expect(rupeesInWords(50000)).toBeNull();
  });

  it('shows old "Rs." records with the rupee sign, and leaves everything else alone', () => {
    expect(displayBudget('Rs. 12,50,000')).toBe('₹12,50,000');
    expect(displayBudget('Rs 12,50,000')).toBe('₹12,50,000');
    expect(displayBudget('Under ₹50 L')).toBe('Under ₹50 L');
    expect(displayBudget('Not specified')).toBe('Not specified');
    expect(displayBudget('₹12,50,000')).toBe('₹12,50,000');
  });
});
