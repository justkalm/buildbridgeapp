// src/lib/auth.ts
//
// NextAuth v5 config. Credentials-based (email + password) for both
// Developer and Contractor accounts, distinguished by a `role` field
// carried in the JWT/session. A single Credentials provider tries
// Developer first, then Contractor, rather than two separate providers —
// simpler for the login form (one email/password pair, no "I am a
// developer/contractor" toggle needed at login time, since email is unique
// per table but the same address could theoretically exist in both; in
// practice each person is one or the other).
//
// The admin page itself still uses a separate, simpler shared-password
// gate — see src/lib/admin-auth.ts. Not folding admin into this system;
// admin is a single shared account, not a per-person one.

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const normalizedEmail = email.toLowerCase().trim();

        const developer = await prisma.developer.findUnique({
          where: { email: normalizedEmail },
        });

        if (developer) {
          const passwordValid = await bcrypt.compare(password, developer.passwordHash);
          if (!passwordValid) return null;

          return {
            id: developer.id,
            name: developer.name,
            email: developer.email,
            role: 'developer' as const,
          };
        }

        // Not a developer — try contractor. A contractor with no
        // passwordHash yet (admin-entered placeholder that hasn't signed
        // up) can never authenticate here, by design.
        const contractor = await prisma.contractor.findUnique({
          where: { email: normalizedEmail },
        });

        if (contractor?.passwordHash) {
          const passwordValid = await bcrypt.compare(password, contractor.passwordHash);
          if (!passwordValid) return null;

          return {
            id: contractor.id,
            name: contractor.name,
            email: contractor.email,
            role: 'contractor' as const,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
});
