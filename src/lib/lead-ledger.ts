// src/lib/lead-ledger.ts
//
// Pure counting for the admin lead ledger (KALM-259): per contractor, how many
// leads in a month, how many were replied to, quoted, declined, still waiting,
// and how many a free contractor could not see in full. No database here, so
// the numbers can be tested. A "lead" is any QuoteRequest row (quote request,
// enquiry or project conversation), which is exactly what the free-tier cap
// counts (src/lib/lead-limits.ts).
//
// "Replied" means the contractor sent at least one message inside the app.
// Replies by email or WhatsApp outside the app are invisible to this screen.

import { LISTED_MONTHLY_LEAD_CAP } from './lead-limits';

export type LedgerRequest = {
  id: string;
  contractorId: string;
  status: 'PENDING' | 'CONTACTED' | 'QUOTED' | 'DECLINED';
  // How it arrived: QUOTE = the quote form on a profile, ENQUIRY = the
  // Message button on a profile, PROJECT = a conversation from a project post.
  kind?: 'QUOTE' | 'ENQUIRY' | 'PROJECT';
};
export type LedgerContractor = { id: string; name: string; tier: 'LISTED' | 'PLUS' | 'PRO' };

export type LedgerRow = {
  contractorId: string;
  name: string;
  tier: LedgerContractor['tier'];
  leads: number;
  byQuote: number; // arrived through the quote form
  byEnquiry: number; // arrived through the Message button
  byProject: number; // arrived from a project post
  emailFailed: number; // emails to this contractor that failed to send this month (Admin > Failed emails)
  replied: number;
  contacted: number; // contractor marked Contacted: spoke to them outside the app (their own say-so)
  quoted: number;
  declined: number;
  waiting: number; // still Pending and nobody has replied
  overFreeCap: number; // leads a free (Listed) contractor could not see in full
};

export type LedgerTotals = Omit<LedgerRow, 'contractorId' | 'name' | 'tier'>;

export function buildLedger(
  requests: LedgerRequest[],
  repliedRequestIds: Set<string>,
  contractors: LedgerContractor[],
  // Failed emails this month per contractor id, from the EmailFailure log
  // matched on the contractor's email address. Delivery itself is not tracked,
  // so a missing entry does not prove an email arrived.
  emailFailuresByContractor: Map<string, number> = new Map()
): { rows: LedgerRow[]; totals: LedgerTotals } {
  const byId = new Map(contractors.map((c) => [c.id, c]));
  const rows = new Map<string, LedgerRow>();

  for (const r of requests) {
    const c = byId.get(r.contractorId);
    if (!c) continue;
    let row = rows.get(c.id);
    if (!row) {
      row = { contractorId: c.id, name: c.name, tier: c.tier, leads: 0, byQuote: 0, byEnquiry: 0, byProject: 0, emailFailed: 0, replied: 0, contacted: 0, quoted: 0, declined: 0, waiting: 0, overFreeCap: 0 };
      rows.set(c.id, row);
    }
    const replied = repliedRequestIds.has(r.id);
    row.leads += 1;
    if (r.kind === 'ENQUIRY') row.byEnquiry += 1;
    else if (r.kind === 'PROJECT') row.byProject += 1;
    else row.byQuote += 1;
    if (replied) row.replied += 1;
    if (r.status === 'CONTACTED') row.contacted += 1;
    if (r.status === 'QUOTED') row.quoted += 1;
    if (r.status === 'DECLINED') row.declined += 1;
    if (r.status === 'PENDING' && !replied) row.waiting += 1;
  }

  const list = [...rows.values()];
  for (const row of list) {
    row.emailFailed = emailFailuresByContractor.get(row.contractorId) ?? 0;
    row.overFreeCap = row.tier === 'LISTED' ? Math.max(0, row.leads - LISTED_MONTHLY_LEAD_CAP) : 0;
  }
  list.sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));

  const totals: LedgerTotals = { leads: 0, byQuote: 0, byEnquiry: 0, byProject: 0, emailFailed: 0, replied: 0, contacted: 0, quoted: 0, declined: 0, waiting: 0, overFreeCap: 0 };
  for (const row of list) {
    totals.leads += row.leads;
    totals.byQuote += row.byQuote;
    totals.byEnquiry += row.byEnquiry;
    totals.byProject += row.byProject;
    totals.emailFailed += row.emailFailed;
    totals.replied += row.replied;
    totals.contacted += row.contacted;
    totals.quoted += row.quoted;
    totals.declined += row.declined;
    totals.waiting += row.waiting;
    totals.overFreeCap += row.overFreeCap;
  }
  return { rows: list, totals };
}

