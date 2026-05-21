const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function run() {
  const prisma = new PrismaClient();
  try {
    const migrationPath = path.join(__dirname, 'migrations', '20260520030326_add_audit_logs', 'migration.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split on semicolons that are followed by a newline (naive but works for our SQL)
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      console.log('Executing statement:\n', stmt.slice(0, 200));
      await prisma.$executeRawUnsafe(stmt);
    }

    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Failed to apply migration:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
