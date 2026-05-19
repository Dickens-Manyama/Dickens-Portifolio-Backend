const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function normalizeStrengths(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || "").trim()).filter(Boolean);
}

function normalizeProfilePayload(body) {
  return {
    name: String(body?.name || "").trim(),
    title: String(body?.title || "").trim(),
    summary: String(body?.summary || "").trim(),
    email: String(body?.email || "").trim(),
    phone: String(body?.phone || "").trim(),
    github: String(body?.github || "").trim(),
    linkedin: String(body?.linkedin || "").trim(),
    careerObjective: String(body?.careerObjective || "").trim(),
    strengths: normalizeStrengths(body?.strengths),
  };
}

function validateProfilePayload(payload) {
  const errors = {};
  if (!payload.name) errors.name = "Name is required.";
  if (!payload.title) errors.title = "Title is required.";
  if (!payload.summary) errors.summary = "Summary is required.";
  if (!payload.email) errors.email = "Email is required.";
  if (!payload.phone) errors.phone = "Phone is required.";
  if (!payload.github) errors.github = "GitHub is required.";
  if (!payload.linkedin) errors.linkedin = "LinkedIn is required.";

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

async function getAdminProfile(req, res) {
  try {
    const profile = await prisma.profile.findFirst({ orderBy: { id: "asc" } });
    if (!profile) return ok(res, null);
    return ok(res, profile);
  } catch (err) {
    return fail(res, 500, "Failed to load profile.", err?.message);
  }
}

async function upsertAdminProfile(req, res) {
  try {
    const payload = normalizeProfilePayload(req.body);
    const validation = validateProfilePayload(payload);
    if (!validation.ok) return res.status(400).json({ message: "Validation failed.", errors: validation.errors });

    const existing = await prisma.profile.findFirst({ orderBy: { id: "asc" } });

    if (!existing) {
      const created = await prisma.profile.create({ data: payload });
      return ok(res, created);
    }

    const updated = await prisma.profile.update({
      where: { id: existing.id },
      data: payload,
    });

    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, "Failed to save profile.", err?.message);
  }
}

module.exports = {
  getAdminProfile,
  upsertAdminProfile,
};
