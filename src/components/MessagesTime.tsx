// src/components/MessagesTime.tsx
//
// Date wording shared by the Messages inbox and conversation screens.
// Plain functions, no components: this file only has a .tsx extension so
// it sits with the other Messages* files it belongs to.
//
// Every function takes `now` as an argument instead of reading the clock
// itself. The pages capture `now` when their data arrives (in the fetch
// callback) and pass it down, which keeps rendering pure (the repo's lint
// rules forbid Date.now() during render) and means a list can't show
// "2m" on one row and "3m" on the next for the same moment.
//
// Formatting is done by hand rather than with toLocaleString so the
// output is the same on every phone ("10:42 am", "Mon 12 Oct") whatever
// locale the browser reports; the audience is in India, and a US-style
// "Oct 12" or 24-hour clock on some devices would read as inconsistent.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Whole calendar days between two instants (0 = same day, 1 = yesterday).
// Uses local midnights and rounds, so a daylight-saving shift can't turn
// "yesterday" into "2 days ago".
function daysBetween(earlier: number, later: number): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / 86_400_000);
}

// "12 Oct", or "12 Oct 2025" when it isn't this year.
function dayMonth(d: Date, now: Date): string {
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// Inbox row time: "now", "2m", "3h", then the weekday for the past week
// ("Mon"), then a date ("12 Oct").
export function formatRelativeShort(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const d = new Date(t);
  if (daysBetween(t, now) < 7) return DAYS[d.getDay()];
  return dayMonth(d, new Date(now));
}

// Time under a bubble: "10:42 am".
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${h24 < 12 ? 'am' : 'pm'}`;
}

// Day separator in a conversation: "Today", "Yesterday", "Mon 12 Oct".
export function formatDayLabel(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const days = daysBetween(t, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(t);
  return `${DAYS[d.getDay()]} ${dayMonth(d, new Date(now))}`;
}

// Key for grouping messages by local calendar day.
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
