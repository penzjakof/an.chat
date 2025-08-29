-- CreateIndex
CREATE INDEX "Profile_groupId_idx" ON "Profile"("groupId");

-- CreateIndex
CREATE INDEX "Profile_status_idx" ON "Profile"("status");

-- CreateIndex
CREATE INDEX "Profile_provider_profileId_idx" ON "Profile"("provider", "profileId");
