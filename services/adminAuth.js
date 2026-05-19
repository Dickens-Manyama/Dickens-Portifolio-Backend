const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const TOKEN_TTL = "8h";
const prisma = new PrismaClient();

function getJwtSecret() {
  return process.env.ADMIN_JWT_SECRET;
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL;
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD;
}

function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH;
}

async function verifyAdminCredentials(email, password) {
  const adminEmail = getAdminEmail();

  // If ADMIN_EMAIL is configured in env, keep existing env-based behavior
  if (adminEmail) {
    if (String(email || "").trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return { ok: false, reason: "Invalid credentials." };
    }

    const hash = getAdminPasswordHash();
    const plain = getAdminPassword();

    if (hash) {
      const valid = await bcrypt.compare(String(password || ""), hash);
      return valid ? { ok: true } : { ok: false, reason: "Invalid credentials." };
    }

    if (!plain) return { ok: false, reason: "Missing ADMIN_PASSWORD." };
    if (String(password || "") !== plain) return { ok: false, reason: "Invalid credentials." };

    return { ok: true };
  }

  // Fallback: check `admins` table in the database (seed script creates it)
  try {
    const rows = await prisma.$queryRaw`
      SELECT password_hash FROM admins WHERE lower(email) = lower(${String(email || "").trim()}) LIMIT 1
    `;
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row || !row.password_hash) return { ok: false, reason: "Invalid credentials." };

    const valid = await bcrypt.compare(String(password || ""), row.password_hash);
    return valid ? { ok: true } : { ok: false, reason: "Invalid credentials." };
  } catch (err) {
    return { ok: false, reason: "Auth database error." };
  }
}

function signAdminToken(payload) {
  const secret = getJwtSecret();
  if (!secret) throw new Error("Missing ADMIN_JWT_SECRET.");
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL });
}

async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing admin token." });

  const secret = getJwtSecret();
  if (!secret) return res.status(500).json({ message: "Server auth not configured." });

  try {
    const decoded = jwt.verify(token, secret);
    req.admin = decoded;

    // Inactivity timeout enforcement and update
    // Configurable via ADMIN_INACTIVITY_TIMEOUT_MS (milliseconds). Default: 300000 (5 minutes)
    const timeoutMs = parseInt(process.env.ADMIN_INACTIVITY_TIMEOUT_MS || "300000", 10);
    req.adminSession = {
      timeoutMs,
      lastActivityAt: null,
    };

    if (decoded && decoded.email) {
      try {
        // Ensure column exists (idempotent)
        await prisma.$executeRaw`ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ`;

        // Read current last_activity for this admin
        const rows = await prisma.$queryRaw`
          SELECT last_activity FROM admins WHERE lower(email) = lower(${String(decoded.email).trim()}) LIMIT 1
        `;
        const row = Array.isArray(rows) && rows[0] ? rows[0] : null;

        const now = new Date();
        const lastActivity = row && row.last_activity ? new Date(row.last_activity) : null;
        req.adminSession.lastActivityAt = lastActivity ? lastActivity.toISOString() : null;

        if (lastActivity && timeoutMs > 0) {
          const diff = now - lastActivity; // ms
          if (diff > timeoutMs) {
            // Session considered inactive — reject
            return res.status(401).json({ message: "Session expired due to inactivity." });
          }
        }

        // Update last_activity timestamp to now
        await prisma.$executeRaw`
          UPDATE admins SET last_activity = now() WHERE lower(email) = lower(${String(decoded.email).trim()})
        `;
      } catch (err) {
        // Non-fatal: do not block requests if DB update/check fails
        console.warn("admin inactivity tracking failed:", err?.message || err);
      }
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = {
  verifyAdminCredentials,
  signAdminToken,
  requireAdminAuth,
};
