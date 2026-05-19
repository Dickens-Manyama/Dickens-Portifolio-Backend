const fs = require('fs').promises;
const path = require('path');
const { prisma } = require('../lib/prisma') || require('../../lib/prisma');

async function main() {
  // Add columns if missing
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_original_name TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_filename TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_mime TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_data TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS cv_url TEXT;`);

  const metaPath = path.join(__dirname, '..', 'public', 'uploads', 'cv', 'current.json');
  const dir = path.join(__dirname, '..', 'public', 'uploads', 'cv');

  let meta = null;
  try {
    const raw = await fs.readFile(metaPath, 'utf8');
    meta = JSON.parse(raw);
  } catch (e) {
    console.error('No CV metadata found at', metaPath);
    return;
  }

  if (!meta || !meta.filename) {
    console.error('CV metadata missing filename');
    return;
  }

  const filePath = path.join(dir, meta.filename);
  let buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (e) {
    console.error('CV file not found:', filePath);
    return;
  }

  const b64 = buffer.toString('base64');

  // Update first profile row
  const profile = await prisma.profile.findFirst({ orderBy: { id: 'asc' } });
  if (!profile) {
    console.error('No profile row found to attach CV to. Create a profile first.');
    return;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE profiles SET cv_original_name = $1, cv_filename = $2, cv_mime = $3, cv_data = $4, cv_url = $5 WHERE id = $6`,
    meta.originalName || null,
    meta.filename || null,
    meta.mime || null,
    b64,
    meta.url || null,
    profile.id
  );

  console.log('CV migrated into database for profile id', profile.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
