import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  console.log("Extensions ensured. No seed data yet, add sources via the admin dashboard.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
