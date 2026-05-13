const { prisma } = require("../lib/prisma");
const { validateContactPayload } = require("../services/validation");

async function getContacts(req, res) {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to load messages.",
    });
  }
}

async function postContact(req, res) {
  const validation = validateContactPayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: validation.errors,
    });
  }

  try {
    const saved = await prisma.contactMessage.create({
      data: validation.value,
    });
    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: {
        id: saved.id,
        createdAt: saved.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to save message.",
    });
  }
}

module.exports = { getContacts, postContact };

