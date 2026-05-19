const fs = require('fs').promises;
const path = require('path');
const { prisma } = require('../lib/prisma');

async function main() {
  const fileArg = process.argv[2];
  const originalName = process.argv[3] || path.basename(fileArg || '');
  if (!fileArg) {
    console.error('Usage: node import_cv_to_db.js <path-to-file> [originalName]');
    process.exit(2);
  }

  const filePath = path.resolve(fileArg);
  let buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (e) {
    console.error('Failed to read file:', filePath);
    process.exit(1);
  }

  // Ensure columns exist
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_original_name TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_filename TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_mime TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_data TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_url TEXT;`);

  const b64 = buffer.toString('base64');
  const filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

  // Update first profile
  const profile = await prisma.profile.findFirst({ orderBy: { id: 'asc' } });
  if (!profile) {
    console.error('No profile found. Create a profile first.');
    process.exit(1);
  }

  await prisma.$executeRawUnsafe(
    `UPDATE profiles SET cv_original_name = $1, cv_filename = $2, cv_mime = $3, cv_data = $4 WHERE id = $5`,
    originalName,
    filename,
    null,
    b64,
    profile.id
  );

  console.log('Imported', originalName, 'into profile id', profile.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
