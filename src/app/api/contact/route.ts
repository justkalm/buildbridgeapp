// src/app/api/contact/route.ts
//
// Handles the public contact form on /contact. No auth required — anyone
// can reach out. Rate limited per IP (5/hour) so this can't be scripted
// into a spam vector against the inbox it forwards to.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendContactFormEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email address').max(320),
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`contact-form:${ip}`, { maxAttempts: 5, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json(
      { error: 'Too many messages sent. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const sent = await sendContactFormEmail(parsed.data);

  if (!sent) {
    return NextResponse.json(
      { error: 'Could not send your message right now. Please try again shortly.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
