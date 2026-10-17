// src/app/api/admin/contractors/[id]/invite/route.ts
//
// Admin "Send login link": emails a contractor who has no password yet a
// fresh 3-day link to set one (src/lib/contractor-invite.ts explains the
// rules, including why it refuses for anyone who already has a login).
// Sending again replaces the earlier link.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { rejectCrossOrigin } from '@/lib/same-origin';
import { checkRateLimit } from '@/lib/rate-limit';
import { inviteResultMessage, sendContractorInvite } from '@/lib/contractor-invite';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;

  // A few per contractor per hour: enough for "they lost it, send again",
  // not enough to fill someone's inbox by double-clicking.
  if (!(await checkRateLimit(`contractor-invite:${id}`, { maxAttempts: 3, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: 'Already sent several times this hour. Try again later.' }, { status: 429 });
  }

  const result = await sendContractorInvite(id);
  const status = result === 'sent' ? 200 : result === 'not-found' ? 404 : result === 'has-login' ? 409 : 502;
  return NextResponse.json({ result, message: inviteResultMessage(result) }, { status });
}
