// src/lib/budget.ts
//
// The developer's budget on the "Request a quote" form is a typed-in
// rupee amount, and it's optional (owner, 2 Oct; it replaced a fixed
// dropdown of ranges). All amounts are shown as "Rs." with Indian digit
// grouping (Rs. 12,50,000), never a bare number or "₹".
//
// The amount is stored in QuoteRequest.budgetRangeLabel as display text
// ("Rs. 12,50,000" or "Not specified"), the same column the old ranges
// used, so old requests ("Under ₹50 L" and so on) still display as they
// were and no database change is needed. The API builds the text itself
// from the number (formatBudgetLabel), so the format is always the same.

// Rs. 1 lakh crore. Far above any real project; stops absurd input.
export const MAX_BUDGET_RUPEES = 1_000_000_000_000;

export const NO_BUDGET_LABEL = 'Not specified';

export function formatRupees(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatBudgetLabel(amount: number | null | undefined): string {
  return amount && amount > 0 ? formatRupees(amount) : NO_BUDGET_LABEL;
}

/** Keeps only digits from what was typed, so "12,50,000" and "1250000" both work. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+/, '');
}

/** "Rs. 12.5 lakh" / "Rs. 3 crore", shown under the box as a reading aid. */
export function rupeesInWords(amount: number): string | null {
  if (amount >= 1_00_00_000) return `Rs. ${trim(amount / 1_00_00_000)} crore`;
  if (amount >= 1_00_000) return `Rs. ${trim(amount / 1_00_000)} lakh`;
  return null;
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}
