// src/lib/email.ts
//
// Wraps Resend. One narrow function per email the app sends (quote request,
// project post, verification, reset, claim, contact form, quote status
// change, new message, and the four site visit emails) rather than a
// generic "send any email" helper. Each has its own template and failure
// wording, and it's easier to add another specific function than to unpick
// a generic one.

import { Resend } from 'resend';
import { formatVisitTime } from '@/lib/site-visits';
import { prisma } from '@/lib/prisma';

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// Every sender below reports a failure through here, both when Resend hands
// back { error } (the usual case) and when the call throws. It logs, and
// also saves a short row (EmailFailure) so admin can see dropped emails at
// Admin > Failed emails instead of digging through server logs. Only the
// email's label, recipient and a short error string are stored, never the
// body or any link/token. It must never throw: a broken log table should not
// turn a failed email into a failed signup or quote request.
export async function recordEmailFailure(
  label: string,
  to: string | string[],
  error: unknown
): Promise<void> {
  console.error(`Email failed (${label}):`, error);
  try {
    let message: string;
    if (error instanceof Error) message = error.message;
    else if (typeof error === 'string') message = error;
    else {
      try {
        message = JSON.stringify(error) ?? String(error);
      } catch {
        message = String(error);
      }
    }
    await prisma.emailFailure.create({
      data: {
        label: label.slice(0, 100),
        to: (Array.isArray(to) ? to.join(', ') : String(to)).slice(0, 500),
        error: message.slice(0, 500),
      },
    });
  } catch (dbErr) {
    console.error('Could not save email failure row:', dbErr);
  }
}

type QuoteRequestEmailInput = {
  contractorName: string;
  developerName: string;
  developerEmail: string;
  contactPhone: string;
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
};

// Returns true if the email was sent, false if it failed. Callers should
// check this and record it (see QuoteRequest.emailSentAt in the schema) —
// a silently dropped notification defeats the entire point of this feature,
// so failures need to be visible, not swallowed.
export async function sendQuoteRequestEmail(input: QuoteRequestEmailInput): Promise<boolean> {
  const notifyAddress = process.env.QUOTE_NOTIFICATION_EMAIL;

  if (!notifyAddress) {
    console.error('QUOTE_NOTIFICATION_EMAIL is not set — cannot send quote request email');
    return false;
  }

  try {
    const { error } = await getResendClient().emails.send({
      // Resend's test domain works without any DNS setup, but only sends to
      // the email address you signed up with. Once you verify your own
      // domain in Resend's dashboard, swap this to something like
      // "BuildBridge <quotes@yourdomain.com>" — see the deployment notes.
      from: '(Kalm) <onboarding@resend.dev>',
      to: notifyAddress,
      subject: `New quote request for ${sanitizeSubject(input.contractorName)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px;">
          <h2 style="margin-bottom: 4px;">New Quote Request</h2>
          <p style="color: #666; margin-top: 0;">for ${escapeHtml(input.contractorName)}</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 140px;">From</td><td style="padding: 8px 0;">${escapeHtml(input.developerName)} (${escapeHtml(input.developerEmail)})</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Phone</td><td style="padding: 8px 0;">${escapeHtml(input.contactPhone)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Project type</td><td style="padding: 8px 0;">${escapeHtml(input.projectType)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Location</td><td style="padding: 8px 0;">${escapeHtml(input.location)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Budget</td><td style="padding: 8px 0;">${escapeHtml(input.budgetRangeLabel)}</td></tr>
          </table>

          <p style="color: #666; margin-bottom: 4px;">Details</p>
          <p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>
        </div>
      `,
    });

    if (error) {
      await recordEmailFailure('quote request', notifyAddress, error);
      return false;
    }

    return true;
  } catch (err) {
    await recordEmailFailure('quote request', notifyAddress, err);
    return false;
  }
}

type ProjectPostEmailInput = {
  developerName: string;
  developerEmail: string;
  contactPhone: string;
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
};

