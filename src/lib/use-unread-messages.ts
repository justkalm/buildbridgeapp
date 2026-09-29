// src/lib/use-unread-messages.ts
//
// Client hook: polls /api/messages/unread and returns the signed-in
// user's unread message counts. Used by the Nav (total, for the badge)
// and both dashboards (per quote request, for each thread's badge).
//
// Same polling rules as the conversation screen: pause while the tab is hidden and
// catch up as soon as it's visible again. Also refreshes immediately when
// anything on the page announces NOTIFICATIONS_CHANGED_EVENT (e.g. the
// site visits list after it marks visits as seen), so the Nav badge clears
// straight away instead of on the next poll.
//
// `total` counts every notification (unread messages, site visits, new
// quote requests, status changes, project alerts); `messages` is unread
// messages alone (the Messages icon's count), `siteVisits` the site-visit
// part. `enabled` should be false for
// logged-out visitors, so they never hit an endpoint that would just 401.

'use client';

import { useCallback, useEffect, useState } from 'react';

type Unread = { total: number; messages: number; byQuoteRequest: Record<string, number>; siteVisits: number };

const EMPTY: Unread = { total: 0, messages: 0, byQuoteRequest: {}, siteVisits: 0 };

export const NOTIFICATIONS_CHANGED_EVENT = 'kalm:notifications-changed';

export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function useUnreadMessages(enabled: boolean, pollMs = 60_000) {
  const [unread, setUnread] = useState<Unread>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/unread');
      if (res.ok) setUnread(await res.json());
    } catch {
      // Keep the last known counts on a network blip.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [enabled, pollMs, refresh]);

  // Lets a dashboard zero one thread's badge the moment it's opened,
  // instead of waiting for the next poll to notice it was read.
  const markRead = useCallback((quoteRequestId: string) => {
    setUnread((prev) => {
      const count = prev.byQuoteRequest[quoteRequestId];
      if (!count) return prev;
      const byQuoteRequest = { ...prev.byQuoteRequest };
      delete byQuoteRequest[quoteRequestId];
      return { ...prev, total: prev.total - count, messages: Math.max(0, prev.messages - count), byQuoteRequest };
    });
  }, []);

  return { ...(enabled ? unread : EMPTY), refresh, markRead };
}
