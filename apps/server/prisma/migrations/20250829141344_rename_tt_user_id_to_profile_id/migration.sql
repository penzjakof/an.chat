/*
  Warnings:

  - You are about to drop the column `ttUserId` on the `Profile` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "credentialLogin" TEXT,
    "credentialPassword" TEXT,
    "profileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastActiveAt" DATETIME,
    "groupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("createdAt", "credentialLogin", "credentialPassword", "displayName", "externalId", "groupId", "id", "lastActiveAt", "provider", "status", "updatedAt") SELECT "createdAt", "credentialLogin", "credentialPassword", "displayName", "externalId", "groupId", "id", "lastActiveAt", "provider", "status", "updatedAt" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_provider_externalId_key" ON "Profile"("provider", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