// Notifies admin (QUOTE_NOTIFICATION_EMAIL — same inbox as quote requests
// and contact form) that a developer posted a project via the general
// "Post a Project" form. This is intentionally NOT visible to any
// contractor at this point — see the ProjectPost schema comment. Admin
// reads this, decides who (if anyone) should hear about it, and sends
// that via sendProjectPostAlertEmail below — a completely separate,
// later, manual step.
export async function sendProjectPostAdminEmail(input: ProjectPostEmailInput): Promise<boolean> {
  const notifyAddress = process.env.QUOTE_NOTIFICATION_EMAIL;

  if (!notifyAddress) {
    console.error('QUOTE_NOTIFICATION_EMAIL is not set — cannot send project post email');
    return false;
  }

  try {
    const { error } = await getResendClient().emails.send({
      from: '(Kalm) <onboarding@resend.dev>',
      to: notifyAddress,
      subject: `New project posted: ${sanitizeSubject(input.projectType)} in ${sanitizeSubject(input.location)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px;">
          <h2 style="margin-bottom: 4px;">New Project Posted</h2>
          <p style="color: #666; margin-top: 0;">Not yet matched to any contractor. Review it and alert PRO contractors from admin.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 140px;">From</td><td style="padding: 8px 0;">${escapeHtml(input.developerName)} (${escapeHtml(input.developerEmail)})</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Phone</td><td style="padding: 8px 0;">${escapeHtml(input.contactPhone)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Project type</td><td style="padding: 8px 0;">${escapeHtml(input.projectType)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Location</td><td style="padding: 8px 0;">${escapeHtml(input.location)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Budget</td><td style="padding: 8px 0;">${escapeHtml(input.budgetRangeLabel)}</td></tr>
          </table>

          <p style="color: #666; margin-bottom: 4px;">Details</p>
          <p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>
        </div>
      `,
    });

    if (error) {
      await recordEmailFailure('project post admin', notifyAddress, error);
      return false;
    }

    return true;
  } catch (err) {
    await recordEmailFailure('project post admin', notifyAddress, err);
    return false;
  }
}

// Tells the admin inbox (QUOTE_NOTIFICATION_EMAIL, the same one as quote
// requests) that a contractor's project is waiting for review (KALM-253).
// Without this, a pending project could sit unseen: nothing else tells the
// admin a submission arrived. The email carries the title and the contractor's
// name only. Photos are deliberately NOT included, so an unreviewed image
// never lands in an inbox; the admin opens the Review page to look at it.
export async function sendProjectForReviewEmail(input: {
  contractorName: string;
  projectTitle: string;
  photoCount: number;
  kind: 'new' | 'edited';
  reviewUrl: string;
}): Promise<boolean> {
  const notifyAddress = process.env.QUOTE_NOTIFICATION_EMAIL;

  if (!notifyAddress) {
    console.error('QUOTE_NOTIFICATION_EMAIL is not set, cannot send project review email');
    return false;
  }

  const what = input.kind === 'new' ? 'New project' : 'Edited project';

  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: notifyAddress,
      subject: `${what} waiting for review: ${sanitizeSubject(input.projectTitle)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px;">
          <h2 style="margin-bottom: 4px;">${what} waiting for review</h2>
          <p style="color: #666; margin-top: 0;">It is hidden from the public until you approve it.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 140px;">Contractor</td><td style="padding: 8px 0;">${escapeHtml(input.contractorName)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Project</td><td style="padding: 8px 0;">${escapeHtml(input.projectTitle)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Photos</td><td style="padding: 8px 0;">${input.photoCount}</td></tr>
          </table>
          <p><a href="${escapeHtml(input.reviewUrl)}">Open the Review page</a></p>
        </div>
      `,
    });

    if (error) {
      await recordEmailFailure('project for review', notifyAddress, error);
      return false;
    }

    return true;
  } catch (err) {
    await recordEmailFailure('project for review', notifyAddress, err);
    return false;
  }
}

