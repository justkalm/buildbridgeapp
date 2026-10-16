-- Folder is named 9c_ on purpose: Prisma sorts folder names as text, so this
-- sorts right after 9b_.
--
-- Contractor onboarding form at /join (16 Oct 2026). Additive only: one new
-- table and one new enum. No existing table or row is changed.

-- CreateEnum
CREATE TYPE "ContractorApplicationStatus" AS ENUM ('NEW', 'ADDED', 'REJECTED');

-- CreateTable
CREATE TABLE "ContractorApplication" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "bio" TEXT,
    "logoUrl" TEXT,
    "tradeTypes" TEXT[],
    "gstNumber" TEXT,
    "licenceNumber" TEXT,
    "hasInsurance" BOOLEAN NOT NULL,
    "projects" JSONB NOT NULL DEFAULT '[]',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "ContractorApplicationStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractorApplication_status_idx" ON "ContractorApplication"("status");
