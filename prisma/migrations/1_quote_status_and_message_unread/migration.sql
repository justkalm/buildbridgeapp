-- Adds the QUOTED quote-request status, a timestamp for status changes,
-- and per-side read/notified timestamps for in-app message threads.
-- Purely additive: no existing column or enum value is changed or dropped,
-- so existing rows are untouched (all new columns start as NULL).

-- AlterEnum
ALTER TYPE "QuoteRequestStatus" ADD VALUE 'QUOTED' BEFORE 'DECLINED';

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "developerLastReadAt" TIMESTAMP(3),
ADD COLUMN     "contractorLastReadAt" TIMESTAMP(3),
ADD COLUMN     "developerNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "contractorNotifiedAt" TIMESTAMP(3);
