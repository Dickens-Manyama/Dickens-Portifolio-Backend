const { prisma } = require("../lib/prisma");
const { created, fail } = require("../services/responses");
const { validateContactPayload } = require("../services/validation");

async function postContact(req, res) {
  const validation = validateContactPayload(req.body);
  if (!validation.ok) return fail(res, 400, "Validation failed.", validation.errors);

  try {
    const saved = await prisma.contactMessage.create({
      data: validation.value,
    });
    return created(res, {
      id: saved.id,
      createdAt: saved.createdAt,
      message: "Thanks! Your message was received.",
    });
  } catch (err) {
    return fail(res, 500, "Failed to save message.", err?.message);
  }
}

module.exports = { postContact };

