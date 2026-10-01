// src/app/api/admin/logout/route.ts
//
// POST { everywhere?: boolean }. Ends this browser's admin session, or with
// `everywhere: true` revokes every open admin session on every device (see
// src/lib/admin-auth.ts). Signing out of everywhere requires being signed
// in, so a stranger can't kick the admin out; plain sign-out doesn't, since
// clearing your own cookie is always harmless.

import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSession, isAdminAuthenticated } from '@/lib/admin-auth';
import { rejectCrossOrigin } from '@/lib/same-origin';

export async function POST(req: NextRequest) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;

  let everywhere = false;
  try {
    everywhere = (await req.json())?.everywhere === true;
  } catch {
    // No body: plain sign-out.
  }

  if (everywhere && !(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await clearAdminSession({ everywhere });
  return NextResponse.json({ ok: true });
}
