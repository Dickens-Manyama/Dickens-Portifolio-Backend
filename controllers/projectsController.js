const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function mapProject(project) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    stack: project.techStack ?? [],
    githubUrl: project.githubLink ?? null,
    demoUrl: project.liveDemo ?? null,
  };
}

async function getProjects(req, res) {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { id: "asc" },
    });
    return ok(res, projects.map(mapProject));
  } catch (err) {
    return fail(res, 500, "Failed to load projects.", err?.message);
  }
}

module.exports = { getProjects };

