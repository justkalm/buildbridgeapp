-- 1) QuoteRequest.kind: QUOTE (existing quote requests), ENQUIRY (a
--    developer's direct question from a contractor's profile) or PROJECT
--    (a contractor replying to a project alert), plus projectPostId for
--    PROJECT conversations.
-- 2) PushSubscription: devices that have turned on (kalm) notifications.
-- Additive only; every existing quote request becomes kind QUOTE.

-- CreateEnum
CREATE TYPE "QuoteRequestKind" AS ENUM ('QUOTE', 'ENQUIRY', 'PROJECT');

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "kind" "QuoteRequestKind" NOT NULL DEFAULT 'QUOTE',
ADD COLUMN     "projectPostId" TEXT;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "ownerRole" "MessageSenderRole" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_ownerRole_ownerId_idx" ON "PushSubscription"("ownerRole", "ownerId");

-- CreateIndex
CREATE INDEX "QuoteRequest_projectPostId_idx" ON "QuoteRequest"("projectPostId");

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_projectPostId_fkey" FOREIGN KEY ("projectPostId") REFERENCES "ProjectPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
