-- Folder is named 9b_ on purpose: Prisma sorts folder names as text, so this
-- sorts right after 9a_.
--
-- Pilot fields on "Post a project" and "Request a quote" (15 Oct 2026):
-- built-up area in sq ft, the trades needed, and when the contractor is
-- needed. Additive only: every column is optional (the trades list starts
-- empty), so every existing row stays valid and nothing is changed or removed.

-- AlterTable
ALTER TABLE "ProjectPost" ADD COLUMN     "builtUpAreaSqft" INTEGER,
ADD COLUMN     "neededBy" TEXT,
ADD COLUMN     "trades" TEXT[];

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "builtUpAreaSqft" INTEGER;
