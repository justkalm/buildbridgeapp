// src/lib/budget.ts
//
// The developer's budget on the "Request a quote" form is a typed-in
// rupee amount, and it's optional (owner, 2 Oct; it replaced a fixed
// dropdown of ranges). All amounts are shown with the rupee sign and Indian
// digit grouping (₹12,50,000), never a bare number. (Changed from "Rs." on
// 10 Oct 2026, owner's call: the sign looks more professional, and the old
// range labels and the Pricing page already used it.)
//
// The amount is stored in QuoteRequest.budgetRangeLabel as display text
// ("₹12,50,000" or "Not specified"), the same column the old ranges
// used, so old requests ("Under ₹50 L" and so on) still display as they
// were and no database change is needed. Requests saved before 10 Oct 2026
// hold "Rs. 12,50,000"; displayBudget() shows those with the rupee sign too. The API builds the text itself
// from the number (formatBudgetLabel), so the format is always the same.

// Rs. 1 lakh crore. Far above any real project; stops absurd input.
export const MAX_BUDGET_RUPEES = 1_000_000_000_000;

export const NO_BUDGET_LABEL = 'Not specified';

export function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatBudgetLabel(amount: number | null | undefined): string {
  return amount && amount > 0 ? formatRupees(amount) : NO_BUDGET_LABEL;
}

/** Keeps only digits from what was typed, so "12,50,000" and "1250000" both work. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+/, '');
}

/** "₹12.5 lakh" / "₹3 crore", shown under the box as a reading aid. */
export function rupeesInWords(amount: number): string | null {
  if (amount >= 1_00_00_000) return `₹${trim(amount / 1_00_00_000)} crore`;
  if (amount >= 1_00_000) return `₹${trim(amount / 1_00_000)} lakh`;
  return null;
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Shows a stored budget with the rupee sign: old "Rs. 12,50,000" becomes "₹12,50,000"; anything else is left as it is. */
export function displayBudget(label: string): string {
  return label.replace(/^Rs\.?\s*/, '₹');
}
