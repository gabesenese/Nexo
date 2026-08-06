import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  console.log("Extensions ensured.");

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.adminUser.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash },
      create: { email: ADMIN_EMAIL, passwordHash },
    });
    console.log(`Admin user ready: ${ADMIN_EMAIL}`);
  } else {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user seed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
