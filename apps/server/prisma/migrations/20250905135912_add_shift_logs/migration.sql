-- CreateTable
CREATE TABLE "ShiftLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShiftLog_shiftId_idx" ON "ShiftLog"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftLog_operatorId_idx" ON "ShiftLog"("operatorId");

-- CreateIndex
CREATE INDEX "ShiftLog_agencyId_idx" ON "ShiftLog"("agencyId");
