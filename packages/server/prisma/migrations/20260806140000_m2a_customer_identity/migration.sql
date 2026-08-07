-- M2a Customer Identity: organizations, users, memberships, and org-scoping of
-- customer data. Existing single-tenant data is preserved by moving it into a
-- "Legacy Workspace" organization before AdminUser is dropped.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- AlterTable
ALTER TABLE "Source" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "Source_organizationId_idx" ON "Source"("organizationId");
CREATE INDEX "Conversation_organizationId_idx" ON "Conversation"("organizationId");
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");

-- Data migration: preserve existing single-tenant data in a legacy organization
DO $$
DECLARE
  legacy_org_id TEXT := 'org_legacy_seed';
BEGIN
  IF EXISTS (SELECT 1 FROM "AdminUser")
     OR EXISTS (SELECT 1 FROM "Source")
     OR EXISTS (SELECT 1 FROM "Conversation")
     OR EXISTS (SELECT 1 FROM "Lead") THEN

    INSERT INTO "Organization" ("id", "name", "slug", "createdAt")
    VALUES (legacy_org_id, 'Legacy Workspace', 'legacy', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt")
    SELECT "id", "email", "passwordHash", split_part("email", '@', 1), "createdAt"
    FROM "AdminUser"
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "Membership" ("id", "userId", "organizationId", "role", "createdAt")
    SELECT 'mem_' || "id", "id", legacy_org_id, 'owner', CURRENT_TIMESTAMP
    FROM "AdminUser"
    ON CONFLICT DO NOTHING;

    UPDATE "Source" SET "organizationId" = legacy_org_id WHERE "organizationId" IS NULL;
    UPDATE "Conversation" SET "organizationId" = legacy_org_id WHERE "organizationId" IS NULL;
    UPDATE "Lead" SET "organizationId" = legacy_org_id WHERE "organizationId" IS NULL;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable (data already migrated into User above)
DROP TABLE "AdminUser";
