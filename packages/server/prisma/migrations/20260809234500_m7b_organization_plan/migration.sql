-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('essentials', 'professional', 'growth');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'essentials';

