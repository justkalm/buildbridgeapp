// src/lib/email.ts
//
// Wraps Resend for the one email this slice actually needs to send: a quote
// request notification. Kept as a single narrow function rather than a
// generic "send any email" helper — when the supplier/interior-designer
// sides get built later, they'll likely want different templates, and it's
// easier to add a second specific function than to unpick a generic one.

import { Resend } from 'resend';

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
      subject: `New quote request for ${input.contractorName}`,
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
          <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.</p>
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
          <p style="color:#666;font-size:13px;">This link expires in 1 hour. If this wasn't you, you can ignore this email — no changes will be made to your listing.</p>
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
      subject: `New contact form message from ${escapeHtml(input.name)}`,
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
