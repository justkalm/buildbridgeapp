-- 1) Re-verification without going offline: a Verified contractor who
--    edits a checked detail stays listed, flagged for admin to re-check.
-- 2) In-app notification tracking for new quote requests, quote status
--    changes and project alerts.
-- Additive only. Existing quote requests and alerts are marked as already
-- seen, so nobody gets a flood of "New" labels for old items.

-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "reverifyFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reverifyPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reverifyRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectPostAlert" ADD COLUMN     "seenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "contractorSeenAt" TIMESTAMP(3),
ADD COLUMN     "developerStatusSeenAt" TIMESTAMP(3);

-- Existing rows count as seen.
UPDATE "QuoteRequest" SET "contractorSeenAt" = CURRENT_TIMESTAMP, "developerStatusSeenAt" = CURRENT_TIMESTAMP;
UPDATE "ProjectPostAlert" SET "seenAt" = CURRENT_TIMESTAMP;