// Tells the admin inbox that someone reported content (KALM-254). It carries
// what was reported, why, the reporter's details and their own words. It never
// carries a message's text or any photo: the admin opens the Reports desk and
// looks at the content there.
export async function sendReportEmail(input: {
  reasonLabel: string;
  targetSummary: string;
  details: string;
  reporterEmail: string;
  reporterRole: string | null;
  reportsUrl: string;
}): Promise<boolean> {
  const notifyAddress = process.env.QUOTE_NOTIFICATION_EMAIL;

  if (!notifyAddress) {
    console.error('QUOTE_NOTIFICATION_EMAIL is not set, cannot send report email');
    return false;
  }

  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: notifyAddress,
      subject: `Content report: ${sanitizeSubject(input.reasonLabel)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px;">
          <h2 style="margin-bottom: 4px;">Content report</h2>
          <p style="color: #666; margin-top: 0;">Someone has reported content on the site. Please look at it soon.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 140px;">Reason</td><td style="padding: 8px 0;">${escapeHtml(input.reasonLabel)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">About</td><td style="padding: 8px 0;">${escapeHtml(input.targetSummary)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Reported by</td><td style="padding: 8px 0;">${escapeHtml(input.reporterEmail)}${input.reporterRole ? ` (${escapeHtml(input.reporterRole)})` : ' (not logged in)'}</td></tr>
          </table>
          ${input.details ? `<p style="color: #666; margin-bottom: 4px;">Their words</p><p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>` : ''}
          <p><a href="${escapeHtml(input.reportsUrl)}">Open the Reports page</a></p>
        </div>
      `,
    });

    if (error) {
      await recordEmailFailure('content report', notifyAddress, error);
      return false;
    }

    return true;
  } catch (err) {
    await recordEmailFailure('content report', notifyAddress, err);
    return false;
  }
}

type ProjectPostAlertEmailInput = {
  toEmail: string;
  toName: string;
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
};

// Sent to a specific contractor when admin manually alerts them about a
// posted project — this is the actual PRO perk landing in someone's inbox.
// Deliberately does NOT include the developer's contact details in the
// email itself: the contractor sees those in their dashboard
// (/contractor/dashboard), which requires being logged in as that
// contractor. Keeping contact info out of the email means a forwarded or
// leaked email doesn't hand a developer's phone/email to whoever it ends
// up with.
export async function sendProjectPostAlertEmail(input: ProjectPostAlertEmailInput): Promise<boolean> {
  try {
    const { error } = await getResendClient().emails.send({
      from: '(Kalm) <onboarding@resend.dev>',
      to: input.toEmail,
      subject: `New lead: ${sanitizeSubject(input.projectType)} in ${sanitizeSubject(input.location)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px;">
          <h2 style="margin-bottom: 4px;">A new project matches your profile</h2>
          <p style="color: #666; margin-top: 0;">Hi ${escapeHtml(input.toName)}, (kalm) has a lead for you.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #666; width: 140px;">Project type</td><td style="padding: 8px 0;">${escapeHtml(input.projectType)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Location</td><td style="padding: 8px 0;">${escapeHtml(input.location)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Budget</td><td style="padding: 8px 0;">${escapeHtml(input.budgetRangeLabel)}</td></tr>
          </table>

          <p style="color: #666; margin-bottom: 4px;">Details</p>
          <p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>

          <p style="margin-top: 24px;">Log in to your dashboard to see full contact details and respond.</p>
        </div>
      `,
    });

    if (error) {
      await recordEmailFailure('project post alert', input.toEmail, error);
      return false;
    }

    return true;
  } catch (err) {
    await recordEmailFailure('project post alert', input.toEmail, err);
    return false;
  }
}

// Minimal HTML escaping for values interpolated into the email template
// above. All of these values come from user input (developer-submitted
// form fields), so this isn't optional — without it, a project description
// containing HTML would be interpreted as markup in the notification email.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// For values interpolated into an email SUBJECT line, not the HTML body.
// escapeHtml is the wrong tool here: the risk in a subject isn't markup
// injection, it's HEADER injection — a subject value containing a
// newline (\n or \r\n) could, depending on how deep the mail-sending
// library's own escaping goes, be used to inject additional email
// headers (like an extra Bcc:) rather than just extending the visible
// subject text. Stripping newlines/control characters closes that
// specific vector regardless of what Resend's SDK does internally —
// treat this as defense in depth, not a statement that Resend is
// unsafe without it.
function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n]+/g, ' ').trim();
}

