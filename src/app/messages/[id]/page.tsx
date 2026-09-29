// src/app/messages/[id]/page.tsx
//
// One conversation, full screen on a phone. The chat itself (header,
// message log, composer, polling) is MessagesConversation; this page adds
// the sign-in guard and the page chrome.
//
// Footer: hidden below md. On a phone this screen is a fixed-height chat
// that fills the viewport under the Nav, and a footer underneath it would
// only be reachable by scrolling the page past the composer, which feels
// broken in a chat. On desktop the chat is a card in the normal page, so
// the footer stays. The wrapper carries md:mt-auto because the footer's
// own mt-auto (which pins it to the bottom of short pages) only works on a
// direct child of the body's flex column.
//
// The id comes from useParams: this is a client page, and the hook gives
// the plain string without unwrapping the params promise.

'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import MessagesConversation from '@/components/MessagesConversation';

export default function ConversationPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
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
      <main className="flex-1 w-full md:px-8">
        {allowed && id && <MessagesConversation key={id} id={id} />}
      </main>
      <div className="hidden md:block md:mt-auto">
        <Footer />
      </div>
    </>
  );
}
