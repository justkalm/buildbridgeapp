-- Folder is named 9a_ (not 10_) on purpose: Prisma sorts folder names as
-- text, and 10_ would sort before 1_, out of order with the applied history.
--
-- Content safeguards (KALM-252 to 255) and the verification desk's private
-- admin note (KALM-239).
-- Additive only: no existing data is changed or removed, EXCEPT that every
-- project that already exists is marked APPROVED so nothing on the live site
-- disappears. New projects default to PENDING (hidden until approved), so any
-- code that forgets to set a status fails safe.

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('CONTRACTOR', 'PROJECT', 'MESSAGE', 'PROJECT_POST', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- AlterTable: existing rows are filled with APPROVED, then the default for
-- NEW rows is switched to PENDING.
ALTER TABLE "Project" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "moderationNote" TEXT;

ALTER TABLE "Project" ALTER COLUMN "approvalStatus" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "adminNote" TEXT;

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "reporterRole" TEXT,
    "reporterId" TEXT,
    "reporterEmail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT,
    "reportId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "ModerationLog_targetId_idx" ON "ModerationLog"("targetId");

-- CreateIndex
CREATE INDEX "Project_approvalStatus_idx" ON "Project"("approvalStatus");