// Both functions below send TO the developer's own email address, unlike
// sendQuoteRequestEmail above which always sends to one fixed internal
// inbox. On Resend's free test domain, sends to any address other than the
// account's own registered email are silently rejected — this only
// actually delivers once a real domain is verified in Resend. See the
// deployment notes; this is a hard prerequisite before either of these
// emails will reach real users, not just a nice-to-have.

export async function sendVerificationEmail(input: {
  toEmail: string;
  toName: string;
  verifyUrl: string;
}): Promise<boolean> {
  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: input.toEmail,
      subject: 'Verify your (kalm) email',
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2>Confirm your email</h2>
          <p>Hi ${escapeHtml(input.toName)}, click below to verify your email for (kalm):</p>
          <p><a href="${input.verifyUrl}" style="display:inline-block;background:#1c1e22;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Verify email</a></p>
          <p style="color:#666;font-size:13px;">This link expires in 24 hours. If you didn't sign up for (kalm), you can ignore this email.</p>
        </div>
      `,
    });
    if (error) {
      await recordEmailFailure('verification', input.toEmail, error);
      return false;
    }
    return true;
  } catch (err) {
    await recordEmailFailure('verification', input.toEmail, err);
    return false;
  }
}

export async function sendPasswordResetEmail(input: {
  toEmail: string;
  toName: string;
  resetUrl: string;
}): Promise<boolean> {
  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: input.toEmail,
      subject: 'Reset your (kalm) password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2>Reset your password</h2>
          <p>Hi ${escapeHtml(input.toName)}, click below to set a new password:</p>
          <p><a href="${input.resetUrl}" style="display:inline-block;background:#1c1e22;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Reset password</a></p>
          <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can ignore this email and your password won't change.</p>
        </div>
      `,
    });
    if (error) {
      await recordEmailFailure('password reset', input.toEmail, error);
      return false;
    }
    return true;
  } catch (err) {
    await recordEmailFailure('password reset', input.toEmail, err);
    return false;
  }
}