// One spreadsheet cell. A value starting with = + - @ (or a tab or return) can
// run as a formula when the file is opened in Excel or Sheets, and contractor
// names are typed by outsiders, so those get a leading apostrophe. Commas,
// quotes and line breaks are wrapped in quotes.
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function ledgerToCsv(rows: LedgerRow[], totals: LedgerTotals): string {
  const plan: Record<LedgerContractor['tier'], string> = { LISTED: 'Listed', PLUS: 'Plus', PRO: 'Pro' };
  const lines = [
    ['Contractor', 'Plan', 'Leads', 'Via quote form', 'Via message', 'Via project post', 'Failed emails', 'Replied', 'Marked contacted', 'Quoted', 'Declined', 'Still waiting', 'Over free cap'],
  ];
  for (const r of rows) {
    lines.push(
      [r.name, plan[r.tier], r.leads, r.byQuote, r.byEnquiry, r.byProject, r.emailFailed, r.replied, r.contacted, r.quoted, r.declined, r.waiting, r.overFreeCap].map(String)
    );
  }
  lines.push(
    ['Total', '', totals.leads, totals.byQuote, totals.byEnquiry, totals.byProject, totals.emailFailed, totals.replied, totals.contacted, totals.quoted, totals.declined, totals.waiting, totals.overFreeCap].map(String)
  );
  return lines.map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// Every "YYYY-MM" from the current month back to the first month with a lead,
// newest first (for the month picker). Capped at 60 months.
export function monthKeysDescending(firstKey: string, currentKey: string): string[] {
  const [fy, fm] = firstKey.split('-').map(Number);
  let [y, m] = currentKey.split('-').map(Number);
  const keys: string[] = [];
  while ((y > fy || (y === fy && m >= fm)) && keys.length < 60) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      y -= 1;
      m = 12;
    }
  }
  return keys.length > 0 ? keys : [currentKey];
}

// One line per lead, for the drill-down under each contractor and the
// per-lead CSV: which developer sent it, through which medium, and how it
// stands. Newest first.
export type LeadDetailInput = LedgerRequest & {
  createdAt: Date;
  developerName: string;
  developerEmail: string;
};
export type LeadDetail = {
  id: string;
  contractorId: string;
  developerName: string;
  developerEmail: string;
  medium: 'Quote form' | 'Message' | 'Project post';
  status: LedgerRequest['status'];
  repliedInApp: boolean;
  createdAt: string; // ISO
};

export function buildLeadDetails(requests: LeadDetailInput[], repliedRequestIds: Set<string>): LeadDetail[] {
  return requests
    .map((r) => ({
      id: r.id,
      contractorId: r.contractorId,
      developerName: r.developerName,
      developerEmail: r.developerEmail,
      medium: (r.kind === 'ENQUIRY' ? 'Message' : r.kind === 'PROJECT' ? 'Project post' : 'Quote form') as LeadDetail['medium'],
      status: r.status,
      repliedInApp: repliedRequestIds.has(r.id),
      createdAt: r.createdAt.toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const STATUS_WORDS: Record<LedgerRequest['status'], string> = {
  PENDING: 'Pending',
  CONTACTED: 'Contacted',
  QUOTED: 'Quoted',
  DECLINED: 'Declined',
};

export function leadDetailsToCsv(details: LeadDetail[], contractors: LedgerContractor[]): string {
  const nameById = new Map(contractors.map((c) => [c.id, c.name]));
  const lines = [['Contractor', 'Developer', 'Developer email', 'Medium', 'Status', 'Replied in app', 'Received (India time)']];
  for (const d of details) {
    const when = new Date(new Date(d.createdAt).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
    lines.push([nameById.get(d.contractorId) ?? '', d.developerName, d.developerEmail, d.medium, STATUS_WORDS[d.status], d.repliedInApp ? 'Yes' : 'No', when]);
  }
  return lines.map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
