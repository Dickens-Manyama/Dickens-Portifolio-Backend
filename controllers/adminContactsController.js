const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function getSessionPayload(req) {
  const timeoutMs = parseInt(process.env.ADMIN_INACTIVITY_TIMEOUT_MS || "300000", 10);
  const session = req.adminSession || {};

  return {
    timeoutMs: session.timeoutMs || timeoutMs,
    lastActivityAt: session.lastActivityAt || null,
    adminExpiresAt: session.adminExpiresAt || null,
    adminEmail: req.admin?.email || null,
    isSuperAdmin: !!session.isSuperAdmin,
  };
}

async function getAdminContacts(req, res) {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
    });
    return ok(res, messages);
  } catch (err) {
    return fail(res, 500, "Failed to load messages.", err?.message);
  }
}

async function deleteAdminContact(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, "Invalid message id.");
  }

  try {
    await prisma.contactMessage.delete({ where: { id } });
    return ok(res, { message: "Message deleted." });
  } catch (err) {
    if (err?.code === "P2025") {
      return fail(res, 404, "Message not found.");
    }
    return fail(res, 500, "Failed to delete message.", err?.message);
  }
}

async function getAdminSession(req, res) {
  return ok(res, getSessionPayload(req));
}

module.exports = { getAdminContacts, deleteAdminContact, getAdminSession };
