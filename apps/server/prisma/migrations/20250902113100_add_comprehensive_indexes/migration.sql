-- CreateTable
CREATE TABLE "TalkyTimesSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "cookies" TEXT NOT NULL,
    "token" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TalkyTimesSession_profileId_key" ON "TalkyTimesSession"("profileId");

-- CreateIndex
CREATE INDEX "TalkyTimesSession_profileId_idx" ON "TalkyTimesSession"("profileId");

-- CreateIndex
CREATE INDEX "TalkyTimesSession_expiresAt_idx" ON "TalkyTimesSession"("expiresAt");
