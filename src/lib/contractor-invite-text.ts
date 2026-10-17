// src/lib/contractor-invite-text.ts
//
// Admin-screen wording for the "set your password" email results. Kept
// apart from src/lib/contractor-invite.ts so browser pages can import it
// without pulling in the database client.

export type InviteResult = 'sent' | 'has-login' | 'not-found' | 'email-failed';

/** Words for admin screens. */
export function inviteResultMessage(result: InviteResult): string {
  switch (result) {
    case 'sent':
      return 'Login link emailed. It works for 3 days.';
    case 'has-login':
      return 'They already have a password. They can use "Forgot password" on the sign-in page.';
    case 'not-found':
      return 'Contractor not found.';
    case 'email-failed':
      return 'The login link email could not be sent (see Failed emails). Try "Send login link" again later.';
  }
}
