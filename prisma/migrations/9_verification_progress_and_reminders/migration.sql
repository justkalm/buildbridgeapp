-- Verification progress (KALM-211), enquiry reminders (KALM-209), and the
-- engine-room indexes (task sheet I): an index on Contractor.tier and a GIN
-- index on Contractor.tradeTypes (the old plain index could not speed up
-- array searches).
-- Additive only: five new empty columns and two index changes. No existing
-- data is changed or removed.

-- DropIndex
DROP INDEX "Contractor_tradeTypes_idx";

-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "checkContactAt" TIMESTAMP(3),
ADD COLUMN     "checkDocumentsAt" TIMESTAMP(3),
ADD COLUMN     "checkGstinAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "noReplyNoticeSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Contractor_tradeTypes_idx" ON "Contractor" USING GIN ("tradeTypes");

-- CreateIndex
CREATE INDEX "Contractor_tier_idx" ON "Contractor"("tier");
