const { prisma } = require("../lib/prisma");
const { ok, created, fail } = require("../services/responses");

function normalizeSkillPayload(body) {
  return {
    category: String(body?.category || "").trim(),
    name: String(body?.name || "").trim(),
  };
}

function validateSkillPayload(payload) {
  const errors = {};
  if (!payload.category) errors.category = "Category is required.";
  if (!payload.name) errors.name = "Name is required.";
  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

async function getAdminSkills(req, res) {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return ok(res, skills);
  } catch (err) {
    return fail(res, 500, "Failed to load skills.", err?.message);
  }
}

async function createAdminSkill(req, res) {
  try {
    const payload = normalizeSkillPayload(req.body);
    const validation = validateSkillPayload(payload);
    if (!validation.ok) return res.status(400).json({ message: "Validation failed.", errors: validation.errors });

    const skill = await prisma.skill.create({ data: payload });
    return created(res, skill);
  } catch (err) {
    return fail(res, 500, "Failed to create skill.", err?.message);
  }
}

async function updateAdminSkill(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, "Invalid skill id.");

    const payload = normalizeSkillPayload(req.body);
    const validation = validateSkillPayload(payload);
    if (!validation.ok) return res.status(400).json({ message: "Validation failed.", errors: validation.errors });

    const skill = await prisma.skill.update({ where: { id }, data: payload });
    return ok(res, skill);
  } catch (err) {
    return fail(res, 500, "Failed to update skill.", err?.message);
  }
}

async function deleteAdminSkill(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, "Invalid skill id.");

    await prisma.skill.delete({ where: { id } });
    return ok(res, { ok: true });
  } catch (err) {
    return fail(res, 500, "Failed to delete skill.", err?.message);
  }
}

module.exports = {
  getAdminSkills,
  createAdminSkill,
  updateAdminSkill,
  deleteAdminSkill,
};