// Sent when someone requests to claim an admin-entered contractor listing
// by email — see the CLAIM path comment in
// src/app/api/contractors/signup/route.ts for why this exists as a
// separate step rather than accepting a password directly in the same
// request that names the email. Deliberately doesn't call this a "password
// reset" even though the underlying token mechanism is identical to one —
// the person clicking this link is setting a FIRST password on a listing
// they don't yet control, not recovering access to an account that was
// already theirs. Copy should be honest about that distinction.
export async function sendClaimAccountEmail(input: {
  toEmail: string;
  toName: string;
  claimUrl: string;
}): Promise<boolean> {
  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: input.toEmail,
      subject: 'Claim your (kalm) contractor listing',
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2>Claim your listing</h2>
          <p>Hi ${escapeHtml(input.toName)}, someone requested to set up dashboard access for your
          (kalm) contractor listing using this email address. Click below to set a password and
          claim it:</p>
          <p><a href="${input.claimUrl}" style="display:inline-block;background:#1c1e22;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Claim my listing</a></p>
          <p style="color:#666;font-size:13px;">This link expires in 1 hour. If this wasn't you, you can ignore this email and no changes will be made to your listing.</p>
        </div>
      `,
    });
    if (error) {
      await recordEmailFailure('claim account', input.toEmail, error);
      return false;
    }
    return true;
  } catch (err) {
    await recordEmailFailure('claim account', input.toEmail, err);
    return false;
  }
}

// Sends a contact-form submission to the fixed internal inbox
// (QUOTE_NOTIFICATION_EMAIL — same address used for quote-request
// notifications, since it's the one inbox actually monitored right now).
// replyTo is set to the sender's own email so replying in your inbox goes
// straight back to them, not to onboarding@resend.dev.
export async function sendContactFormEmail(input: {
  name: string;
  email: string;
  message: string;
}): Promise<boolean> {
  const notifyAddress = process.env.QUOTE_NOTIFICATION_EMAIL;
  if (!notifyAddress) {
    console.error('QUOTE_NOTIFICATION_EMAIL is not set — cannot send contact form email');
    return false;
  }

  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: notifyAddress,
      replyTo: input.email,
      subject: `New contact form message from ${sanitizeSubject(input.name)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px;">
          <h2>New contact form message</h2>
          <p><strong>From:</strong> ${escapeHtml(input.name)} (${escapeHtml(input.email)})</p>
          <p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>
        </div>
      `,
    });
    if (error) {
      await recordEmailFailure('contact form', notifyAddress, error);
      return false;
    }
    return true;
  } catch (err) {
    await recordEmailFailure('contact form', notifyAddress, err);
    return false;
  }
}

// Tells a developer that a contractor has moved their quote request along
// (accepted / quote sent / declined). Goes to the developer's own address,
// so like the verification and reset emails above, it only actually
// delivers once a real domain is verified in Resend. Before that, the
// failure is logged and the status change itself still goes through: the
// developer will see it on their dashboard either way.
export async function sendQuoteStatusEmail(input: {
  toEmail: string;
  toName: string;
  contractorName: string;
  projectType: string;
  statusLabel: string;
  dashboardUrl: string;
}): Promise<boolean> {
  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: input.toEmail,
      subject: `${sanitizeSubject(input.contractorName)} updated your quote request: ${sanitizeSubject(input.statusLabel)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="margin-bottom: 4px;">Your quote request was updated</h2>
          <p>Hi ${escapeHtml(input.toName)},</p>
          <p><strong>${escapeHtml(input.contractorName)}</strong> updated your request for
          <em>${escapeHtml(input.projectType)}</em>. It's now:</p>
          <p style="font-size: 17px; font-weight: 600;">${escapeHtml(input.statusLabel)}</p>
          <p><a href="${input.dashboardUrl}" style="display:inline-block;background:#1c1e22;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Open your dashboard</a></p>
        </div>
      `,
    });
    if (error) {
      await recordEmailFailure('quote status', input.toEmail, error);
      return false;
    }
    return true;
  } catch (err) {
    await recordEmailFailure('quote status', input.toEmail, err);
    return false;
  }
}

// "You have a new message" nudge for an in-app conversation, with a short
// preview of the message (the owner's call: a preview is what makes people
// open it) and a Reply button straight into the conversation. How often
// this fires is throttled by the caller (src/lib/message-notifications.ts).
export async function sendNewMessageEmail(input: {
  toEmail: string;
  toName: string;
  fromName: string;
  projectType: string;
  preview: string;
  conversationUrl: string;
}): Promise<boolean> {
  try {
    const { error } = await getResendClient().emails.send({
      from: '(kalm) <onboarding@resend.dev>',
      to: input.toEmail,
      subject: `New message from ${sanitizeSubject(input.fromName)} on (kalm)`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="margin-bottom: 4px;">You have a new message</h2>
          <p>Hi ${escapeHtml(input.toName)},</p>
          <p><strong>${escapeHtml(input.fromName)}</strong> sent you a message about
          <em>${escapeHtml(input.projectType)}</em>:</p>
          <p style="border-left: 3px solid #ddd; padding: 6px 12px; color: #333; white-space: pre-wrap;">${escapeHtml(input.preview)}</p>
          <p><a href="${input.conversationUrl}" style="display:inline-block;background:#1c1e22;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Reply</a></p>
          <p style="color:#666;font-size:13px;">We won't email you again about this conversation until you've read it.</p>
        </div>
      `,
    });
    if (error) {
      await recordEmailFailure('new message', input.toEmail, error);
      return false;
    }
    return true;
  } catch (err) {
    await recordEmailFailure('new message', input.toEmail, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Site visit emails
// ---------------------------------------------------------------------------
// Four moments get an email: a new request (to the contractor), a
// confirmation (to BOTH sides, each with a calendar invite attached), a
// decline (to the developer), and a cancellation (to whichever side didn't
// cancel). All times are shown in India time via formatVisitTime, since
// this server runs in UTC. Like the other person-to-person emails here,
// these only reach real inboxes once a domain is verified in Resend.

const btn = 'display:inline-block;background:#1c1e22;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;';

function siteList(titles: string[]): string {
  return `<ul style="padding-left: 20px;">${titles.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
}

async function sendSimple(label: string, payload: Parameters<ReturnType<typeof getResendClient>['emails']['send']>[0]) {
  try {
    const { error } = await getResendClient().emails.send(payload);
    if (error) {
      await recordEmailFailure(label, payload.to, error);
      return false;
    }
    return true;
  } catch (err) {
    await recordEmailFailure(label, payload.to, err);
    return false;
  }
}

export async function sendSiteVisitRequestEmail(input: {
  toEmail: string;
  contractorName: string;
  developerName: string;
  siteTitles: string[];
  slots: Date[];
  developerNote: string | null;
  dashboardUrl: string;
}): Promise<boolean> {
  return sendSimple('site visit request', {
    from: '(kalm) <onboarding@resend.dev>',
    to: input.toEmail,
    subject: `${sanitizeSubject(input.developerName)} wants to visit ${input.siteTitles.length} of your sites`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px;">
        <h2 style="margin-bottom: 4px;">New site visit request</h2>
        <p>Hi ${escapeHtml(input.contractorName)},</p>
        <p><strong>${escapeHtml(input.developerName)}</strong>, a developer on (kalm), would like to see your
        completed work in person. They picked these projects:</p>
        ${siteList(input.siteTitles)}
        <p>They can make any of these times:</p>
        <ul style="padding-left: 20px;">${input.slots.map((s) => `<li>${escapeHtml(formatVisitTime(s))}</li>`).join('')}</ul>
        ${input.developerNote ? `<p style="color:#666;">Their note:</p><p style="white-space: pre-wrap;">${escapeHtml(input.developerNote)}</p>` : ''}
        <p>Pick a time and tell them where to meet, or decline, from your dashboard:</p>
        <p><a href="${input.dashboardUrl}" style="${btn}">Respond to this request</a></p>
      </div>
    `,
  });
}

