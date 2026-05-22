const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {
  ensureAdminSchema,
  getAdminByEmail,
  isSuperAdminEmail,
  isSuperAdminRow,
  isExpiredAdminRow,
  syncAdminActivity,
} = require("./adminDirectory");
const { prisma } = require("../lib/prisma");

const TOKEN_TTL = "8h";

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
  const normalizedEmail = String(email || "").trim().toLowerCase();

  // If ADMIN_EMAIL is configured in env, keep existing env-based behavior
  if (adminEmail) {
    if (normalizedEmail !== adminEmail.trim().toLowerCase()) {
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
    await ensureAdminSchema();

    const rows = await prisma.$queryRaw`
      SELECT id, email, password_hash, role, active_until, created_at, updated_at, last_activity, created_by
      FROM admins
      WHERE lower(email) = lower(${normalizedEmail})
      LIMIT 1
    `;
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row || !row.password_hash) return { ok: false, reason: "Invalid credentials." };

    if (isExpiredAdminRow(row)) return { ok: false, reason: "Admin access expired." };

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

async function touchAdminActivity(email) {
  await syncAdminActivity(email);
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
    req.adminSession = {
      timeoutMs: parseInt(process.env.ADMIN_INACTIVITY_TIMEOUT_MS || "300000", 10),
      lastActivityAt: null,
      adminExpiresAt: null,
      isSuperAdmin: isSuperAdminEmail(decoded?.email),
    };

    if (!decoded?.email) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    // Inactivity timeout enforcement and update
    // Configurable via ADMIN_INACTIVITY_TIMEOUT_MS (milliseconds). Default: 300000 (5 minutes)
    const timeoutMs = req.adminSession.timeoutMs;

    try {
      await ensureAdminSchema();

      if (!req.adminSession.isSuperAdmin) {
        const row = await getAdminByEmail(decoded.email);
        if (!row || !row.password_hash) {
          return res.status(401).json({ message: "Invalid or expired token." });
        }

        if (isSuperAdminRow(row)) {
          req.adminSession.isSuperAdmin = true;
        }

        if (isExpiredAdminRow(row)) {
          return res.status(401).json({ message: "Admin access expired." });
        }

        req.adminSession.adminExpiresAt = row.active_until ? new Date(row.active_until).toISOString() : null;
        req.adminSession.lastActivityAt = row.last_activity ? new Date(row.last_activity).toISOString() : null;

        const now = new Date();
        const lastActivity = row.last_activity ? new Date(row.last_activity) : null;

        if (lastActivity && timeoutMs > 0) {
          const diff = now - lastActivity; // ms
          if (diff > timeoutMs) {
            // Session considered inactive — reject
            return res.status(401).json({ message: "Session expired due to inactivity." });
          }
        }

        // Update last_activity timestamp to now
        await syncAdminActivity(decoded.email);
      } else {
        req.adminSession.adminExpiresAt = null;
      }
    } catch (err) {
      // Non-fatal: do not block requests if DB update/check fails
      console.warn("admin inactivity tracking failed:", err?.message || err);
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

async function requireSuperAdmin(req, res, next) {
  const email = String(req.admin?.email || "").trim().toLowerCase();
  if (!email) return res.status(401).json({ message: "Missing admin token." });

  if (isSuperAdminEmail(email)) {
    return next();
  }

  try {
    const row = await getAdminByEmail(email);
    if (row && isSuperAdminRow(row)) {
      return next();
    }
  } catch (err) {
    return res.status(500).json({ message: "Failed to verify admin privileges." });
  }

  return res.status(403).json({ message: "Super admin access required." });
}

module.exports = {
  verifyAdminCredentials,
  signAdminToken,
  touchAdminActivity,
  requireAdminAuth,
  requireSuperAdmin,
};
