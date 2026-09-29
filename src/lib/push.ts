// src/lib/push.ts
//
// Sends a phone/browser notification (Web Push) to every device a
// developer or contractor has turned notifications on for. Server-only.
//
// Free and provider-less: the browser vendors run the push services
// (Google for Chrome/Android, Apple for Safari/iPhone, Mozilla for
// Firefox), and each notification is signed with this app's VAPID keys
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in the
// environment) so the push service knows it really comes from us. The
// same keys must be set locally and in Vercel; changing them breaks every
// existing subscription.
//
// Never throws: a notification is always a nice-to-have on top of the
// email and the in-app badge, so a push failure must never fail the action
// that triggered it. Devices the push service says are gone (HTTP 404/410:
// the user revoked permission, uninstalled, cleared data) are deleted.
// If the keys aren't configured, sending is skipped with one log line.
//
// iPhone note: Safari only allows web push for sites the user has added to
// their Home Screen (iOS 16.4+); see src/app/manifest.ts.
//
// Dev vs live: the laptop's dev site and the live site share one database,
// so each subscription records the origin it was created on, and each
// running site only notifies its own kind: the live site (production build)
// skips devices registered on localhost / a LAN address, and the dev site
// skips live devices. Otherwise a live message could pop up as a
// "localhost" notification that opens a page that isn't running.

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

export type PushPayload = {
  title: string;
  body: string;
  // Where tapping the notification should open, e.g. "/messages/abc".
  url: string;
  // Notifications with the same tag replace each other on the device
  // instead of stacking (e.g. one per conversation).
  tag?: string;
};

let configured: boolean | null = null;
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.error('Web push keys are not set (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT); skipping notifications');
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

// localhost, 127.x, private LAN ranges, *.local, or any plain-http origin.
function isDevOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      protocol === 'http:' ||
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
    );
  } catch {
    return false;
  }
}

function belongsToThisSite(origin: string | null): boolean {
  if (!origin) return false; // pre-origin rows; they re-register with an origin on the next visit
  const runningLive = process.env.NODE_ENV === 'production';
  return runningLive ? !isDevOrigin(origin) : isDevOrigin(origin);
}

export async function sendPush(
  ownerRole: 'DEVELOPER' | 'CONTRACTOR',
  ownerId: string,
  payload: PushPayload
): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const subs = (await prisma.pushSubscription.findMany({ where: { ownerRole, ownerId } })).filter((s) =>
      belongsToThisSite(s.origin)
    );
    if (subs.length === 0) {
      console.log(`Web push: no devices for ${ownerRole.toLowerCase()} ${ownerId}`);
      return;
    }

    const json = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            json,
            { TTL: 60 * 60 * 24 } // keep trying for a day if the device is offline
          );
          await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } });
          console.log(`Web push: delivered to ${ownerRole.toLowerCase()} ${ownerId} (${new URL(s.endpoint).host})`);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          } else {
            console.error('Web push send failed:', status ?? '', (err as { body?: string }).body ?? err);
          }
        }
      })
    );
  } catch (err) {
    console.error('Web push failed:', err);
  }
}
