// src/app/api/developers/shortlist/[contractorId]/route.ts
//
// DELETE removes a contractor from the signed-in developer's shortlist.
// Scoped by developerId + contractorId together (not just the shortlist
// entry's own id), which also serves as the ownership check — a developer
// can only ever delete their own shortlist entries, since the delete
// target is defined by their own session id plus the contractor id in the
// URL, not an arbitrary entry id someone could guess.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { contractorId } = await params;
  const developerId = session.user.id as string;

  // deleteMany rather than delete: delete requires a unique-constraint
  // match and throws if nothing matches, which would mean handling a
  // "not found" error case just to treat it the same as success anyway
  // (removing something already-removed is a no-op, not an error, from
  // the UI's point of view — the save button just toggles state).
  await prisma.shortlistedContractor.deleteMany({
    where: { developerId, contractorId },
  });

  return NextResponse.json({ ok: true });
}
