// src/app/messages/page.tsx
//
// Messages inbox for signed-in developers and contractors: every
// conversation they're part of in one list, reached from the message icon
// in the Nav. The list itself (fetching, polling, empty and locked states)
// lives in MessagesInbox; this page is the guard and the page chrome.
//
// Guard: same pattern as the dashboards. Logged-out visitors (and any
// other role, e.g. an admin session) are sent to /login; nothing renders
// for them meanwhile, and GET /api/conversations would refuse them anyway.
//
// PushPrompt (the "Turn on notifications" card) sits at the top because
// this is the page people come back to for replies, which is exactly when
// being told about the next one is worth a permission prompt.

'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import PushPrompt from '@/components/PushPrompt';
import MessagesInbox from '@/components/MessagesInbox';

export default function MessagesPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowed = status === 'authenticated' && (role === 'developer' || role === 'contractor');

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && !allowed)) {
      router.push('/login');
    }
  }, [status, allowed, router]);

  return (
    <>
      <Nav />
      <main className="flex-1 w-full max-w-[760px] mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <h1 className="font-display font-light text-[28px] mb-6">Messages</h1>
        {allowed && (
          <>
            <div className="mb-6 empty:hidden">
              <InstallAppPrompt />
        <PushPrompt persistent />
            </div>
            <MessagesInbox viewerRole={role === 'contractor' ? 'CONTRACTOR' : 'DEVELOPER'} />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
