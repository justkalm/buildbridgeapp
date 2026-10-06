// src/lib/lead-report.ts
//
// The lead report an admin can send to ONE contractor for ONE month (KALM-259
// follow-up): how many leads, how they arrived, where the projects are and
// what kind of work, and what happened to each. Pure counting, no database.
//
// It is written for the contractor, so it follows the same rule as their
// dashboard (src/app/api/contractors/me/route.ts): on the free (Listed) plan,
// leads past the monthly cap in the CURRENT month are shown without contact
// details. This report never carries a developer's email or phone, and never
// the details text, for any lead. Developer names are shown for every lead,
// exactly as the dashboard does.

import { computeLeadVisibility, LISTED_MONTHLY_LEAD_CAP } from './lead-limits';

export type ReportRequest = {
  id: string;
  status: 'PENDING' | 'CONTACTED' | 'QUOTED' | 'DECLINED' | 'CLOSED';
  kind?: 'QUOTE' | 'ENQUIRY' | 'PROJECT' | 'SITE_VISIT';
  statusLabel?: string; // plain words for a site visit, e.g. "Visit confirmed"
  createdAt: Date;
  developerName: string;
  projectType: string;
  location: string;
};

export type ReportLead = {
  id: string;
  receivedAt: string; // ISO
  developerName: string;
  projectType: string;
  location: string;
  medium: 'Quote form' | 'Message' | 'Project post' | 'Site visit';
  status: ReportRequest['status'];
  statusLabel?: string;
  repliedInApp: boolean;
  contactsHidden: boolean; // beyond the free-plan cap this month
};

export type Tally = { label: string; count: number };

export type ContractorReport = {
  total: number;
  byMedium: Tally[];
  byLocation: Tally[];
  byProjectType: Tally[];
  repliedInApp: number;
  contacted: number;
  quoted: number;
  declined: number;
  waiting: number;
  hiddenCount: number; // leads shown without contact details (free plan, current month)
  freeCap: number;
  leads: ReportLead[]; // newest first
};

function mediumOf(kind: ReportRequest['kind']): ReportLead['medium'] {
  return kind === 'ENQUIRY' ? 'Message' : kind === 'PROJECT' ? 'Project post' : kind === 'SITE_VISIT' ? 'Site visit' : 'Quote form';
}

// Counts by label, ignoring case and extra spaces, showing the first spelling
// seen (tidied, see below). Biggest first, then A to Z. Blank labels count as "Not given".
function tally(values: string[]): Tally[] {
  const seen = new Map<string, Tally>();
  for (const raw of values) {
    const clean = raw.replace(/\s+/g, ' ').trim() || 'Not given';
    const key = clean.toLowerCase();
    const entry = seen.get(key);
    if (entry) entry.count += 1;
    // An all-lowercase entry ("thane") is shown capitalised ("Thane"); anything
    // with its own capitals (BKC, Andheri West) is shown as typed.
    else seen.set(key, { label: clean === key ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : clean, count: 1 });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildContractorReport(
  requests: ReportRequest[],
  repliedRequestIds: Set<string>,
  tier: 'LISTED' | 'PLUS' | 'PRO',
  isCurrentMonth: boolean
): ContractorReport {
  // The cap only ever applies to the current month (earlier months are never
  // locked), and "which are free" is first come first served within the month.
  // Same order as the database queries behind the dashboard: oldest first, and
  // for two leads in the same millisecond, by id, so the free five never shuffle.
  const oldestFirst = [...requests].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const visibility = isCurrentMonth ? computeLeadVisibility(tier, oldestFirst) : new Map();

  const leads: ReportLead[] = requests
    .map((r) => ({
      id: r.id,
      receivedAt: r.createdAt.toISOString(),
      developerName: r.developerName,
      projectType: r.projectType,
      location: r.location,
      medium: mediumOf(r.kind),
      status: r.status,
      statusLabel: r.statusLabel,
      repliedInApp: repliedRequestIds.has(r.id),
      contactsHidden: visibility.get(r.id) === 'blurred',
    }))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return {
    total: leads.length,
    byMedium: tally(leads.map((l) => l.medium)),
    // A site visit request has no project type or area of its own, so it is
    // left out of these two tallies (it still counts in the medium tally).
    byLocation: tally(leads.filter((l) => l.medium !== 'Site visit').map((l) => l.location)),
    byProjectType: tally(leads.filter((l) => l.medium !== 'Site visit').map((l) => l.projectType)),
    repliedInApp: leads.filter((l) => l.repliedInApp).length,
    contacted: leads.filter((l) => l.status === 'CONTACTED').length,
    quoted: leads.filter((l) => l.status === 'QUOTED').length,
    declined: leads.filter((l) => l.status === 'DECLINED').length,
    waiting: leads.filter((l) => l.status === 'PENDING' && !l.repliedInApp).length,
    hiddenCount: leads.filter((l) => l.contactsHidden).length,
    freeCap: LISTED_MONTHLY_LEAD_CAP,
    leads,
  };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthLabelOf(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// Plain text for pasting into WhatsApp or an email. No developer contact
// details, same as the printed report.
export function reportToText(report: ContractorReport, contractorName: string, monthKey: string): string {
  const list = (items: Tally[]) => (items.length ? items.map((t) => `  ${t.label}: ${t.count}`).join('\n') : '  None');
  const lines = [
    `(kalm) lead report for ${contractorName}`,
    `${monthLabelOf(monthKey)} (India time)`,
    '',
    `Leads received: ${report.total}`,
    `Replied to in the app: ${report.repliedInApp}`,
    `Marked contacted: ${report.contacted}`,
    `Quoted: ${report.quoted}`,
    `Declined: ${report.declined}`,
    `Still waiting for a reply: ${report.waiting}`,
    '',
    'How they arrived:',
    list(report.byMedium),
    '',
    'Where the projects are:',
    list(report.byLocation),
    '',
    'Type of work:',
    list(report.byProjectType),
  ];
  if (report.hiddenCount > 0) {
    lines.push('', `${report.hiddenCount} lead${report.hiddenCount === 1 ? '' : 's'} this month came after the ${report.freeCap} full leads the free plan includes, so contact details for ${report.hiddenCount === 1 ? 'it are' : 'them are'} not shown.`);
  }
  lines.push('', 'Counts activity inside (kalm) only. Replies by phone, email or WhatsApp outside the app are not visible to us unless you mark the lead Contacted.');
  return lines.join('\n');
}
