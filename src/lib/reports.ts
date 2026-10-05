// src/lib/reports.ts
//
// The reasons a person can give when reporting content (KALM-254), and the
// kinds of thing that can be reported. Shared by the report page, the API and
// the admin Reports desk so the three never drift apart. The reasons are
// deliberately plain-language: they say what the person saw, not which law it
// might break. Which law applies is for a lawyer to judge, not the form.

export const REPORT_REASONS = {
  illegal: 'Illegal or unlawful content',
  abusive: 'Abusive, hateful or threatening',
  fake: 'Fake, misleading or fraudulent',
  privacy: "Shares someone's private information",
  permission: 'Uses my photo or work without permission',
  other: 'Something else',
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;
export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];

// What the report is about. PROJECT_POST is not reportable by the public
// (a developer's posted project reaches the admin first).
export const REPORTABLE_TARGETS = ['CONTRACTOR', 'PROJECT', 'MESSAGE', 'OTHER'] as const;
export type ReportableTarget = (typeof REPORTABLE_TARGETS)[number];

export function reasonLabel(key: string): string {
  return (REPORT_REASONS as Record<string, string>)[key] ?? key;
}
