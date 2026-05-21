require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_source_html TEXT;`
    );
    console.log("[migrate] cv_source_html column ready");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
