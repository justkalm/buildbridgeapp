-- Section F security hardening. Additive only: two new tables and one new
-- column (default 0) on Developer and Contractor. No existing data changes.

-- Password reset signs out other devices (F5 / KALM-186)
ALTER TABLE "Contractor" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Developer" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Revocable admin sessions (F1)
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- Failed email log (F7)
CREATE TABLE "EmailFailure" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "error" TEXT NOT NULL,

    CONSTRAINT "EmailFailure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailFailure_createdAt_idx" ON "EmailFailure"("createdAt");
