-- Replaces the owner/admin/member roles with owner/admin/agent/viewer.
--
-- Hand written rather than generated. Prisma's version casts with
-- USING ("role"::text::"Role_new"), which aborts on any existing 'member' row
-- because 'member' is not a value of the new type. The CASE below maps the old
-- role to its successor during the same cast, so no row is left unconvertible.
--
-- 'member' becomes 'agent': that is what those people actually do, and it is
-- the narrower of the two readings. The alternative, mapping them to admin,
-- would silently hand knowledge and settings write access to every existing
-- member, which is the opposite of what this change is for.
BEGIN;

CREATE TYPE "Role_new" AS ENUM ('owner', 'admin', 'agent', 'viewer');

ALTER TABLE "Invite" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "Invite" ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE "role"::text WHEN 'member' THEN 'agent' ELSE "role"::text END)::"Role_new";
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE "role"::text WHEN 'member' THEN 'agent' ELSE "role"::text END)::"Role_new";

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

ALTER TABLE "Invite" ALTER COLUMN "role" SET DEFAULT 'agent';
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'owner';

COMMIT;
