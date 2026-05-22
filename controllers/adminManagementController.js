const {
  createAdmin,
  deleteAdminById,
  listAdmins,
  parseDurationToExpiresAt,
} = require("../services/adminDirectory");
const { ok, fail, created } = require("../services/responses");

function serializeAdmin(admin) {
  if (!admin) return null;

  const activeUntil = admin.active_until ? new Date(admin.active_until) : null;
  const createdAt = admin.created_at ? new Date(admin.created_at) : null;
  const updatedAt = admin.updated_at ? new Date(admin.updated_at) : null;
  const lastActivityAt = admin.last_activity ? new Date(admin.last_activity) : null;

  return {
    id: admin.id,
    email: admin.email,
    role: admin.role || "ADMIN",
    activeUntil: activeUntil && !Number.isNaN(activeUntil.getTime()) ? activeUntil.toISOString() : null,
    createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : null,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toISOString() : null,
    lastActivityAt: lastActivityAt && !Number.isNaN(lastActivityAt.getTime()) ? lastActivityAt.toISOString() : null,
    createdBy: admin.created_by || null,
    isSuperAdmin: String(admin.role || "").toUpperCase() === "SUPER_ADMIN",
    isExpired: !!(activeUntil && !Number.isNaN(activeUntil.getTime()) && activeUntil.getTime() <= Date.now()),
  };
}

async function getAdminsController(req, res) {
  try {
    const admins = await listAdmins();
    return ok(res, admins.map(serializeAdmin));
  } catch (err) {
    return fail(res, 500, "Failed to load admins.", err?.message);
  }
}

async function createAdminController(req, res) {
  const { email, password } = req.body || {};
  const durationResult = parseDurationToExpiresAt(req.body || {});
  if (!durationResult.ok) {
    return fail(res, 400, durationResult.message);
  }

  try {
    const result = await createAdmin({
      email,
      password,
      expiresAt: durationResult.expiresAt,
      createdBy: req.admin?.email,
    });

    if (!result.ok) {
      return fail(res, result.status || 400, result.message);
    }

    return created(res, serializeAdmin(result.admin));
  } catch (err) {
    return fail(res, 500, "Failed to create admin.", err?.message);
  }
}

async function updateAdminController(req, res) {
  const durationResult = parseDurationToExpiresAt(req.body || {});
  if (!durationResult.ok) {
    return fail(res, 400, durationResult.message);
  }

  try {
    const { updateAdminExpiryById } = require("../services/adminDirectory");
    const result = await updateAdminExpiryById(req.params.id, durationResult.expiresAt);
    if (!result.ok) {
      return fail(res, result.status || 400, result.message);
    }
    return ok(res, serializeAdmin(result.admin));
  } catch (err) {
    return fail(res, 500, "Failed to update admin.", err?.message);
  }
}

async function deleteAdminController(req, res) {
  try {
    const result = await deleteAdminById(req.params.id);
    if (!result.ok) {
      return fail(res, result.status || 400, result.message);
    }

    return ok(res, { message: "Admin deleted." });
  } catch (err) {
    return fail(res, 500, "Failed to delete admin.", err?.message);
  }
}

module.exports = {
  getAdminsController,
  createAdminController,
  deleteAdminController,
  updateAdminController,
};