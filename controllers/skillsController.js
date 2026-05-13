const { prisma } = require("../lib/prisma");
const { ok, fail } = require("../services/responses");

function groupSkills(rows) {
  const map = new Map();
  for (const s of rows) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category).push({
      name: s.name,
      level: 80,
      iconKey: "code",
    });
  }
  return [...map.entries()].map(([category, skills]) => ({
    category,
    skills,
  }));
}

async function getSkills(req, res) {
  try {
    const rows = await prisma.skill.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return ok(res, groupSkills(rows));
  } catch (err) {
    return fail(res, 500, "Failed to load skills.", err?.message);
  }
}

module.exports = { getSkills };

