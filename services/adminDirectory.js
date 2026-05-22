const bcrypt = require("bcryptjs");
const { prisma } = require("../lib/prisma");

const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
const TEMP_ADMIN_ROLE = "ADMIN";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getConfiguredSuperAdminEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || "admin@gmail.com");
}

async function ensureAdminSchema() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ADMIN',
      active_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_activity TIMESTAMPTZ,
      created_by TEXT
    )
  `;

  await prisma.$executeRaw`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'ADMIN'`;
  await prisma.$executeRaw`ALTER TABLE admins ADD COLUMN IF NOT EXISTS active_until TIMESTAMPTZ`;
  await prisma.$executeRaw`ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await prisma.$executeRaw`ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await prisma.$executeRaw`ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ`;
  await prisma.$executeRaw`ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by TEXT`;
}

async function getAdminByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  await ensureAdminSchema();

  const rows = await prisma.$queryRaw`
    SELECT id, email, password_hash, role, active_until, created_at, updated_at, last_activity, created_by
    FROM admins
    WHERE lower(email) = lower(${normalizedEmail})
    LIMIT 1
  `;

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getAdminById(id) {
  const adminId = Number.parseInt(id, 10);
  if (!Number.isInteger(adminId) || adminId <= 0) return null;

  await ensureAdminSchema();

  const rows = await prisma.$queryRaw`
    SELECT id, email, password_hash, role, active_until, created_at, updated_at, last_activity, created_by
    FROM admins
    WHERE id = ${adminId}
    LIMIT 1
  `;

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function isSuperAdminRow(row) {
  return String(row?.role || "").toUpperCase() === SUPER_ADMIN_ROLE;
}

function isSuperAdminEmail(email) {
  const configuredSuperAdminEmail = getConfiguredSuperAdminEmail();
  const normalizedEmail = normalizeEmail(email);

  if (configuredSuperAdminEmail && normalizedEmail === configuredSuperAdminEmail) {
    return true;
  }

  return false;
}

function isExpiredAdminRow(row) {
  if (!row?.active_until) return false;
  const activeUntil = new Date(row.active_until);
  if (Number.isNaN(activeUntil.getTime())) return false;
  return activeUntil.getTime() <= Date.now();
}

function parseDurationToExpiresAt(body, options = {}) {
  const required = options.required !== false;

  if (!body || typeof body !== "object") {
    return required ? { ok: false, message: "Duration is required." } : { ok: true, expiresAt: null };
  }

  const hasExplicitExpiry = body.expiresAt != null && String(body.expiresAt).trim() !== "";
  const hasDurationValue = body.durationValue != null || body.durationMinutes != null || body.durationHours != null || body.durationDays != null;

  if (!hasExplicitExpiry && !hasDurationValue) {
    return required ? { ok: false, message: "Duration is required." } : { ok: true, expiresAt: null };
  }

  if (hasExplicitExpiry) {
    const expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return { ok: false, message: "expiresAt must be a valid future date." };
    }

    return { ok: true, expiresAt };
  }

  const durationValue = Number(body.durationValue ?? body.durationMinutes ?? body.durationHours ?? body.durationDays);
  const durationUnit = String(body.durationUnit || (body.durationHours != null ? "hours" : body.durationDays != null ? "days" : "minutes"))
    .trim()
    .toLowerCase();

  if (!Number.isFinite(durationValue) || durationValue <= 0) {
    return { ok: false, message: "Duration must be a positive number." };
  }

  const multipliers = {
    minute: 60000,
    minutes: 60000,
    hour: 60 * 60000,
    hours: 60 * 60000,
    day: 24 * 60 * 60000,
    days: 24 * 60 * 60000,
  };

  const multiplier = multipliers[durationUnit];
  if (!multiplier) {
    return { ok: false, message: "Duration unit must be minutes, hours, or days." };
  }

  return { ok: true, expiresAt: new Date(Date.now() + durationValue * multiplier) };
}

async function listAdmins() {
  await ensureAdminSchema();

  const rows = await prisma.$queryRaw`
    SELECT id, email, role, active_until, created_at, updated_at, last_activity, created_by
    FROM admins
    ORDER BY created_at ASC, id ASC
  `;

  return Array.isArray(rows) ? rows : [];
}

async function createAdmin({ email, password, expiresAt, createdBy }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, status: 400, message: "Email is required." };
  }

  if (!String(password || "").trim()) {
    return { ok: false, status: 400, message: "Password is required." };
  }

  if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    return { ok: false, status: 400, message: "A valid expiration date is required." };
  }

  if (isSuperAdminEmail(normalizedEmail)) {
    return { ok: false, status: 409, message: "Use the existing super admin account instead of creating a duplicate." };
  }

  await ensureAdminSchema();

  const existing = await getAdminByEmail(normalizedEmail);
  if (existing) {
    return { ok: false, status: 409, message: "An admin with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const rows = await prisma.$queryRaw`
    INSERT INTO admins (email, password_hash, role, active_until, created_by, created_at, updated_at)
    VALUES (${normalizedEmail}, ${passwordHash}, ${TEMP_ADMIN_ROLE}, ${expiresAt}, ${normalizeEmail(createdBy) || null}, now(), now())
    RETURNING id, email, role, active_until, created_at, updated_at, last_activity, created_by
  `;

  return { ok: true, admin: Array.isArray(rows) && rows[0] ? rows[0] : null };
}

async function updateAdminById(id, { email, password, expiresAt }) {
  const admin = await getAdminById(id);
  if (!admin) {
    return { ok: false, status: 404, message: "Admin not found." };
  }

  if (isSuperAdminRow(admin) || isSuperAdminEmail(admin.email)) {
    return { ok: false, status: 403, message: "The super admin account cannot be modified." };
  }

  const normalizedEmail = email != null ? normalizeEmail(email) : null;
  if (email != null && !normalizedEmail) {
    return { ok: false, status: 400, message: "Email is required." };
  }

  if (normalizedEmail && normalizedEmail !== normalizeEmail(admin.email)) {
    const existing = await getAdminByEmail(normalizedEmail);
    if (existing && Number(existing.id) !== Number(admin.id)) {
      return { ok: false, status: 409, message: "An admin with that email already exists." };
    }
  }

  if (expiresAt != null) {
    const expiresDate = new Date(expiresAt);
    if (Number.isNaN(expiresDate.getTime()) || expiresDate.getTime() <= Date.now()) {
      return { ok: false, status: 400, message: "A valid future expiration date is required." };
    }
  }

  const passwordHash = password != null && String(password).trim() ? await bcrypt.hash(String(password), 10) : null;
  await ensureAdminSchema();

  const rows = await prisma.$queryRaw`
    UPDATE admins
    SET
      email = COALESCE(${normalizedEmail}, email),
      password_hash = COALESCE(${passwordHash}, password_hash),
      active_until = CASE WHEN ${expiresAt != null} THEN ${expiresAt} ELSE active_until END,
      updated_at = now()
    WHERE id = ${admin.id}
    RETURNING id, email, role, active_until, created_at, updated_at, last_activity, created_by
  `;

  return { ok: true, admin: Array.isArray(rows) && rows[0] ? rows[0] : null };
}

async function deleteAdminById(id) {
  const admin = await getAdminById(id);
  if (!admin) {
    return { ok: false, status: 404, message: "Admin not found." };
  }

  if (isSuperAdminRow(admin) || isSuperAdminEmail(admin.email)) {
    return { ok: false, status: 403, message: "The super admin account cannot be deleted." };
  }

  await ensureAdminSchema();
  await prisma.$executeRaw`DELETE FROM admins WHERE id = ${admin.id}`;

  return { ok: true };
}

async function updateAdminExpiryById(id, expiresAt) {
  const admin = await getAdminById(id);
  if (!admin) {
    return { ok: false, status: 404, message: "Admin not found." };
  }

  if (isSuperAdminRow(admin) || isSuperAdminEmail(admin.email)) {
    return { ok: false, status: 403, message: "The super admin account cannot be modified." };
  }

  if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= Date.now()) {
    return { ok: false, status: 400, message: "A valid future expiration date is required." };
  }

  await ensureAdminSchema();
  const rows = await prisma.$queryRaw`
    UPDATE admins
    SET active_until = ${expiresAt}, updated_at = now()
    WHERE id = ${admin.id}
    RETURNING id, email, role, active_until, created_at, updated_at, last_activity, created_by
  `;

  return { ok: true, admin: Array.isArray(rows) && rows[0] ? rows[0] : null };
}

async function syncAdminActivity(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  await ensureAdminSchema();
  await prisma.$executeRaw`
    UPDATE admins
    SET last_activity = now(), updated_at = now()
    WHERE lower(email) = lower(${normalizedEmail})
  `;
}

module.exports = {
  SUPER_ADMIN_ROLE,
  TEMP_ADMIN_ROLE,
  ensureAdminSchema,
  getAdminByEmail,
  getAdminById,
  getConfiguredSuperAdminEmail,
  isSuperAdminEmail,
  isSuperAdminRow,
  isExpiredAdminRow,
  parseDurationToExpiresAt,
  listAdmins,
  createAdmin,
  updateAdminById,
  deleteAdminById,
  syncAdminActivity,
};