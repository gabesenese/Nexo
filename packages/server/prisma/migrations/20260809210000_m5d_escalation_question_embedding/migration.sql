-- AlterTable
ALTER TABLE "Escalation" ADD COLUMN     "question" TEXT,
ADD COLUMN     "questionEmbedding" vector(768);