export async function sendSiteVisitConfirmedEmail(input: {
  toEmail: string;
  toName: string;
  otherPartyLine: string; // e.g. "with Kunal Raut Constructions" / "from Rahul Mehta"
  siteTitles: string[];
  slot: Date;
  meetingPoint: string;
  responseNote: string | null;
  contactLine: string; // how to reach the other side on the day
  icsContent: string;
  dashboardUrl: string;
}): Promise<boolean> {
  return sendSimple('site visit confirmed', {
    from: '(kalm) <onboarding@resend.dev>',
    to: input.toEmail,
    subject: `Site visit confirmed: ${sanitizeSubject(formatVisitTime(input.slot))}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px;">
        <h2 style="margin-bottom: 4px;">Your site visit is confirmed</h2>
        <p>Hi ${escapeHtml(input.toName)}, your site visit ${escapeHtml(input.otherPartyLine)} is set for:</p>
        <p style="font-size: 17px; font-weight: 600;">${escapeHtml(formatVisitTime(input.slot))}</p>
        <p style="color:#666; margin-bottom: 4px;">Meeting point</p>
        <p style="white-space: pre-wrap; margin-top: 0;">${escapeHtml(input.meetingPoint)}</p>
        <p style="color:#666; margin-bottom: 4px;">Sites</p>
        ${siteList(input.siteTitles)}
        ${input.responseNote ? `<p style="color:#666; margin-bottom: 4px;">Note</p><p style="white-space: pre-wrap; margin-top: 0;">${escapeHtml(input.responseNote)}</p>` : ''}
        <p>${escapeHtml(input.contactLine)}</p>
        <p>The attached invite adds this to your calendar.</p>
        <p><a href="${input.dashboardUrl}" style="${btn}">Open your dashboard</a></p>
      </div>
    `,
    attachments: [{ filename: 'site-visit.ics', content: input.icsContent, contentType: 'text/calendar; charset=utf-8' }],
  });
}

