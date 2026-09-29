-- Records which website (origin) each push subscription was created on,
-- so the live site never notifies a device registered on the local dev
-- site (they share one database). Additive only.

-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN     "origin" TEXT;

-- Existing subscriptions have no origin, so we can't tell a live-site phone
-- from the laptop's dev site. Clear them: every browser that still has a
-- subscription re-registers itself automatically (with its origin) the next
-- time its owner opens Messages or their dashboard (see syncPush in
-- src/lib/push-client.ts), so nobody has to turn notifications on again.
DELETE FROM "PushSubscription" WHERE "origin" IS NULL;
