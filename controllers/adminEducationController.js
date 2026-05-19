const { prisma } = require("../lib/prisma");
const { ok, created, fail } = require("../services/responses");

function normalizeEducationPayload(body) {
  return {
    institution: String(body?.institution || "").trim(),
    program: String(body?.program || "").trim(),
    description: String(body?.description || "").trim(),
    statusTag: body?.statusTag ? String(body.statusTag).trim() : null,
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
  };
}

function validateEducationPayload(payload) {
  const errors = {};
  if (!payload.institution) errors.institution = "Institution is required.";
  if (!payload.program) errors.program = "Program is required.";
  if (!payload.description) errors.description = "Description is required.";
  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

async function getAdminEducation(req, res) {
  try {
    const rows = await prisma.education.findMany({ orderBy: { sortOrder: "asc" } });
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, "Failed to load education.", err?.message);
  }
}

async function createAdminEducation(req, res) {
  try {
    const payload = normalizeEducationPayload(req.body);
    const validation = validateEducationPayload(payload);
    if (!validation.ok) return res.status(400).json({ message: "Validation failed.", errors: validation.errors });

    const row = await prisma.education.create({ data: payload });
    return created(res, row);
  } catch (err) {
    return fail(res, 500, "Failed to create education.", err?.message);
  }
}

async function updateAdminEducation(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, "Invalid education id.");

    const payload = normalizeEducationPayload(req.body);
    const validation = validateEducationPayload(payload);
    if (!validation.ok) return res.status(400).json({ message: "Validation failed.", errors: validation.errors });

    const row = await prisma.education.update({ where: { id }, data: payload });
    return ok(res, row);
  } catch (err) {
    return fail(res, 500, "Failed to update education.", err?.message);
  }
}

async function deleteAdminEducation(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, "Invalid education id.");

    await prisma.education.delete({ where: { id } });
    return ok(res, { ok: true });
  } catch (err) {
    return fail(res, 500, "Failed to delete education.", err?.message);
  }
}

module.exports = {
  getAdminEducation,
  createAdminEducation,
  updateAdminEducation,
  deleteAdminEducation,
};
