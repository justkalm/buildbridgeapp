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

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(process.env.RESEND_API_KEY);
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
            <tr><td style="padding: 8px 0; color: #666;">Budget range</td><td style="padding: 8px 0;">${escapeHtml(input.budgetRangeLabel)}</td></tr>
          </table>

          <p style="color: #666; margin-bottom: 4px;">Details</p>
          <p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend returned an error sending quote request email:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send quote request email:', err);
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
            <tr><td style="padding: 8px 0; color: #666;">Budget range</td><td style="padding: 8px 0;">${escapeHtml(input.budgetRangeLabel)}</td></tr>
          </table>

          <p style="color: #666; margin-bottom: 4px;">Details</p>
          <p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend returned an error sending project post admin email:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send project post admin email:', err);
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
            <tr><td style="padding: 8px 0; color: #666;">Budget range</td><td style="padding: 8px 0;">${escapeHtml(input.budgetRangeLabel)}</td></tr>
          </table>

          <p style="color: #666; margin-bottom: 4px;">Details</p>
          <p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>

          <p style="margin-top: 24px;">Log in to your dashboard to see full contact details and respond.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend returned an error sending project post alert email:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send project post alert email:', err);
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
      console.error('Resend error sending verification email:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send verification email:', err);
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
      console.error('Resend error sending password reset email:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send password reset email:', err);
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
      console.error('Resend error sending claim-account email:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send claim-account email:', err);
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
      console.error('Resend error sending contact form email:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send contact form email:', err);
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
      console.error('Resend error sending quote status email:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send quote status email:', err);
    return false;
  }
}

// "You have a new message" nudge for the in-app thread. Deliberately does
// NOT include the message text: the email is a prompt to come back to the
// site, not a second copy of the conversation sitting in someone's inbox.
// How often this fires is throttled by the caller (see the
// developerNotifiedAt / contractorNotifiedAt comment in schema.prisma).
export async function sendNewMessageEmail(input: {
  toEmail: string;
  toName: string;
  fromName: string;
  projectType: string;
  dashboardUrl: string;
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
          <em>${escapeHtml(input.projectType)}</em>.</p>
          <p><a href="${input.dashboardUrl}" style="display:inline-block;background:#1c1e22;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Read and reply</a></p>
          <p style="color:#666;font-size:13px;">We won't email you again about this conversation until you've read it.</p>
        </div>
      `,
    });
    if (error) {
      console.error('Resend error sending new message email:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send new message email:', err);
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
      console.error(`Resend error sending ${label} email:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send ${label} email:`, err);
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
