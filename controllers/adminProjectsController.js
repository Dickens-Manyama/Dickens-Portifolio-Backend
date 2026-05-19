const { prisma } = require("../lib/prisma");
const { ok, created, fail } = require("../services/responses");

function normalizeTechStack(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeProjectPayload(body) {
  return {
    title: String(body?.title || "").trim(),
    description: String(body?.description || "").trim(),
    techStack: normalizeTechStack(body?.techStack),
    githubLink: body?.githubLink ? String(body.githubLink).trim() : null,
    liveDemo: body?.liveDemo ? String(body.liveDemo).trim() : null,
  };
}

function validateProjectPayload(payload) {
  const errors = {};
  if (!payload.title) errors.title = "Title is required.";
  if (!payload.description) errors.description = "Description is required.";
  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

async function getAdminProjects(req, res) {
  try {
    const projects = await prisma.project.findMany({ orderBy: { id: "asc" } });
    return ok(res, projects);
  } catch (err) {
    return fail(res, 500, "Failed to load projects.", err?.message);
  }
}

async function createAdminProject(req, res) {
  try {
    const payload = normalizeProjectPayload(req.body);
    const validation = validateProjectPayload(payload);
    if (!validation.ok) return res.status(400).json({ message: "Validation failed.", errors: validation.errors });

    const project = await prisma.project.create({ data: payload });
    return created(res, project);
  } catch (err) {
    return fail(res, 500, "Failed to create project.", err?.message);
  }
}

async function updateAdminProject(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, "Invalid project id.");

    const payload = normalizeProjectPayload(req.body);
    const validation = validateProjectPayload(payload);
    if (!validation.ok) return res.status(400).json({ message: "Validation failed.", errors: validation.errors });

    const project = await prisma.project.update({ where: { id }, data: payload });
    return ok(res, project);
  } catch (err) {
    return fail(res, 500, "Failed to update project.", err?.message);
  }
}

async function deleteAdminProject(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, "Invalid project id.");

    await prisma.project.delete({ where: { id } });
    return ok(res, { ok: true });
  } catch (err) {
    return fail(res, 500, "Failed to delete project.", err?.message);
  }
}

module.exports = {
  getAdminProjects,
  createAdminProject,
  updateAdminProject,
  deleteAdminProject,
};
