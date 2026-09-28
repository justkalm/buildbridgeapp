-- Adds site visits (a developer asking to see a contractor's completed
-- projects in person). Purely additive: one new table and one new enum.
-- Existing rows are untouched.

-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "projectIds" TEXT[],
    "proposedSlots" TIMESTAMP(3)[],
    "confirmedSlot" TIMESTAMP(3),
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'REQUESTED',
    "developerNote" TEXT,
    "contactPhone" TEXT NOT NULL,
    "meetingPoint" TEXT,
    "responseNote" TEXT,
    "cancelledBy" "MessageSenderRole",
    "requestEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVisit_developerId_idx" ON "SiteVisit"("developerId");

-- CreateIndex
CREATE INDEX "SiteVisit_contractorId_idx" ON "SiteVisit"("contractorId");

-- CreateIndex
CREATE INDEX "SiteVisit_status_idx" ON "SiteVisit"("status");

-- AddForeignKey
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
