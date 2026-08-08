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

    const organization = await prisma.organization.upsert({
      where: { slug: "legacy" },
      update: { widgetKey: "legacy" },
      create: { name: "Legacy Workspace", slug: "legacy", widgetKey: "legacy" },
    });

    const user = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash },
      create: { email: ADMIN_EMAIL, passwordHash, name: ADMIN_EMAIL.split("@")[0] },
    });

    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: {},
      create: { userId: user.id, organizationId: organization.id, role: "owner" },
    });

    console.log(`Seed user ready: ${ADMIN_EMAIL} (workspace: ${organization.name})`);
  } else {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping user seed.");
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
