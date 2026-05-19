const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

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

module.exports = { getAdminContacts };