export async function sendSiteVisitDeclinedEmail(input: {
  toEmail: string;
  toName: string;
  contractorName: string;
  responseNote: string | null;
  profileUrl: string;
}): Promise<boolean> {
  return sendSimple('site visit declined', {
    from: '(kalm) <onboarding@resend.dev>',
    to: input.toEmail,
    subject: `${sanitizeSubject(input.contractorName)} can't do your site visit`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px;">
        <h2 style="margin-bottom: 4px;">Site visit declined</h2>
        <p>Hi ${escapeHtml(input.toName)}, <strong>${escapeHtml(input.contractorName)}</strong> couldn't make any of the
        times you offered for your site visit.</p>
        ${input.responseNote ? `<p style="color:#666; margin-bottom: 4px;">Their reason</p><p style="white-space: pre-wrap; margin-top: 0;">${escapeHtml(input.responseNote)}</p>` : ''}
        <p>You can request again with different times from their profile.</p>
        <p><a href="${input.profileUrl}" style="${btn}">View their profile</a></p>
      </div>
    `,
  });
}

export async function sendSiteVisitCancelledEmail(input: {
  toEmail: string;
  toName: string;
  cancelledByName: string;
  slotLine: string;
  note: string | null;
  dashboardUrl: string;
}): Promise<boolean> {
  return sendSimple('site visit cancelled', {
    from: '(kalm) <onboarding@resend.dev>',
    to: input.toEmail,
    subject: `Site visit cancelled by ${sanitizeSubject(input.cancelledByName)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px;">
        <h2 style="margin-bottom: 4px;">Site visit cancelled</h2>
        <p>Hi ${escapeHtml(input.toName)}, <strong>${escapeHtml(input.cancelledByName)}</strong> cancelled the site
        visit ${escapeHtml(input.slotLine)}.</p>
        ${input.note ? `<p style="color:#666; margin-bottom: 4px;">Their note</p><p style="white-space: pre-wrap; margin-top: 0;">${escapeHtml(input.note)}</p>` : ''}
        <p>If you remove it from your calendar, nothing else is needed.</p>
        <p><a href="${input.dashboardUrl}" style="${btn}">Open your dashboard</a></p>
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// Re-verification and contractor lead emails
// ---------------------------------------------------------------------------

// Tells admin that a Verified contractor changed a checked detail. They
// stay listed with "Verified · update in review" until admin re-checks and
// confirms in Admin > Contractors (see src/app/api/contractors/me/route.ts).
// Goes to the same admin address as new quote requests.
export async function sendReverifyRequestEmail(input: {
  contractorName: string;
  changedFields: string[];
  adminUrl: string;
}): Promise<boolean> {
  const notifyAddress = process.env.QUOTE_NOTIFICATION_EMAIL;
  if (!notifyAddress) {
    console.error('QUOTE_NOTIFICATION_EMAIL is not set, cannot send re-verification email');
    return false;
  }
  return sendSimple('re-verification request', {
    from: '(kalm) <onboarding@resend.dev>',
    to: notifyAddress,
    subject: `Re-check needed: ${sanitizeSubject(input.contractorName)} updated verified details`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px;">
        <h2 style="margin-bottom: 4px;">A verified contractor changed checked details</h2>
        <p><strong>${escapeHtml(input.contractorName)}</strong> updated:</p>
        ${siteList(input.changedFields)}
        <p>Their listing is still live, marked "Verified · update in review". Re-check the new details, then
        confirm or change their status.</p>
        <p><a href="${input.adminUrl}" style="${btn}">Open Admin &gt; Contractors</a></p>
      </div>
    `,
  });
}

// Tells a contractor a developer has sent them a quote request.
//
// By default this carries NO developer contact details or project
// description: a LISTED contractor over their monthly lead cap sees the lead
// blurred on their dashboard, and an email with the details would bypass that
// cap. The email is then just a prompt to log in, where the cap is enforced.
//
// `lead` is passed ONLY when the caller has checked that this request is
// fully visible to the contractor (inside the cap, or PLUS/PRO). Then the
// email shows what the dashboard shows and replyTo is the developer's own
// address, so the contractor can answer straight from their inbox. (kalm)
// is deliberately not copied: quotes are private between the two parties.
export async function sendNewQuoteToContractorEmail(input: {
  toEmail: string;
  contractorName: string;
  projectType: string;
  location: string;
  dashboardUrl: string;
  lead?: {
    developerName: string;
    developerEmail: string;
    developerPhone: string;
    budgetRangeLabel: string;
    details: string;
  };
}): Promise<boolean> {
  const lead = input.lead;
  return sendSimple('new quote request (contractor)', {
    from: '(kalm) <onboarding@resend.dev>',
    to: input.toEmail,
    ...(lead ? { replyTo: lead.developerEmail } : {}),
    subject: `New quote request: ${sanitizeSubject(input.projectType)} in ${sanitizeSubject(input.location)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">You have a new quote request</h2>
        <p>Hi ${escapeHtml(input.contractorName)}, a developer on (kalm) has asked you for a quote:</p>
        <p style="font-size: 16px;"><strong>${escapeHtml(input.projectType)}</strong> in ${escapeHtml(input.location)}</p>
        ${
          lead
            ? `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
          <tr><td style="padding: 6px 0; color: #666; width: 110px;">From</td><td style="padding: 6px 0;">${escapeHtml(lead.developerName)} (${escapeHtml(lead.developerEmail)})</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Phone</td><td style="padding: 6px 0;">${escapeHtml(lead.developerPhone)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Budget</td><td style="padding: 6px 0;">${escapeHtml(lead.budgetRangeLabel)}</td></tr>
        </table>
        <p style="color: #666; margin-bottom: 4px;">Details</p>
        <p style="white-space: pre-wrap; margin-top: 0;">${escapeHtml(lead.details)}</p>
        <p style="color: #666; font-size: 13px;">Reply to this email to write to the developer directly.</p>`
            : '<p>Log in to see the details and respond.</p>'
        }
        <p><a href="${input.dashboardUrl}" style="${btn}">Open your dashboard</a></p>
      </div>
    `,
  });
}

// KALM-209: one reminder to a contractor about a request nobody has acted on.
// Like the first notification, it carries no developer details; the contractor
// logs in to see them (and the lead cap stays enforced there).
export async function sendQuoteReminderEmail(input: {
  toEmail: string;
  contractorName: string;
  projectType: string;
  location: string;
  dashboardUrl: string;
}): Promise<boolean> {
  return sendSimple('quote reminder (contractor)', {
    from: '(kalm) <onboarding@resend.dev>',
    to: input.toEmail,
    subject: `Reminder: a developer is waiting for your reply (${sanitizeSubject(input.projectType)})`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">A quote request is waiting</h2>
        <p>Hi ${escapeHtml(input.contractorName)},</p>
        <p>A developer asked you for a quote two days ago and hasn't heard back yet:</p>
        <p style="font-size: 16px;"><strong>${escapeHtml(input.projectType)}</strong> in ${escapeHtml(input.location)}</p>
        <p>A quick reply, even "not interested", lets them move on.</p>
        <p><a href="${input.dashboardUrl}" style="${btn}">Open your dashboard</a></p>
      </div>
    `,
  });
}

// KALM-209: one note to a developer whose request has had no reply for ~10 days.
export async function sendNoReplyNoticeEmail(input: {
  toEmail: string;
  toName: string;
  contractorName: string;
  projectType: string;
  browseUrl: string;
}): Promise<boolean> {
  return sendSimple('no reply notice (developer)', {
    from: '(kalm) <onboarding@resend.dev>',
    to: input.toEmail,
    subject: `No reply yet from ${sanitizeSubject(input.contractorName)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">Still waiting to hear back?</h2>
        <p>Hi ${escapeHtml(input.toName)},</p>
        <p><strong>${escapeHtml(input.contractorName)}</strong> hasn't replied to your request for
        <em>${escapeHtml(input.projectType)}</em> yet. Contractors are often busy on site, so you may want to
        ask another one as well.</p>
        <p><a href="${input.browseUrl}" style="${btn}">Browse other contractors</a></p>
      </div>
    `,
  });
}
