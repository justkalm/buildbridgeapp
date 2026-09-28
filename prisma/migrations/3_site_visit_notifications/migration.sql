-- In-app notification tracking for site visits: who acted last and when,
-- and when each side last looked. Purely additive; existing visits get
-- lastActionAt = now and no lastActionBy, so none of them show as "new".

-- AlterTable
ALTER TABLE "SiteVisit" ADD COLUMN     "contractorSeenAt" TIMESTAMP(3),
ADD COLUMN     "developerSeenAt" TIMESTAMP(3),
ADD COLUMN     "lastActionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastActionBy" "MessageSenderRole";
