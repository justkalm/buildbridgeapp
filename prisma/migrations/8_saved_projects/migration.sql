-- Saved projects for developers (reusable quote request details).
-- Additive only: one new table. No existing data changes.

CREATE TABLE "SavedProject" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workNeeded" TEXT,
    "location" TEXT NOT NULL,
    "budgetRupees" BIGINT,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedProject_developerId_idx" ON "SavedProject"("developerId");

ALTER TABLE "SavedProject" ADD CONSTRAINT "SavedProject_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
